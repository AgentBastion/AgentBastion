use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use agent_bastion_common::crypto;
use agent_bastion_common::dto::CreateProviderRequest;
use agent_bastion_common::errors::AppError;
use agent_bastion_common::models::Provider;

use crate::app::AppState;
use crate::middleware::auth_guard::AuthUser;

fn encryption_key(state: &AppState) -> Result<[u8; 32], AppError> {
    crypto::parse_encryption_key(&state.config.encryption_key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid encryption key: {e}")))
}

pub async fn list_providers(
    _auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Provider>>, AppError> {
    let providers = sqlx::query_as::<_, Provider>(
        "SELECT * FROM providers ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(providers))
}

pub async fn create_provider(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateProviderRequest>,
) -> Result<Json<Provider>, AppError> {
    if req.name.is_empty() || req.base_url.is_empty() || req.api_key.is_empty() {
        return Err(AppError::BadRequest("name, base_url, and api_key are required".into()));
    }

    let key = encryption_key(&state)?;
    let encrypted_key = crypto::encrypt(req.api_key.as_bytes(), &key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Encryption failed: {e}")))?;

    let provider = sqlx::query_as::<_, Provider>(
        r#"INSERT INTO providers (name, display_name, provider_type, base_url, api_key_encrypted, config_json)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"#,
    )
    .bind(&req.name)
    .bind(&req.display_name)
    .bind(&req.provider_type)
    .bind(&req.base_url)
    .bind(&encrypted_key)
    .bind(req.config.unwrap_or(serde_json::json!({})))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(provider))
}

pub async fn get_provider(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Provider>, AppError> {
    let provider = sqlx::query_as::<_, Provider>(
        "SELECT * FROM providers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Provider not found".into()))?;

    Ok(Json(provider))
}

pub async fn delete_provider(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM providers WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({"status": "deleted"})))
}
