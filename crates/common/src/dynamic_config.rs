use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Database-backed dynamic configuration with in-memory cache.
///
/// Settings are loaded from `system_settings` at startup and cached in memory.
/// Changes are persisted to DB and the cache is refreshed. Multi-instance
/// deployments stay in sync via Redis Pub/Sub on the `config:changed` channel.
#[derive(Clone)]
pub struct DynamicConfig {
    cache: Arc<RwLock<HashMap<String, Value>>>,
    db: PgPool,
}

impl DynamicConfig {
    /// Load all settings from the database into a new `DynamicConfig`.
    pub async fn load(db: PgPool) -> anyhow::Result<Self> {
        let rows: Vec<(String, Value)> = sqlx::query_as("SELECT key, value FROM system_settings")
            .fetch_all(&db)
            .await?;

        let mut map = HashMap::with_capacity(rows.len());
        for (key, value) in rows {
            map.insert(key, value);
        }

        Ok(Self {
            cache: Arc::new(RwLock::new(map)),
            db,
        })
    }

    /// Reload all settings from the database.
    pub async fn reload(&self) -> anyhow::Result<()> {
        let rows: Vec<(String, Value)> = sqlx::query_as("SELECT key, value FROM system_settings")
            .fetch_all(&self.db)
            .await?;

        let mut map = HashMap::with_capacity(rows.len());
        for (key, value) in rows {
            map.insert(key, value);
        }

        let mut cache = self.cache.write().await;
        *cache = map;
        Ok(())
    }

