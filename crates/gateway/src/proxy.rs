use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use std::sync::Arc;

use crate::providers::traits::{ChatCompletionRequest, GatewayError};
use crate::router::ModelRouter;
use crate::streaming::stream_to_sse;

/// Shared application state for the gateway proxy handlers.
#[derive(Clone)]
pub struct GatewayState {
    pub router: Arc<ModelRouter>,
}

/// POST /v1/chat/completions
///
/// Proxies chat completion requests to the appropriate AI provider based
/// on the model name in the request body. Supports both streaming (SSE)
/// and non-streaming (JSON) modes.
pub async fn proxy_chat_completion(
    State(state): State<GatewayState>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<axum::response::Response, GatewayErrorResponse> {
    let provider = state
        .router
        .route(&request.model)
        .ok_or_else(|| GatewayError::ProviderError(format!(
            "No provider found for model: {}", request.model
        )))?;

    let is_stream = request.stream.unwrap_or(false);

    if is_stream {
        let stream = provider.stream_chat_completion(request);
        Ok(stream_to_sse(stream).into_response())
    } else {
        let response = provider.chat_completion_boxed(request).await?;
        Ok(Json(response).into_response())
    }
}

/// GET /v1/models
///
/// Returns the list of available models in OpenAI-compatible format.
pub async fn list_models_handler(
    State(state): State<GatewayState>,
) -> Json<serde_json::Value> {
    let models = state.router.list_models();

    let model_objects: Vec<serde_json::Value> = models
        .into_iter()
        .map(|id| {
            serde_json::json!({
                "id": id,
                "object": "model",
                "created": 0,
                "owned_by": "agent-bastion",
            })
        })
        .collect();

    Json(serde_json::json!({
        "object": "list",
        "data": model_objects,
    }))
}

// ---------- Error adapter ----------

/// Newtype wrapper so we can implement `IntoResponse` for `GatewayError`.
pub struct GatewayErrorResponse(GatewayError);

impl From<GatewayError> for GatewayErrorResponse {
    fn from(err: GatewayError) -> Self {
        Self(err)
    }
}

impl IntoResponse for GatewayErrorResponse {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;

        let (status, error_type) = match &self.0 {
            GatewayError::ProviderError(_) => (StatusCode::BAD_GATEWAY, "provider_error"),
            GatewayError::TransformError(_) => (StatusCode::BAD_REQUEST, "transform_error"),
            GatewayError::NetworkError(_) => (StatusCode::BAD_GATEWAY, "network_error"),
            GatewayError::UpstreamRateLimited => (StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
            GatewayError::UpstreamAuthError => (StatusCode::UNAUTHORIZED, "auth_error"),
        };

        let body = serde_json::json!({
            "error": {
                "message": self.0.to_string(),
                "type": error_type,
            }
        });

        (status, Json(body)).into_response()
    }
}
