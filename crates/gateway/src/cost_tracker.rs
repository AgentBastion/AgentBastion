/// Tracks and calculates costs for AI API calls based on per-model pricing.
///
/// Prices are in USD per 1 million tokens.
pub struct CostTracker {
    /// (model_pattern, input_price_per_1m, output_price_per_1m)
    price_table: Vec<(&'static str, f64, f64)>,
}

impl Default for CostTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl CostTracker {
    pub fn new() -> Self {
        // Prices in USD per 1M tokens: (model_prefix, input, output)
        let price_table = vec![
            // OpenAI models
            ("gpt-4o-mini", 0.15, 0.60),
            ("gpt-4o", 2.50, 10.00),
            ("gpt-4-turbo", 10.00, 30.00),
            ("gpt-4", 30.00, 60.00),
            ("gpt-3.5-turbo", 0.50, 1.50),
            ("o1-mini", 3.00, 12.00),
            ("o1-preview", 15.00, 60.00),
            ("o1", 15.00, 60.00),
            ("o3-mini", 1.10, 4.40),
            // Anthropic models
            ("claude-sonnet-4", 3.00, 15.00),
            ("claude-3-5-sonnet", 3.00, 15.00),
            ("claude-3-5-haiku", 0.80, 4.00),
            ("claude-3-opus", 15.00, 75.00),
            ("claude-3-haiku", 0.25, 1.25),
            ("claude-3-sonnet", 3.00, 15.00),
            ("claude-haiku", 0.80, 4.00),
            ("claude-opus", 15.00, 75.00),
            // Google models
            ("gemini-1.5-pro", 3.50, 10.50),
            ("gemini-1.5-flash", 0.075, 0.30),
            ("gemini-2.0-flash", 0.10, 0.40),
            ("gemini-2.5-pro", 1.25, 10.00),
        ];

        Self { price_table }
    }

    /// Calculate the cost in USD for a given model and token counts.
    ///
    /// Looks up the model in the price table using prefix matching.
    /// Returns 0.0 if the model is not found.
    pub fn calculate_cost(&self, model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
        let (input_price, output_price) = self.lookup_price(model);

        let input_cost = (f64::from(input_tokens) / 1_000_000.0) * input_price;
        let output_cost = (f64::from(output_tokens) / 1_000_000.0) * output_price;

        input_cost + output_cost
    }

    /// Look up the per-1M-token prices for a model.
    /// Returns (input_price, output_price) or (0.0, 0.0) if not found.
    fn lookup_price(&self, model: &str) -> (f64, f64) {
        let model_lower = model.to_lowercase();

        for &(pattern, input, output) in &self.price_table {
            if model_lower.starts_with(pattern) || model_lower.contains(pattern) {
                return (input, output);
            }
        }

        tracing::debug!("No pricing found for model: {model}");
        (0.0, 0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpt4o_cost() {
        let tracker = CostTracker::new();
        // 1000 input + 500 output tokens on gpt-4o
        // input: 1000/1M * 2.50 = 0.0025
        // output: 500/1M * 10.00 = 0.005
        let cost = tracker.calculate_cost("gpt-4o", 1000, 500);
        assert!((cost - 0.0075).abs() < 1e-9, "got {cost}");
    }

    #[test]
    fn gpt4o_mini_matches_before_gpt4o() {
        let tracker = CostTracker::new();
        let cost = tracker.calculate_cost("gpt-4o-mini", 1_000_000, 0);
        assert!((cost - 0.15).abs() < 1e-9, "got {cost}");
    }

    #[test]
    fn unknown_model_returns_zero() {
        let tracker = CostTracker::new();
        let cost = tracker.calculate_cost("some-unknown-model", 1000, 1000);
        assert!((cost - 0.0).abs() < 1e-9);
    }

    #[test]
    fn claude_sonnet_cost() {
        let tracker = CostTracker::new();
        let cost = tracker.calculate_cost("claude-sonnet-4-20250514", 1_000_000, 1_000_000);
        // input: 3.00, output: 15.00 -> 18.00
        assert!((cost - 18.0).abs() < 1e-9, "got {cost}");
    }
}