    /// Update one or more settings in the database and refresh the cache.
    pub async fn update(
        &self,
        updates: &HashMap<String, Value>,
        updated_by: Option<uuid::Uuid>,
    ) -> anyhow::Result<()> {
        let mut tx = self.db.begin().await?;

        for (key, value) in updates {
            sqlx::query(
                r#"UPDATE system_settings
                   SET value = $1, updated_by = $2, updated_at = now()
                   WHERE key = $3"#,
            )
            .bind(value)
            .bind(updated_by)
            .bind(key)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        self.reload().await?;
        Ok(())
    }

    // --- Typed getters ---

    /// Get a raw JSON value.
    pub async fn get(&self, key: &str) -> Option<Value> {
        self.cache.read().await.get(key).cloned()
    }

    /// Get as i64.
    pub async fn get_i64(&self, key: &str) -> Option<i64> {
        self.cache.read().await.get(key).and_then(|v| v.as_i64())
    }

    /// Get as f64.
    pub async fn get_f64(&self, key: &str) -> Option<f64> {
        self.cache.read().await.get(key).and_then(|v| v.as_f64())
    }

    /// Get as String.
    pub async fn get_string(&self, key: &str) -> Option<String> {
        self.cache
            .read()
            .await
            .get(key)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
    }

    /// Get as bool.
    pub async fn get_bool(&self, key: &str) -> Option<bool> {
        self.cache.read().await.get(key).and_then(|v| v.as_bool())
    }

    /// Get as Vec<f64>.
    pub async fn get_f64_vec(&self, key: &str) -> Option<Vec<f64>> {
        self.cache.read().await.get(key).and_then(|v| {
            v.as_array()
                .map(|arr| arr.iter().filter_map(|x| x.as_f64()).collect())
        })
    }

    /// Get the raw JSON value (for complex structures like pattern arrays).
    pub async fn get_json(&self, key: &str) -> Option<Value> {
        self.cache.read().await.get(key).cloned()
    }

    /// Get all settings grouped by category.
    pub async fn get_all_grouped(&self) -> HashMap<String, Vec<SettingEntry>> {
        let rows: Vec<SettingRow> = sqlx::query_as(
            "SELECT key, value, category, description, updated_at FROM system_settings ORDER BY key",
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let mut grouped: HashMap<String, Vec<SettingEntry>> = HashMap::new();
        for row in rows {
            grouped
                .entry(row.category.clone())
                .or_default()
                .push(SettingEntry {
                    key: row.key,
                    value: row.value,
                    category: row.category,
                    description: row.description,
                    updated_at: row.updated_at,
                });
        }
        grouped
    }

    /// Get settings for a specific category.
    pub async fn get_by_category(&self, category: &str) -> Vec<SettingEntry> {
        let rows: Vec<SettingRow> = sqlx::query_as(
            "SELECT key, value, category, description, updated_at FROM system_settings WHERE category = $1 ORDER BY key",
        )
        .bind(category)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        rows.into_iter()
            .map(|row| SettingEntry {
                key: row.key,
                value: row.value,
                category: row.category,
                description: row.description,
                updated_at: row.updated_at,
            })
            .collect()
    }

    // --- Convenience getters with defaults ---

    pub async fn jwt_access_ttl_secs(&self) -> i64 {
        self.get_i64("auth.jwt_access_ttl_secs")
            .await
            .unwrap_or(900)
    }

    pub async fn jwt_refresh_ttl_days(&self) -> i64 {
        self.get_i64("auth.jwt_refresh_ttl_days").await.unwrap_or(7)
    }

    pub async fn cache_ttl_secs(&self) -> u64 {
        self.get_i64("gateway.cache_ttl_secs").await.unwrap_or(3600) as u64
    }

    pub async fn signature_drift_secs(&self) -> i64 {
        self.get_i64("security.signature_drift_secs")
            .await
            .unwrap_or(300)
    }

    pub async fn signature_nonce_ttl_secs(&self) -> i64 {
        self.get_i64("security.signature_nonce_ttl_secs")
            .await
            .unwrap_or(600)
    }

    pub async fn budget_alert_thresholds(&self) -> Vec<f64> {
        self.get_f64_vec("budget.alert_thresholds")
            .await
            .unwrap_or_else(|| vec![0.50, 0.80, 0.95])
    }

    pub async fn budget_webhook_url(&self) -> Option<String> {
        self.get_string("budget.webhook_url").await
    }

    pub async fn is_initialized(&self) -> bool {
        self.get_bool("setup.initialized").await.unwrap_or(false)
    }

    pub async fn site_name(&self) -> String {
        self.get_string("setup.site_name")
            .await
            .unwrap_or_else(|| "AgentBastion".to_string())
    }

    pub async fn api_keys_default_expiry_days(&self) -> i64 {
        self.get_i64("api_keys.default_expiry_days")
            .await
            .unwrap_or(90)
    }

    pub async fn api_keys_inactivity_timeout_days(&self) -> i64 {
        self.get_i64("api_keys.inactivity_timeout_days")
            .await
            .unwrap_or(0)
    }

    pub async fn api_keys_rotation_period_days(&self) -> i64 {
        self.get_i64("api_keys.rotation_period_days")
            .await
            .unwrap_or(0)
    }

    pub async fn api_keys_rotation_grace_period_hours(&self) -> i64 {
        self.get_i64("api_keys.rotation_grace_period_hours")
            .await
            .unwrap_or(24)
    }

    pub async fn data_retention_days_usage(&self) -> i64 {
        self.get_i64("data.retention_days_usage")
            .await
            .unwrap_or(90)
    }

    pub async fn data_retention_days_audit(&self) -> i64 {
        self.get_i64("data.retention_days_audit")
            .await
            .unwrap_or(365)
    }
}

/// Publish a config change notification via Redis Pub/Sub.
pub async fn notify_config_changed(redis: &fred::clients::Client) {
    use fred::interfaces::PubsubInterface;
    let _: Result<(), _> = redis.publish("config:changed", "reload").await;
}

/// Subscribe to config change notifications and reload when received.
pub fn spawn_config_subscriber(redis: fred::clients::SubscriberClient, config: Arc<DynamicConfig>) {
    tokio::spawn(async move {
        use fred::interfaces::{EventInterface, PubsubInterface};
        let mut rx = redis.message_rx();

        if let Err(e) = redis.subscribe("config:changed").await {
            tracing::warn!("Failed to subscribe to config:changed: {e}");
            return;
        }

        while let Ok(msg) = rx.recv().await {
            if msg.channel == "config:changed" {
                tracing::info!("Config change notification received, reloading");
                if let Err(e) = config.reload().await {
                    tracing::error!("Failed to reload config: {e}");
                }
            }
        }
    });
}

// --- Internal types ---

#[derive(Debug, sqlx::FromRow)]
struct SettingRow {
    key: String,
    value: Value,
    category: String,
    description: Option<String>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SettingEntry {
    pub key: String,
    pub value: Value,
    pub category: String,
    pub description: Option<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
