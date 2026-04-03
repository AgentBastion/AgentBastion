-- Dynamic system settings (key-value store, managed via Web UI)
CREATE TABLE system_settings (
    key         VARCHAR(255) PRIMARY KEY,
    value       JSONB NOT NULL,
    category    VARCHAR(100) NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_settings_category ON system_settings(category);

-- Seed defaults for all previously hardcoded values

-- Auth
INSERT INTO system_settings (key, value, category, description) VALUES
('auth.jwt_access_ttl_secs',       '900',   'auth', 'JWT access token lifetime in seconds'),
('auth.jwt_refresh_ttl_days',      '7',     'auth', 'JWT refresh token lifetime in days');

-- Gateway
INSERT INTO system_settings (key, value, category, description) VALUES
('gateway.cache_ttl_secs',         '3600',     'gateway', 'Response cache TTL in seconds'),
('gateway.request_timeout_secs',   '120',      'gateway', 'Gateway request timeout (requires restart)'),
('gateway.body_limit_bytes',       '10485760', 'gateway', 'Gateway max request body size (requires restart)');

-- Console
INSERT INTO system_settings (key, value, category, description) VALUES
('console.request_timeout_secs',   '30',      'console', 'Console API request timeout (requires restart)'),
('console.body_limit_bytes',       '1048576', 'console', 'Console API max request body size (requires restart)');

-- Security
INSERT INTO system_settings (key, value, category, description) VALUES
('security.signature_nonce_ttl_secs', '600', 'security', 'Request signature nonce TTL in seconds'),
('security.signature_drift_secs',    '300', 'security', 'Maximum allowed clock skew for signatures'),
('security.content_filter_patterns', '[
    {"pattern": "ignore previous instructions", "severity": "critical", "category": "instruction_override"},
    {"pattern": "ignore all previous",          "severity": "critical", "category": "instruction_override"},
    {"pattern": "disregard your instructions",  "severity": "critical", "category": "instruction_override"},
    {"pattern": "jailbreak",                    "severity": "critical", "category": "jailbreak"},
    {"pattern": " dan ",                        "severity": "critical", "category": "jailbreak"},
    {"pattern": "developer mode",              "severity": "critical", "category": "jailbreak"},
    {"pattern": "you are now",                 "severity": "high",     "category": "persona_manipulation"},
    {"pattern": "new persona",                 "severity": "high",     "category": "persona_manipulation"},
    {"pattern": "act as",                      "severity": "high",     "category": "persona_manipulation"},
    {"pattern": "pretend to be",               "severity": "high",     "category": "persona_manipulation"},
    {"pattern": "system prompt",               "severity": "medium",   "category": "prompt_extraction"},
    {"pattern": "reveal your instructions",    "severity": "medium",   "category": "prompt_extraction"},
    {"pattern": "what are your rules",         "severity": "medium",   "category": "prompt_extraction"}
]', 'security', 'Content filter deny patterns (JSON array)'),
('security.pii_redactor_patterns', '[
    {"name": "email",       "regex": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",           "placeholder_prefix": "EMAIL"},
    {"name": "id_card_cn",  "regex": "\\b\\d{17}[\\dXx]\\b",                                       "placeholder_prefix": "ID"},
    {"name": "credit_card", "regex": "\\b\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b",        "placeholder_prefix": "CARD"},
    {"name": "phone_cn",    "regex": "1[3-9]\\d{9}",                                                "placeholder_prefix": "PHONE"},
    {"name": "phone_us",    "regex": "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",                          "placeholder_prefix": "PHONE"},
    {"name": "ipv4",        "regex": "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b",             "placeholder_prefix": "IP"}
]', 'security', 'PII redactor patterns (JSON array)');

-- Audit
INSERT INTO system_settings (key, value, category, description) VALUES
('audit.batch_size',           '50',    'audit', 'Quickwit batch flush size'),
('audit.flush_interval_secs',  '2',     'audit', 'Quickwit batch flush interval in seconds'),
('audit.channel_capacity',     '10000', 'audit', 'Audit log channel buffer capacity');

-- Budget
INSERT INTO system_settings (key, value, category, description) VALUES
('budget.alert_thresholds',    '[0.50, 0.80, 0.95]', 'budget', 'Budget alert threshold percentages'),
('budget.webhook_url',         'null',                'budget', 'Budget alert webhook URL');

-- API Keys
INSERT INTO system_settings (key, value, category, description) VALUES
('api_keys.default_expiry_days',          '90',  'api_keys', 'Default API key expiration in days (0 = no expiry)'),
('api_keys.inactivity_timeout_days',      '0',   'api_keys', 'Auto-disable after N days of inactivity (0 = disabled)'),
('api_keys.rotation_period_days',         '0',   'api_keys', 'Auto-rotation period in days (0 = disabled)'),
('api_keys.rotation_grace_period_hours',  '24',  'api_keys', 'Grace period for old key after rotation');

-- Data retention
INSERT INTO system_settings (key, value, category, description) VALUES
('data.retention_days_usage',  '90',  'data', 'Days to keep usage records (0 = forever)'),
('data.retention_days_audit',  '365', 'data', 'Days to keep audit logs (0 = forever)');

-- Setup
INSERT INTO system_settings (key, value, category, description) VALUES
('setup.initialized',  'false',           'setup', 'Whether initial setup has been completed'),
('setup.site_name',    '"AgentBastion"',   'setup', 'Site display name');
