use axum::Json;
use axum::extract::State;

use agent_bastion_common::errors::AppError;
use agent_bastion_common::models::McpTool;

use crate::app::AppState;
use crate::middleware::auth_guard::AuthUser;

pub async fn list_tools(
    _auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<McpTool>>, AppError> {
    let tools = sqlx::query_as::<_, McpTool>(
        "SELECT * FROM mcp_tools WHERE is_active = true ORDER BY server_id, tool_name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(tools))
}

pub async fn discover_tools(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Path(server_id): axum::extract::Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify server exists
    let _server = sqlx::query_as::<_, agent_bastion_common::models::McpServer>(
        "SELECT * FROM mcp_servers WHERE id = $1",
    )
    .bind(server_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("MCP Server not found".into()))?;

    // In a real implementation, this would connect to the MCP server and call tools/list.
    // For now, return a placeholder response.
    Ok(Json(serde_json::json!({
        "status": "discovery_initiated",
        "server_id": server_id,
    })))
}
