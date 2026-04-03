use axum::http::header;
use axum::response::{IntoResponse, Response};
use metrics_exporter_prometheus::PrometheusHandle;

/// GET /metrics — Prometheus metrics endpoint (unauthenticated, on gateway port).
pub async fn prometheus_metrics(
    axum::extract::State(handle): axum::extract::State<PrometheusHandle>,
) -> Response {
    let body = handle.render();
    ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], body).into_response()
}

/// Install the Prometheus recorder and return the handle for rendering.
pub fn install_prometheus_recorder() -> PrometheusHandle {
    let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
    builder
        .install_recorder()
        .expect("Failed to install Prometheus recorder")
}
