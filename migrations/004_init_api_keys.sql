CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_prefix      VARCHAR(16) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
    scopes          JSONB NOT NULL DEFAULT '[]',
    allowed_models  TEXT[],
    rate_limit_rpm  INTEGER,
    rate_limit_tpm  INTEGER,
    monthly_budget  DECIMAL(12, 4),
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
