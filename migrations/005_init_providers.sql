CREATE TABLE providers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL,
    display_name      VARCHAR(255) NOT NULL,
    provider_type     VARCHAR(50) NOT NULL,
    base_url          VARCHAR(512) NOT NULL,
    api_key_encrypted BYTEA NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    config_json       JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_id      VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255) NOT NULL,
    input_price   DECIMAL(10, 6),
    output_price  DECIMAL(10, 6),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(provider_id, model_id)
);

CREATE TABLE model_permissions (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id  UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    role_id   UUID REFERENCES roles(id) ON DELETE CASCADE,
    team_id   UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    allowed   BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (role_id IS NOT NULL OR team_id IS NOT NULL OR user_id IS NOT NULL)
);
