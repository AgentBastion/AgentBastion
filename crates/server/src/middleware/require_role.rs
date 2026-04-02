use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};

use super::auth_guard::AuthUser;
use crate::app::AppState;

/// Middleware that requires the authenticated user to have at least one of the
/// specified roles. Must be applied AFTER `require_auth`.
pub async fn require_admin(
    State(_state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let is_admin = auth_user
        .claims
        .roles
        .iter()
        .any(|r| r == "super_admin" || r == "admin");

    if !is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}
