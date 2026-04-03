-- API key lifecycle management columns
ALTER TABLE api_keys ADD COLUMN rotation_period_days INTEGER;
ALTER TABLE api_keys ADD COLUMN rotated_from_id UUID REFERENCES api_keys(id);
ALTER TABLE api_keys ADD COLUMN grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN inactivity_timeout_days INTEGER;
ALTER TABLE api_keys ADD COLUMN disabled_reason VARCHAR(100);
ALTER TABLE api_keys ADD COLUMN last_rotation_at TIMESTAMPTZ;
