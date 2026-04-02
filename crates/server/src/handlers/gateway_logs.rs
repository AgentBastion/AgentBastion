use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};

use agent_bastion_common::errors::AppError;

use crate::app::AppState;
use crate::middleware::auth_guard::AuthUser;

#[derive(Debug, Deserialize)]
pub struct GatewayLogsQuery {
    pub model: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GatewayLogEntry {
    pub id: uuid::Uuid,
    pub model_id: String,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub cost_usd: rust_decimal::Decimal,
    pub latency_ms: Option<i32>,
    pub status_code: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct GatewayLogsResponse {
    pub items: Vec<GatewayLogEntry>,
    pub total: i64,
}

pub async fn list_gateway_logs(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<GatewayLogsQuery>,
) -> Result<Json<GatewayLogsResponse>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let (items, total) = if let Some(ref model) = params.model {
        let items = sqlx::query_as::<_, GatewayLogEntry>(
            r#"SELECT id, model_id, input_tokens, output_tokens, cost_usd, latency_ms, status_code, created_at
               FROM usage_records
               WHERE model_id ILIKE '%' || $1 || '%'
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(model)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: Option<i64> = sqlx::query_scalar(
            "SELECT COUNT(*) FROM usage_records WHERE model_id ILIKE '%' || $1 || '%'",
        )
        .bind(model)
        .fetch_one(&state.db)
        .await?;

        (items, total.unwrap_or(0))
    } else {
        let items = sqlx::query_as::<_, GatewayLogEntry>(
            r#"SELECT id, model_id, input_tokens, output_tokens, cost_usd, latency_ms, status_code, created_at
               FROM usage_records
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM usage_records")
            .fetch_one(&state.db)
            .await?;

        (items, total.unwrap_or(0))
    };

    Ok(Json(GatewayLogsResponse { items, total }))
}
