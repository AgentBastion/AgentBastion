use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use serde_json::{Value, json};

use crate::app::AppState;

pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
    }))
}

/// GET /health/live — simple liveness probe (process is alive).
pub async fn liveness() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

/// GET /health/ready — readiness probe, checks critical dependencies.
pub async fn readiness(State(state): State<AppState>) -> Response {
    let pg_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();

    let redis_ok: bool = {
        use fred::interfaces::ClientLike;
        state.redis.ping::<String>(None).await.is_ok()
    };

    if pg_ok && redis_ok {
        Json(json!({ "status": "ready", "postgres": true, "redis": true })).into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "not_ready", "postgres": pg_ok, "redis": redis_ok })),
        )
            .into_response()
    }
}

/// GET /api/auth/sso/status — public, returns whether SSO is enabled (no auth required).
pub async fn sso_status(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "enabled": state.config.oidc_enabled(),
    }))
}

#[derive(Debug, Serialize)]
pub struct ServiceHealth {
    pub postgres: bool,
    pub redis: bool,
    pub quickwit: bool,
    pub pg_latency_ms: Option<i64>,
    pub redis_latency_ms: Option<i64>,
    pub quickwit_latency_ms: Option<i64>,
    pub pool_idle: u32,
    pub pool_active: u32,
    pub uptime_seconds: i64,
}

/// GET /api/health — detailed health check with latency info.
pub async fn api_health_check(State(state): State<AppState>) -> Response {
    // PostgreSQL
    let pg_start = std::time::Instant::now();
    let pg_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();
    let pg_latency = pg_start.elapsed().as_millis() as i64;

    // Redis
    let redis_start = std::time::Instant::now();
    let redis_ok: bool = {
        use fred::interfaces::ClientLike;
        state.redis.ping::<String>(None).await.is_ok()
    };
    let redis_latency = redis_start.elapsed().as_millis() as i64;

    // Quickwit
    let (qw_ok, qw_latency) = if let Some(ref url) = state.config.quickwit_url {
        let qw_start = std::time::Instant::now();
        let client = reqwest::Client::new();
        let mut req = client.get(format!("{url}/health/readyz"));
        if let Some(ref token) = state.config.quickwit_bearer_token {
            req = req.header("Authorization", format!("Bearer {token}"));
        }
        let ok = req
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        (ok, Some(qw_start.elapsed().as_millis() as i64))
    } else {
        (false, None)
    };

    // Pool stats
    let pool_size = state.db.size() as u64;
    let pool_idle = state.db.num_idle() as u64;

    let uptime = (chrono::Utc::now() - state.started_at).num_seconds();

    let health = ServiceHealth {
        postgres: pg_ok,
        redis: redis_ok,
        quickwit: qw_ok,
        pg_latency_ms: if pg_ok { Some(pg_latency) } else { None },
        redis_latency_ms: if redis_ok { Some(redis_latency) } else { None },
        quickwit_latency_ms: qw_latency,
        pool_idle: pool_idle as u32,
        pool_active: pool_size.saturating_sub(pool_idle) as u32,
        uptime_seconds: uptime,
    };

    if pg_ok && redis_ok {
        Json(health).into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(health)).into_response()
    }
}
