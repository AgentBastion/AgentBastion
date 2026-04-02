use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use agent_bastion_auth::api_key;
use agent_bastion_common::dto::{CreateApiKeyRequest, CreateApiKeyResponse};
use agent_bastion_common::errors::AppError;
use agent_bastion_common::models::ApiKey;

use crate::app::AppState;
use crate::middleware::auth_guard::AuthUser;

pub async fn list_keys(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiKey>>, AppError> {
    let keys = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth_user.claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(keys))
}

pub async fn create_key(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, AppError> {
    let generated = api_key::generate_api_key();

    let expires_at = req.expires_in_days.map(|days| {
        chrono::Utc::now() + chrono::Duration::days(days as i64)
    });

    let row = sqlx::query_as::<_, ApiKey>(
        r#"INSERT INTO api_keys (key_prefix, key_hash, name, user_id, team_id, allowed_models, rate_limit_rpm, rate_limit_tpm, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *"#,
    )
    .bind(&generated.prefix)
    .bind(&generated.hash)
    .bind(&req.name)
    .bind(auth_user.claims.sub)
    .bind(req.team_id)
    .bind(&req.allowed_models)
    .bind(req.rate_limit_rpm)
    .bind(req.rate_limit_tpm)
    .bind(expires_at)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(CreateApiKeyResponse {
        id: row.id,
        key: generated.plaintext, // shown only once!
        name: row.name,
        key_prefix: row.key_prefix,
    }))
}

pub async fn get_key(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiKey>, AppError> {
    let key = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth_user.claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("API key not found".into()))?;

    Ok(Json(key))
}

pub async fn revoke_key(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query(
        "UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth_user.claims.sub)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("API key not found".into()));
    }

    Ok(Json(serde_json::json!({"status": "revoked"})))
}
