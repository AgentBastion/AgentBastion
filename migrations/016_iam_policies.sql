-- AWS IAM-style policy documents for custom roles
-- Adds a JSONB policy_document column to custom_roles for flexible permission control.
--
-- Policy document format:
-- {
--   "Version": "2024-01-01",
--   "Statement": [
--     {
--       "Sid": "AllowGateway",
--       "Effect": "Allow",
--       "Action": ["ai_gateway:use", "mcp_gateway:use"],
--       "Resource": ["*"]
--     },
--     {
--       "Sid": "DenyProviderWrite",
--       "Effect": "Deny",
--       "Action": ["providers:write"],
--       "Resource": ["*"]
--     }
--   ]
-- }
--
-- Actions use the existing "resource:action" format (e.g. "ai_gateway:use").
-- Wildcard "*" matches all actions/resources.
-- Glob patterns supported: "providers:*" matches all provider actions.
-- Resource ARNs: "*", "model:<id>", "mcp_server:<uuid>", "team:<uuid>".
-- Deny always overrides Allow (explicit deny wins).

ALTER TABLE custom_roles
    ADD COLUMN IF NOT EXISTS policy_document JSONB;

COMMENT ON COLUMN custom_roles.policy_document IS 'AWS IAM-style JSON policy document. When present, takes precedence over legacy permission checkboxes.';
