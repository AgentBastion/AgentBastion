-- Fine-grained resource constraints for custom roles
-- NULL = unrestricted (access to all), empty array = no access

ALTER TABLE custom_roles
    ADD COLUMN IF NOT EXISTS allowed_models TEXT[],
    ADD COLUMN IF NOT EXISTS allowed_mcp_servers UUID[];

COMMENT ON COLUMN custom_roles.allowed_models IS 'Allowed model IDs (e.g. gpt-4o, claude-sonnet-4-20250514). NULL = all models allowed.';
COMMENT ON COLUMN custom_roles.allowed_mcp_servers IS 'Allowed MCP server UUIDs. NULL = all servers allowed.';
