use crate::providers::traits::{ChatCompletionChunk, GatewayError};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::StreamExt;
use futures::Stream;
use std::convert::Infallible;
use std::pin::Pin;

/// Converts a stream of `ChatCompletionChunk` results into an Axum SSE response.
///
/// Each chunk is serialized as `data: {json}\n\n`. When the source stream ends,
/// a final `data: [DONE]\n\n` event is emitted to signal completion (matching
/// the OpenAI streaming protocol).
pub fn stream_to_sse(
    stream: Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, GatewayError>> + Send>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mapped = stream.map(|result| match result {
        Ok(chunk) => {
            let json = serde_json::to_string(&chunk).unwrap_or_default();
            Ok(Event::default().data(json))
        }
        Err(e) => {
            tracing::warn!("Stream error, forwarding as SSE error event: {e}");
            let error_json = serde_json::json!({
                "error": {
                    "message": e.to_string(),
                    "type": "stream_error"
                }
            });
            Ok(Event::default().data(error_json.to_string()))
        }
    });

    // Append the [DONE] sentinel after the data stream ends
    let with_done = mapped.chain(futures::stream::once(async {
        Ok::<Event, Infallible>(Event::default().data("[DONE]"))
    }));

    Sse::new(with_done).keep_alive(KeepAlive::default())
}
