use agent_bastion_common::errors::AppError;
use fred::clients::Client;
use fred::interfaces::KeysInterface;
use fred::interfaces::SortedSetsInterface;

/// Sliding-window rate limiter backed by Redis sorted sets.
///
/// Two independent windows are maintained per key:
/// - `ratelimit:rpm:{key}` — requests per minute
/// - `ratelimit:tpm:{key}` — tokens per minute (optional)
///
/// Each request is recorded as a sorted-set member scored by its Unix-millis
/// timestamp. Before admitting a request we trim entries older than 60 s,
/// count the remaining members, and reject if the count would exceed the limit.
#[derive(Clone)]
pub struct RateLimiter {
    redis: Client,
}

impl RateLimiter {
    pub fn new(redis: Client) -> Self {
        Self { redis }
    }

    /// Check (and record) a request against the sliding window limits.
    ///
    /// - `key`: an opaque identifier, typically `"{org_id}:{model}"` or an API-key fingerprint.
    /// - `rpm_limit`: maximum requests allowed in any 60-second window.
    /// - `tpm_limit`: optional maximum tokens allowed in any 60-second window.
    /// - `estimated_tokens`: estimated token count for this request (used for TPM check).
    pub async fn check_rate_limit(
        &self,
        key: &str,
        rpm_limit: u32,
        tpm_limit: Option<u32>,
        estimated_tokens: Option<u32>,
    ) -> Result<(), AppError> {
        let now_ms = chrono::Utc::now().timestamp_millis() as f64;
        let window_start = now_ms - 60_000.0;
        let member_id = uuid::Uuid::new_v4().to_string();

        // ---- RPM check ----
        let rpm_key = format!("ratelimit:rpm:{key}");
        self.check_window(&rpm_key, window_start, now_ms, &member_id, 1, rpm_limit)
            .await?;

        // ---- TPM check (optional) ----
        if let (Some(limit), Some(tokens)) = (tpm_limit, estimated_tokens) {
            if tokens > 0 {
                let tpm_key = format!("ratelimit:tpm:{key}");
                // For TPM we add `tokens` identical-score entries. A simpler approach:
                // store the token count in the member value and sum via Lua, but for
                // a sorted-set-only approach we record one member per request and
                // keep a running count by storing tokens as an increment.
                // Here we use a pragmatic approach: one member whose score encodes the
                // timestamp, and we track counts by summing per-member weights.
                // However, ZCARD only counts members, not weights. So we record
                // `tokens` separate members to keep it pure-sorted-set.
                //
                // For efficiency we just add a single member and use a Lua-free
                // approximation: store the token count in the member name and parse
                // it back when counting. But that requires ZRANGEBYSCORE + parsing.
                //
                // Simplest correct approach: one member per token-unit is wasteful.
                // Instead, store "member_id:tokens" and count by summing parsed values.
                self.check_token_window(&tpm_key, window_start, now_ms, &member_id, tokens, limit)
                    .await?;
            }
        }

        Ok(())
    }

    /// RPM-style window: each request = 1 unit.
    async fn check_window(
        &self,
        redis_key: &str,
        window_start: f64,
        now_ms: f64,
        member_id: &str,
        _weight: u32,
        limit: u32,
    ) -> Result<(), AppError> {
        // Remove entries outside the window
        let _: () = self
            .redis
            .zremrangebyscore(redis_key, f64::NEG_INFINITY, window_start)
            .await?;

        // Count current entries in the window
        let count: u64 = self.redis.zcard(redis_key).await?;

        if count >= u64::from(limit) {
            return Err(AppError::RateLimited);
        }

        // Record this request
        let _: () = self
            .redis
            .zadd(redis_key, None, None, false, false, (now_ms, member_id))
            .await?;

        // Set a TTL so keys don't linger forever (slightly longer than the window)
        let _: () = self.redis.expire(redis_key, 120, None).await?;

        Ok(())
    }

    /// TPM-style window: each request carries a token weight.
    /// Members are stored as "member_id:token_count" so we can sum them.
    async fn check_token_window(
        &self,
        redis_key: &str,
        window_start: f64,
        now_ms: f64,
        member_id: &str,
        tokens: u32,
        limit: u32,
    ) -> Result<(), AppError> {
        // Remove entries outside the window
        let _: () = self
            .redis
            .zremrangebyscore(redis_key, f64::NEG_INFINITY, window_start)
            .await?;

        // Retrieve all members in the window to sum their token counts
        let members: Vec<String> = self
            .redis
            .zrangebyscore(redis_key, window_start, f64::INFINITY, false, None)
            .await?;

        let current_tokens: u32 = members
            .iter()
            .filter_map(|m| {
                // member format: "uuid:token_count"
                m.rsplit(':').next().and_then(|s| s.parse::<u32>().ok())
            })
            .sum();

        if current_tokens + tokens > limit {
            return Err(AppError::RateLimited);
        }

        // Record this request with its token count embedded in the member name
        let member_with_tokens = format!("{member_id}:{tokens}");
        let _: () = self
            .redis
            .zadd(
                redis_key,
                None,
                None,
                false,
                false,
                (now_ms, member_with_tokens.as_str()),
            )
            .await?;

        let _: () = self.redis.expire(redis_key, 120, None).await?;

        Ok(())
    }
}
