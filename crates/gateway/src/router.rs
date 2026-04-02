use crate::providers::DynAiProvider;
use std::collections::HashMap;
use std::sync::Arc;

/// Routes model names to AI provider implementations.
///
/// Supports exact-match routing (e.g. `"gpt-4o" -> OpenAiProvider`) and
/// prefix-match as a fallback (e.g. `"gpt-" -> OpenAiProvider`).
pub struct ModelRouter {
    /// Exact model name -> provider
    providers: HashMap<String, Arc<dyn DynAiProvider>>,
}

impl Default for ModelRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl ModelRouter {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    /// Register a provider for a given model pattern.
    ///
    /// The pattern is used for both exact and prefix matching.
    /// For example, registering `"gpt-4o"` will match the exact model name,
    /// and registering `"gpt-"` will match any model starting with `"gpt-"`.
    pub fn register_provider(&mut self, model_pattern: &str, provider: Arc<dyn DynAiProvider>) {
        self.providers.insert(model_pattern.to_string(), provider);
    }

    /// Look up the provider for a given model name.
    ///
    /// First tries an exact match, then falls back to the longest prefix match.
    pub fn route(&self, model: &str) -> Option<Arc<dyn DynAiProvider>> {
        // Exact match
        if let Some(provider) = self.providers.get(model) {
            return Some(Arc::clone(provider));
        }

        // Prefix match — pick the longest matching prefix for specificity
        let mut best_match: Option<(&str, &Arc<dyn DynAiProvider>)> = None;

        for (pattern, provider) in &self.providers {
            if model.starts_with(pattern.as_str()) {
                match best_match {
                    Some((current_best, _)) if pattern.len() > current_best.len() => {
                        best_match = Some((pattern.as_str(), provider));
                    }
                    None => {
                        best_match = Some((pattern.as_str(), provider));
                    }
                    _ => {}
                }
            }
        }

        best_match.map(|(_, provider)| Arc::clone(provider))
    }

    /// List all registered model patterns.
    pub fn list_models(&self) -> Vec<String> {
        let mut models: Vec<String> = self.providers.keys().cloned().collect();
        models.sort();
        models
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::traits::*;
    use futures::Stream;
    use std::pin::Pin;

    struct DummyProvider {
        provider_name: String,
    }

    impl AiProvider for DummyProvider {
        fn name(&self) -> &str {
            &self.provider_name
        }

        async fn chat_completion(
            &self,
            _request: ChatCompletionRequest,
        ) -> Result<ChatCompletionResponse, GatewayError> {
            Err(GatewayError::ProviderError("dummy".into()))
        }

        fn stream_chat_completion(
            &self,
            _request: ChatCompletionRequest,
        ) -> Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, GatewayError>> + Send>> {
            Box::pin(futures::stream::empty())
        }
    }

    #[test]
    fn exact_match() {
        let mut router = ModelRouter::new();
        let provider: Arc<dyn DynAiProvider> = Arc::new(DummyProvider {
            provider_name: "openai".into(),
        });
        router.register_provider("gpt-4o", provider);

        let found = router.route("gpt-4o");
        assert!(found.is_some());
        assert_eq!(found.unwrap().name(), "openai");
    }

    #[test]
    fn prefix_match() {
        let mut router = ModelRouter::new();
        let provider: Arc<dyn DynAiProvider> = Arc::new(DummyProvider {
            provider_name: "openai".into(),
        });
        router.register_provider("gpt-", provider);

        let found = router.route("gpt-4o-mini");
        assert!(found.is_some());
        assert_eq!(found.unwrap().name(), "openai");
    }

    #[test]
    fn no_match() {
        let router = ModelRouter::new();
        assert!(router.route("unknown-model").is_none());
    }

    #[test]
    fn longest_prefix_wins() {
        let mut router = ModelRouter::new();
        let generic: Arc<dyn DynAiProvider> = Arc::new(DummyProvider {
            provider_name: "generic".into(),
        });
        let specific: Arc<dyn DynAiProvider> = Arc::new(DummyProvider {
            provider_name: "specific".into(),
        });
        router.register_provider("gpt-", generic);
        router.register_provider("gpt-4o", specific);

        let found = router.route("gpt-4o-mini");
        assert!(found.is_some());
        // "gpt-4o" is a longer prefix than "gpt-" for "gpt-4o-mini"
        assert_eq!(found.unwrap().name(), "specific");
    }
}
