use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiKey {
    pub id: Uuid,
    pub key_prefix: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub name: String,
    pub user_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub scopes: serde_json::Value,
    pub allowed_models: Option<Vec<String>>,
    pub rate_limit_rpm: Option<i32>,
    pub rate_limit_tpm: Option<i32>,
    pub monthly_budget: Option<rust_decimal::Decimal>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    // Lifecycle management fields
    pub deleted_at: Option<DateTime<Utc>>,
    pub rotation_period_days: Option<i32>,
    pub rotated_from_id: Option<Uuid>,
    pub grace_period_ends_at: Option<DateTime<Utc>>,
    pub inactivity_timeout_days: Option<i32>,
    pub disabled_reason: Option<String>,
    pub last_rotation_at: Option<DateTime<Utc>>,
}
