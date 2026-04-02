use axum::{
    extract::State,
    http::{header::AUTHORIZATION, Request, StatusCode},
    middleware::Next,
    response::Response,
};

use agent_bastion_auth::api_key;

use crate::app::AppState;

/// Authenticated identity for gateway requests (via `ab-` API key).
#[derive(Debug, Clone)]
pub struct GatewayIdentity {
    pub api_key_id: uuid::Uuid,
    pub user_id: Option<uuid::Uuid>,
    pub team_id: Option<uuid::Uuid>,
    pub allowed_models: Option<Vec<String>>,
    pub rate_limit_rpm: Option<i32>,
    pub rate_limit_tpm: Option<i32>,
}

/// Middleware that authenticates requests via `ab-` prefixed API keys
/// OR falls back to JWT Bearer tokens (for admin/testing convenience).
pub async fn require_api_key_or_jwt(
    State(state): State<AppState>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Check if this is an ab- API key
    if token.starts_with("ab-") {
        let key_hash = api_key::hash_api_key(token);

        let row = sqlx::query_as::<_, agent_bastion_common::models::ApiKey>(
            "SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true",
        )
        .bind(&key_hash)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

        // Check expiration
        if let Some(expires_at) = row.expires_at {
            if expires_at < chrono::Utc::now() {
                return Err(StatusCode::UNAUTHORIZED);
            }
        }

        // Update last_used_at (best-effort, don't block on failure)
        let db = state.db.clone();
        let key_id = row.id;
        tokio::spawn(async move {
            let _ = sqlx::query("UPDATE api_keys SET last_used_at = now() WHERE id = $1")
                .bind(key_id)
                .execute(&db)
                .await;
        });

        let identity = GatewayIdentity {
            api_key_id: row.id,
            user_id: row.user_id,
            team_id: row.team_id,
            allowed_models: row.allowed_models.clone(),
            rate_limit_rpm: row.rate_limit_rpm,
            rate_limit_tpm: row.rate_limit_tpm,
        };

        request.extensions_mut().insert(identity);
    } else {
        // Try JWT fallback
        let claims = state
            .jwt
            .verify_token(token)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        if claims.token_type != "access" {
            return Err(StatusCode::UNAUTHORIZED);
        }

        let identity = GatewayIdentity {
            api_key_id: uuid::Uuid::nil(),
            user_id: Some(claims.sub),
            team_id: None,
            allowed_models: None,
            rate_limit_rpm: None,
            rate_limit_tpm: None,
        };

        request.extensions_mut().insert(identity);
    }

    Ok(next.run(request).await)
}
