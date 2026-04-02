CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource    VARCHAR(100) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    UNIQUE(resource, action)
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope   VARCHAR(255) NOT NULL DEFAULT 'global',
    PRIMARY KEY (user_id, role_id, scope)
);

-- Seed system roles
INSERT INTO roles (name, description, is_system) VALUES
    ('super_admin', 'Full system access', TRUE),
    ('admin', 'Administrative access', TRUE),
    ('team_manager', 'Team management access', TRUE),
    ('developer', 'Standard developer access', TRUE),
    ('viewer', 'Read-only access', TRUE);
