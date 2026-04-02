use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SystemRole {
    SuperAdmin,
    Admin,
    TeamManager,
    Developer,
    Viewer,
}

impl SystemRole {
    pub fn as_str(&self) -> &str {
        match self {
            SystemRole::SuperAdmin => "super_admin",
            SystemRole::Admin => "admin",
            SystemRole::TeamManager => "team_manager",
            SystemRole::Developer => "developer",
            SystemRole::Viewer => "viewer",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "super_admin" => Some(SystemRole::SuperAdmin),
            "admin" => Some(SystemRole::Admin),
            "team_manager" => Some(SystemRole::TeamManager),
            "developer" => Some(SystemRole::Developer),
            "viewer" => Some(SystemRole::Viewer),
            _ => None,
        }
    }

    pub fn has_permission(&self, resource: &str, action: &str) -> bool {
        match self {
            SystemRole::SuperAdmin => true,
            SystemRole::Admin => !matches!((resource, action), ("system", "configure_oidc")),
            SystemRole::TeamManager => matches!(
                (resource, action),
                ("ai_gateway", "use")
                    | ("mcp_gateway", "use")
                    | ("api_keys", "read")
                    | ("api_keys", "write")
                    | ("team", "read")
                    | ("team", "write")
                    | ("analytics", "read")
            ),
            SystemRole::Developer => matches!(
                (resource, action),
                ("ai_gateway", "use")
                    | ("mcp_gateway", "use")
                    | ("api_keys", "read")
                    | ("api_keys", "write")
                    | ("analytics", "read")
            ),
            SystemRole::Viewer => matches!(
                (resource, action),
                ("analytics", "read") | ("api_keys", "read")
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn super_admin_has_all_permissions() {
        let role = SystemRole::SuperAdmin;
        assert!(role.has_permission("ai_gateway", "use"));
        assert!(role.has_permission("mcp_gateway", "use"));
        assert!(role.has_permission("system", "configure_oidc"));
        assert!(role.has_permission("analytics", "read"));
        assert!(role.has_permission("team", "write"));
        assert!(role.has_permission("anything", "whatever"));
    }

    #[test]
    fn viewer_can_only_read_analytics_and_api_keys() {
        let role = SystemRole::Viewer;
        assert!(role.has_permission("analytics", "read"));
        assert!(role.has_permission("api_keys", "read"));
        // Should not have write or other access
        assert!(!role.has_permission("ai_gateway", "use"));
        assert!(!role.has_permission("mcp_gateway", "use"));
        assert!(!role.has_permission("api_keys", "write"));
        assert!(!role.has_permission("team", "read"));
        assert!(!role.has_permission("system", "configure_oidc"));
    }

    #[test]
    fn developer_permissions() {
        let role = SystemRole::Developer;
        assert!(role.has_permission("ai_gateway", "use"));
        assert!(role.has_permission("mcp_gateway", "use"));
        assert!(role.has_permission("api_keys", "read"));
        assert!(role.has_permission("api_keys", "write"));
        assert!(role.has_permission("analytics", "read"));
        // Developer should NOT manage teams or configure system
        assert!(!role.has_permission("team", "read"));
        assert!(!role.has_permission("team", "write"));
        assert!(!role.has_permission("system", "configure_oidc"));
    }

    #[test]
    fn role_string_roundtrip() {
        let roles = [
            SystemRole::SuperAdmin,
            SystemRole::Admin,
            SystemRole::TeamManager,
            SystemRole::Developer,
            SystemRole::Viewer,
        ];
        for role in &roles {
            let s = role.as_str();
            let parsed = SystemRole::parse(s);
            assert_eq!(parsed.as_ref(), Some(role), "roundtrip failed for {s}");
        }
    }
}
