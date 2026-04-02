CREATE TABLE mcp_servers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(255) NOT NULL UNIQUE,
    description           TEXT,
    endpoint_url          VARCHAR(512) NOT NULL,
    transport_type        VARCHAR(50) NOT NULL DEFAULT 'streamable_http',
    auth_type             VARCHAR(50),
    auth_secret_encrypted BYTEA,
    status                VARCHAR(50) NOT NULL DEFAULT 'pending',
    health_check_interval INTEGER DEFAULT 60,
    last_health_check     TIMESTAMPTZ,
    config_json           JSONB DEFAULT '{}',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mcp_tools (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id     UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    tool_name     VARCHAR(255) NOT NULL,
    description   TEXT,
    input_schema  JSONB,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_id, tool_name)
);

CREATE TABLE mcp_tool_permissions (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id   UUID NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
    role_id   UUID REFERENCES roles(id) ON DELETE CASCADE,
    team_id   UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    allowed   BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (role_id IS NOT NULL OR team_id IS NOT NULL OR user_id IS NOT NULL)
);
