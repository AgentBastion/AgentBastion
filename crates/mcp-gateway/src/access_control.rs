use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;
use uuid::Uuid;

/// Key identifying a specific tool on a specific server.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct ToolKey {
    server_id: Uuid,
    tool_name: String,
}

/// A policy entry: if `allowed_roles` is non-empty only users with one of
/// those roles may invoke the tool.  An empty vec means "deny all except
/// super_admin".
#[derive(Debug, Clone)]
struct ToolPolicy {
    allowed_roles: Vec<String>,
}

/// In-memory, tool-level access controller.
///
/// Default behaviour is **allow all**.  Once a policy is set for a specific
/// tool, only users whose roles intersect with the allowed set are granted
/// access.  The special role `"super_admin"` always has access.
#[derive(Clone)]
pub struct AccessController {
    /// Map from (server, tool) → policy.  Absent entries mean "allow all".
    policies: Arc<RwLock<HashMap<ToolKey, ToolPolicy>>>,
}

impl AccessController {
    pub fn new() -> Self {
        Self {
            policies: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check whether a user (identified by `user_id` and their `roles`) is
    /// allowed to call a specific tool on a specific server.
    ///
    /// If no policy has been registered for the tool the call is allowed.
    pub async fn check_tool_access(
        &self,
        _user_id: Uuid,
        server_id: Uuid,
        tool_name: &str,
        user_roles: &[String],
    ) -> bool {
        // Super-admins always pass.
        if user_roles.iter().any(|r| r == "super_admin") {
            return true;
        }

        let policies = self.policies.read().await;
        let key = ToolKey {
            server_id,
            tool_name: tool_name.to_owned(),
        };

        match policies.get(&key) {
            None => true, // no policy → default allow
            Some(policy) if policy.allowed_roles.is_empty() => false,
            Some(policy) => policy
                .allowed_roles
                .iter()
                .any(|allowed| user_roles.contains(allowed)),
        }
    }

    /// Convenience wrapper when the caller only has a `user_id` and no roles
    /// available — defaults to allowing access (no role check).
    pub async fn check_tool_access_by_id(
        &self,
        user_id: Uuid,
        server_id: Uuid,
        tool_name: &str,
    ) -> bool {
        // Without role information we fall back to the policy check with an
        // empty role set.  If a policy exists and requires roles, this will
        // deny.  If no policy exists it will allow.
        self.check_tool_access(user_id, server_id, tool_name, &[])
            .await
    }

    /// Register (or overwrite) a policy for a tool.
    pub async fn set_policy(
        &self,
        server_id: Uuid,
        tool_name: String,
        allowed_roles: Vec<String>,
    ) {
        let mut policies = self.policies.write().await;
        policies.insert(
            ToolKey {
                server_id,
                tool_name,
            },
            ToolPolicy { allowed_roles },
        );
    }

    /// Remove a policy, returning the tool to default-allow behaviour.
    pub async fn remove_policy(&self, server_id: Uuid, tool_name: &str) {
        let mut policies = self.policies.write().await;
        policies.remove(&ToolKey {
            server_id,
            tool_name: tool_name.to_owned(),
        });
    }
}

impl Default for AccessController {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn default_allows_access() {
        let ac = AccessController::new();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let allowed = ac
            .check_tool_access(user_id, server_id, "any_tool", &["developer".into()])
            .await;
        assert!(allowed, "no policy means default allow");
    }

    #[tokio::test]
    async fn set_policy_denies_unauthorized_role() {
        let ac = AccessController::new();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        ac.set_policy(server_id, "dangerous_tool".into(), vec!["admin".into()])
            .await;

        let allowed = ac
            .check_tool_access(
                user_id,
                server_id,
                "dangerous_tool",
                &["developer".into()],
            )
            .await;
        assert!(!allowed, "developer should be denied when policy requires admin");
    }

    #[tokio::test]
    async fn set_policy_allows_authorized_role() {
        let ac = AccessController::new();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        ac.set_policy(server_id, "tool".into(), vec!["admin".into()])
            .await;

        let allowed = ac
            .check_tool_access(user_id, server_id, "tool", &["admin".into()])
            .await;
        assert!(allowed, "admin should be allowed when policy lists admin");
    }

    #[tokio::test]
    async fn super_admin_bypasses_policy() {
        let ac = AccessController::new();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        // Set policy that allows NO roles (empty vec = deny all except super_admin)
        ac.set_policy(server_id, "locked_tool".into(), vec![])
            .await;

        let allowed = ac
            .check_tool_access(
                user_id,
                server_id,
                "locked_tool",
                &["super_admin".into()],
            )
            .await;
        assert!(allowed, "super_admin must always have access");
    }

    #[tokio::test]
    async fn empty_policy_denies_non_super_admin() {
        let ac = AccessController::new();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        ac.set_policy(server_id, "locked_tool".into(), vec![])
            .await;

        let allowed = ac
            .check_tool_access(user_id, server_id, "locked_tool", &["admin".into()])
            .await;
        assert!(!allowed, "empty allowed_roles should deny non-super_admin");
    }
}
