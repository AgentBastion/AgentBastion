use axum::{
    extract::{FromRequestParts, State},
    http::{Request, StatusCode, header::AUTHORIZATION, request::Parts},
    middleware::Next,
    response::Response,
};

use agent_bastion_auth::jwt::Claims;

use crate::app::AppState;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub claims: Claims,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

pub async fn require_auth(
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

    let claims = state
        .jwt
        .verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if claims.token_type != "access" {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check JWT blacklist (revoked tokens)
    let token_hash = agent_bastion_auth::jwt::sha2_hash(token);
    if agent_bastion_auth::jwt::is_revoked(&state.redis, &token_hash).await {
        return Err(StatusCode::UNAUTHORIZED);
    }

    request.extensions_mut().insert(AuthUser { claims });

    Ok(next.run(request).await)
}
