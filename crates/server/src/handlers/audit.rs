use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use agent_bastion_common::errors::AppError;
use agent_bastion_common::models::AuditLog;

use crate::app::AppState;
use crate::middleware::auth_guard::AuthUser;

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    pub q: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogResponse {
    pub items: Vec<AuditLog>,
    pub total: i64,
}

pub async fn list_audit_logs(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<AuditLogQuery>,
) -> Result<Json<AuditLogResponse>, AppError> {
    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let (items, total) = if let Some(ref q) = query.q {
        let pattern = format!("%{q}%");
        let items = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs WHERE action ILIKE $1 OR resource ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(&pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_logs WHERE action ILIKE $1 OR resource ILIKE $1",
        )
        .bind(&pattern)
        .fetch_one(&state.db)
        .await?;

        (items, total)
    } else {
        let items = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs")
                .fetch_one(&state.db)
                .await?;

        (items, total)
    };

    Ok(Json(AuditLogResponse { items, total }))
}
