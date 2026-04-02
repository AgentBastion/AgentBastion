/// Strip common provider prefixes from a model name.
///
/// Examples:
/// - `"openai/gpt-4o"` -> `"gpt-4o"`
/// - `"anthropic/claude-sonnet-4"` -> `"claude-sonnet-4"`
/// - `"gpt-4o"` -> `"gpt-4o"` (unchanged)
pub fn normalize_model_name(model: &str) -> &str {
    // Strip "provider/" prefix if present
    if let Some(idx) = model.find('/') {
        let prefix = &model[..idx];
        let known_prefixes = [
            "openai",
            "anthropic",
            "google",
            "azure",
            "custom",
            "vertex",
        ];
        if known_prefixes.contains(&prefix) {
            return &model[idx + 1..];
        }
    }
    model
}

/// Detect the likely provider for a model based on its name.
///
/// Returns one of: `"openai"`, `"anthropic"`, `"google"`, or `"unknown"`.
pub fn detect_provider(model: &str) -> &'static str {
    let normalized = normalize_model_name(model).to_lowercase();

    if normalized.starts_with("gpt-")
        || normalized.starts_with("o1")
        || normalized.starts_with("o3")
        || normalized.starts_with("o4")
        || normalized.starts_with("chatgpt")
    {
        return "openai";
    }

    if normalized.starts_with("claude") {
        return "anthropic";
    }

    if normalized.starts_with("gemini") {
        return "google";
    }

    "unknown"
}

/// Extract plain text from a message content value.
///
/// Handles both `"string"` content and the array-of-parts format
/// (`[{"type": "text", "text": "..."}]`).
pub fn extract_text_content(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(parts) => {
            parts
                .iter()
                .filter_map(|part| {
                    if part.get("type").and_then(|t| t.as_str()) == Some("text") {
                        part.get("text").and_then(|t| t.as_str()).map(String::from)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("")
        }
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_known_prefix() {
        assert_eq!(normalize_model_name("openai/gpt-4o"), "gpt-4o");
        assert_eq!(
            normalize_model_name("anthropic/claude-sonnet-4"),
            "claude-sonnet-4"
        );
    }

    #[test]
    fn preserve_unknown_prefix() {
        // "mycompany/my-model" should NOT be stripped since "mycompany" is not known
        assert_eq!(
            normalize_model_name("mycompany/my-model"),
            "mycompany/my-model"
        );
    }

    #[test]
    fn no_prefix() {
        assert_eq!(normalize_model_name("gpt-4o"), "gpt-4o");
    }

    #[test]
    fn detect_providers() {
        assert_eq!(detect_provider("gpt-4o"), "openai");
        assert_eq!(detect_provider("claude-sonnet-4"), "anthropic");
        assert_eq!(detect_provider("gemini-2.0-flash"), "google");
        assert_eq!(detect_provider("llama-3"), "unknown");
    }

    #[test]
    fn text_extraction() {
        let simple = serde_json::json!("hello world");
        assert_eq!(extract_text_content(&simple), "hello world");

        let parts = serde_json::json!([
            {"type": "text", "text": "Hello "},
            {"type": "image_url", "image_url": {"url": "..."}},
            {"type": "text", "text": "world"},
        ]);
        assert_eq!(extract_text_content(&parts), "Hello world");
    }
}
