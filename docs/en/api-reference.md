**[English](../en/api-reference.md) | [中文](../zh-CN/api-reference.md)**

# AgentBastion API Reference

This document provides a complete reference for every HTTP endpoint exposed by AgentBastion. The platform runs two servers:

| Server  | Default Port | Purpose                        |
| ------- | ------------ | ------------------------------ |
| Gateway | 3000         | AI model proxy, MCP transport  |
| Console | 3001         | Management UI and admin APIs   |

---

## Authentication Schemes

| Scheme   | Header                          | Used By            |
| -------- | ------------------------------- | ------------------ |
| API Key  | `Authorization: Bearer ab-...`  | Gateway & Console  |
| JWT      | `Authorization: Bearer <token>` | Console & Gateway  |
| Public   | _(none)_                        | Health endpoints   |

The gateway accepts **either** an API key or a JWT. Console management endpoints require a JWT unless otherwise noted. Admin endpoints additionally require the `admin` role.

---

## Gateway Endpoints (port 3000)

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint. Proxies requests to the configured upstream provider.

**Authentication:** API Key or JWT

#### Request Body

```json
{
  "model": "string",
  "messages": [
    {
      "role": "system" | "user" | "assistant",
      "content": "string"
    }
  ],
  "temperature": 0.7,
  "top_p": 1.0,
  "max_tokens": 4096,
  "stream": false,
  "stop": ["string"],
  "presence_penalty": 0.0,
  "frequency_penalty": 0.0
}
```

| Field               | Type            | Required | Default | Description                              |
| ------------------- | --------------- | -------- | ------- | ---------------------------------------- |
| `model`             | string          | Yes      | —       | Model identifier (e.g. `gpt-4o`)        |
| `messages`          | array\<object\> | Yes      | —       | Conversation history                     |
| `messages[].role`   | string          | Yes      | —       | One of `system`, `user`, `assistant`     |
| `messages[].content`| string          | Yes      | —       | Message text                             |
| `temperature`       | number          | No       | 0.7     | Sampling temperature (0.0 – 2.0)        |
| `top_p`             | number          | No       | 1.0     | Nucleus sampling                         |
| `max_tokens`        | integer         | No       | —       | Maximum tokens to generate               |
| `stream`            | boolean         | No       | false   | Enable Server-Sent Events streaming      |
| `stop`              | array\<string\> | No       | —       | Stop sequences                           |
| `presence_penalty`  | number          | No       | 0.0     | Presence penalty (-2.0 – 2.0)           |
| `frequency_penalty` | number          | No       | 0.0     | Frequency penalty (-2.0 – 2.0)          |

#### Response Body (non-streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1711929600,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}
```

#### Response Body (streaming, `stream: true`)

The response is a stream of `text/event-stream` SSE events:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711929600,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711929600,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: [DONE]
```

#### Example

```bash
# Non-streaming
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer ab-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Streaming
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer ab-your-api-key" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

#### Error Responses

| Status | Body                                                                 | Condition                        |
| ------ | -------------------------------------------------------------------- | -------------------------------- |
| 401    | `{"error": {"message": "Missing or invalid API key", "type": "authentication_error"}}` | Missing/invalid credentials |
| 403    | `{"error": {"message": "Model not allowed", "type": "permission_error"}}` | API key does not permit this model |
| 404    | `{"error": {"message": "Model not found", "type": "not_found_error"}}` | No provider configured for model |
| 429    | `{"error": {"message": "Rate limit exceeded", "type": "rate_limit_error"}}` | RPM limit reached for this key |
| 502    | `{"error": {"message": "Upstream provider error", "type": "upstream_error"}}` | Provider returned an error |

---

### GET /v1/models

List all models available through the gateway.

**Authentication:** API Key or JWT

#### Request

No request body. No query parameters.

#### Response Body

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1711929600,
      "owned_by": "openai"
    },
    {
      "id": "claude-sonnet-4-20250514",
      "object": "model",
      "created": 1711929600,
      "owned_by": "anthropic"
    }
  ]
}
```

#### Example

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer ab-your-api-key"
```

#### Error Responses

| Status | Condition            |
| ------ | -------------------- |
| 401    | Invalid credentials  |

---

### POST /mcp

MCP (Model Context Protocol) Streamable HTTP transport endpoint. Accepts JSON-RPC 2.0 requests and routes them to registered MCP servers.

**Authentication:** API Key or JWT

#### Request Body

Standard JSON-RPC 2.0 envelope:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {}
  }
}
```

Common methods:

| Method              | Description                        |
| ------------------- | ---------------------------------- |
| `initialize`        | Initialize session, negotiate capabilities |
| `tools/list`        | List available MCP tools           |
| `tools/call`        | Invoke a tool                      |
| `resources/list`    | List available resources           |
| `resources/read`    | Read a resource                    |
| `prompts/list`      | List available prompts             |

#### Response Headers

| Header           | Description                                   |
| ---------------- | --------------------------------------------- |
| `Mcp-Session-Id` | Session identifier (returned on `initialize`) |

#### Response Body

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool output here"
      }
    ]
  }
}
```

#### Example

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer ab-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": {"name": "my-client", "version": "1.0.0"}
    }
  }'

# Call a tool (include session ID from initialize response)
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer ab-your-api-key" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: session-uuid-here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {"name": "search_docs", "arguments": {"query": "setup guide"}}
  }'
```

#### Error Responses

| Status | Condition                                |
| ------ | ---------------------------------------- |
| 401    | Invalid credentials                      |
| 400    | Malformed JSON-RPC request               |
| 404    | MCP session not found (invalid session)  |
| 502    | Upstream MCP server unreachable          |

---

### DELETE /mcp

Close an MCP session and release associated resources.

**Authentication:** API Key or JWT

#### Request Headers

| Header           | Required | Description          |
| ---------------- | -------- | -------------------- |
| `Mcp-Session-Id` | Yes      | Session to terminate |

#### Response

```
HTTP/1.1 204 No Content
```

#### Example

```bash
curl -X DELETE http://localhost:3000/mcp \
  -H "Authorization: Bearer ab-your-api-key" \
  -H "Mcp-Session-Id: session-uuid-here"
```

#### Error Responses

| Status | Condition                    |
| ------ | ---------------------------- |
| 401    | Invalid credentials          |
| 404    | Session not found or expired |

---

### GET /health

Basic gateway health check.

**Authentication:** Public

#### Response Body

```json
{
  "status": "ok"
}
```

#### Example

```bash
curl http://localhost:3000/health
```

---

## Console Endpoints (port 3001)

### Authentication

#### POST /api/auth/login

Authenticate with email and password to receive JWT tokens.

**Authentication:** Public

#### Request Body

```json
{
  "email": "string",
  "password": "string"
}
```

| Field      | Type   | Required | Description        |
| ---------- | ------ | -------- | ------------------ |
| `email`    | string | Yes      | User email address |
| `password` | string | Yes      | User password      |

#### Response Body

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Jane Doe",
    "role": "user"
  }
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secret"}'
```

#### Error Responses

| Status | Condition                   |
| ------ | --------------------------- |
| 401    | Invalid email or password   |
| 422    | Missing required fields     |
| 429    | Too many login attempts     |

---

#### POST /api/auth/register

Create a new user account.

**Authentication:** Public

#### Request Body

```json
{
  "email": "string",
  "display_name": "string",
  "password": "string"
}
```

| Field          | Type   | Required | Description                  |
| -------------- | ------ | -------- | ---------------------------- |
| `email`        | string | Yes      | Unique email address         |
| `display_name` | string | Yes      | Display name                 |
| `password`     | string | Yes      | Password (minimum 8 chars)   |

#### Response Body

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Jane Doe",
  "role": "user",
  "created_at": "2026-01-15T10:30:00Z"
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "display_name": "New User",
    "password": "strongpassword123"
  }'
```

#### Error Responses

| Status | Condition                      |
| ------ | ------------------------------ |
| 409    | Email already registered       |
| 422    | Validation error (weak password, invalid email) |

---

#### POST /api/auth/refresh

Exchange a refresh token for a new access/refresh token pair.

**Authentication:** Public (requires valid refresh token)

#### Request Body

```json
{
  "refresh_token": "string"
}
```

#### Response Body

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOi..."}'
```

#### Error Responses

| Status | Condition                          |
| ------ | ---------------------------------- |
| 401    | Invalid or expired refresh token   |

---

#### GET /api/auth/sso/authorize

Initiates an OIDC Authorization Code flow. Redirects the user's browser to the configured identity provider.

**Authentication:** Public

#### Query Parameters

None. The server generates a random `state` and `nonce`, stores them in Redis, and constructs the OIDC authorization URL.

#### Response

```
HTTP/1.1 302 Found
Location: https://idp.example.com/authorize?client_id=...&redirect_uri=...&state=...&nonce=...&scope=openid+email+profile&response_type=code
```

#### Example

```bash
# Typically opened in a browser, not curl
curl -v http://localhost:3001/api/auth/sso/authorize
```

---

#### GET /api/auth/sso/callback

OIDC callback endpoint. The identity provider redirects here after user authentication.

**Authentication:** Public

#### Query Parameters

| Parameter | Type   | Required | Description                          |
| --------- | ------ | -------- | ------------------------------------ |
| `code`    | string | Yes      | Authorization code from the provider |
| `state`   | string | Yes      | CSRF state parameter                 |

#### Response Body

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "sso-user@corp.com",
    "display_name": "SSO User",
    "role": "user"
  }
}
```

#### Error Responses

| Status | Condition                              |
| ------ | -------------------------------------- |
| 400    | Missing code or state                  |
| 401    | Invalid state (CSRF check failed)      |
| 401    | Token exchange failed with IdP         |
| 500    | OIDC not configured                    |

---

#### GET /api/auth/me

Return the currently authenticated user's profile.

**Authentication:** JWT

#### Response Body

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Jane Doe",
  "role": "user",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-03-20T14:00:00Z"
}
```

#### Example

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOi..."
```

#### Error Responses

| Status | Condition              |
| ------ | ---------------------- |
| 401    | Missing or invalid JWT |

---

### API Keys

#### GET /api/keys

List all API keys belonging to the authenticated user.

**Authentication:** JWT

#### Response Body

```json
[
  {
    "id": "uuid",
    "name": "Production Key",
    "prefix": "ab-prod",
    "allowed_models": ["gpt-4o", "claude-sonnet-4-20250514"],
    "rate_limit_rpm": 60,
    "expires_at": "2026-06-01T00:00:00Z",
    "created_at": "2026-01-15T10:30:00Z",
    "last_used_at": "2026-03-28T09:15:00Z"
  }
]
```

> **Note:** The full key value is never returned after creation. Only the `prefix` is shown for identification.

#### Example

```bash
curl http://localhost:3001/api/keys \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### POST /api/keys

Create a new API key.

**Authentication:** JWT

#### Request Body

```json
{
  "name": "string",
  "allowed_models": ["string"],
  "rate_limit_rpm": 60,
  "expires_in_days": 90
}
```

| Field             | Type            | Required | Default   | Description                                  |
| ----------------- | --------------- | -------- | --------- | -------------------------------------------- |
| `name`            | string          | Yes      | —         | Human-readable name                          |
| `allowed_models`  | array\<string\> | No       | all       | Restrict key to specific models              |
| `rate_limit_rpm`  | integer         | No       | unlimited | Requests per minute limit                    |
| `expires_in_days` | integer         | No       | no expiry | Number of days until the key expires         |

#### Response Body

```json
{
  "id": "uuid",
  "name": "Production Key",
  "key": "ab-sk-a1b2c3d4e5f6...",
  "allowed_models": ["gpt-4o"],
  "rate_limit_rpm": 60,
  "expires_at": "2026-06-01T00:00:00Z",
  "created_at": "2026-03-28T10:00:00Z"
}
```

> **Important:** The `key` field is only returned once at creation time. Store it securely.

#### Example

```bash
curl -X POST http://localhost:3001/api/keys \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "allowed_models": ["gpt-4o"],
    "rate_limit_rpm": 120,
    "expires_in_days": 30
  }'
```

#### Error Responses

| Status | Condition              |
| ------ | ---------------------- |
| 401    | Invalid JWT            |
| 422    | Validation error       |

---

#### GET /api/keys/{id}

Retrieve details for a specific API key.

**Authentication:** JWT

#### Path Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `id`      | UUID | Key ID      |

#### Response Body

```json
{
  "id": "uuid",
  "name": "Production Key",
  "prefix": "ab-prod",
  "allowed_models": ["gpt-4o"],
  "rate_limit_rpm": 60,
  "expires_at": "2026-06-01T00:00:00Z",
  "created_at": "2026-01-15T10:30:00Z",
  "last_used_at": "2026-03-28T09:15:00Z"
}
```

#### Error Responses

| Status | Condition                       |
| ------ | ------------------------------- |
| 401    | Invalid JWT                     |
| 404    | Key not found or not owned by user |

---

#### DELETE /api/keys/{id}

Revoke an API key. This is irreversible.

**Authentication:** JWT

#### Path Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `id`      | UUID | Key ID      |

#### Response

```
HTTP/1.1 204 No Content
```

#### Example

```bash
curl -X DELETE http://localhost:3001/api/keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

#### Error Responses

| Status | Condition                          |
| ------ | ---------------------------------- |
| 401    | Invalid JWT                        |
| 404    | Key not found or not owned by user |

---

### Admin — Providers

#### GET /api/admin/providers

List all configured AI providers.

**Authentication:** JWT (Admin)

#### Response Body

```json
[
  {
    "id": "uuid",
    "name": "openai-prod",
    "display_name": "OpenAI Production",
    "provider_type": "openai",
    "base_url": "https://api.openai.com/v1",
    "is_active": true,
    "created_at": "2026-01-10T08:00:00Z"
  }
]
```

> **Note:** The provider `api_key` is never returned in responses.

#### Example

```bash
curl http://localhost:3001/api/admin/providers \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### POST /api/admin/providers

Register a new upstream AI provider.

**Authentication:** JWT (Admin)

#### Request Body

```json
{
  "name": "string",
  "display_name": "string",
  "provider_type": "string",
  "base_url": "string",
  "api_key": "string"
}
```

| Field           | Type   | Required | Description                                          |
| --------------- | ------ | -------- | ---------------------------------------------------- |
| `name`          | string | Yes      | Unique slug identifier (e.g. `openai-prod`)          |
| `display_name`  | string | Yes      | Human-readable name                                  |
| `provider_type` | string | Yes      | One of `openai`, `anthropic`, `azure`, `custom`      |
| `base_url`      | string | Yes      | Provider API base URL                                |
| `api_key`       | string | Yes      | Provider API key (encrypted at rest with AES-256-GCM)|

#### Response Body

```json
{
  "id": "uuid",
  "name": "openai-prod",
  "display_name": "OpenAI Production",
  "provider_type": "openai",
  "base_url": "https://api.openai.com/v1",
  "is_active": true,
  "created_at": "2026-03-28T10:00:00Z"
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/admin/providers \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "anthropic-prod",
    "display_name": "Anthropic Production",
    "provider_type": "anthropic",
    "base_url": "https://api.anthropic.com",
    "api_key": "sk-ant-..."
  }'
```

#### Error Responses

| Status | Condition                    |
| ------ | ---------------------------- |
| 401    | Invalid JWT                  |
| 403    | User is not an admin         |
| 409    | Provider name already exists |
| 422    | Validation error             |

---

#### GET /api/admin/providers/{id}

Retrieve details for a specific provider.

**Authentication:** JWT (Admin)

#### Path Parameters

| Parameter | Type | Description  |
| --------- | ---- | ------------ |
| `id`      | UUID | Provider ID  |

#### Response Body

Same schema as individual item in the list response.

#### Error Responses

| Status | Condition          |
| ------ | ------------------ |
| 401    | Invalid JWT        |
| 403    | Not an admin       |
| 404    | Provider not found |

---

#### DELETE /api/admin/providers/{id}

Remove a provider. Existing keys referencing its models will no longer resolve.

**Authentication:** JWT (Admin)

#### Response

```
HTTP/1.1 204 No Content
```

#### Example

```bash
curl -X DELETE http://localhost:3001/api/admin/providers/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

#### Error Responses

| Status | Condition          |
| ------ | ------------------ |
| 401    | Invalid JWT        |
| 403    | Not an admin       |
| 404    | Provider not found |

---

### Admin — Users

#### GET /api/admin/users

List all users in the system.

**Authentication:** JWT (Admin)

#### Response Body

```json
[
  {
    "id": "uuid",
    "email": "admin@example.com",
    "display_name": "Admin User",
    "role": "admin",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-03-15T12:00:00Z"
  }
]
```

#### Example

```bash
curl http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### POST /api/admin/users

Create a new user (admin-provisioned).

**Authentication:** JWT (Admin)

#### Request Body

```json
{
  "email": "string",
  "display_name": "string",
  "password": "string",
  "role": "string"
}
```

| Field          | Type   | Required | Default  | Description                                    |
| -------------- | ------ | -------- | -------- | ---------------------------------------------- |
| `email`        | string | Yes      | —        | Unique email address                           |
| `display_name` | string | Yes      | —        | Display name                                   |
| `password`     | string | Yes      | —        | Initial password                               |
| `role`         | string | No       | `user`   | One of `admin`, `operator`, `user`, `viewer`, `service` |

#### Response Body

```json
{
  "id": "uuid",
  "email": "newadmin@example.com",
  "display_name": "New Admin",
  "role": "admin",
  "created_at": "2026-03-28T10:00:00Z"
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@example.com",
    "display_name": "Ops User",
    "password": "securepassword",
    "role": "operator"
  }'
```

#### Error Responses

| Status | Condition                |
| ------ | ------------------------ |
| 401    | Invalid JWT              |
| 403    | Not an admin             |
| 409    | Email already exists     |
| 422    | Validation error         |

---

### Admin — MCP Servers

#### GET /api/mcp/servers

List all registered MCP servers.

**Authentication:** JWT (Admin)

#### Response Body

```json
[
  {
    "id": "uuid",
    "name": "docs-search",
    "description": "Internal documentation search",
    "endpoint_url": "https://mcp.internal.corp/docs",
    "transport_type": "streamable_http",
    "auth_type": "bearer",
    "is_active": true,
    "tool_count": 3,
    "created_at": "2026-02-01T08:00:00Z"
  }
]
```

#### Example

```bash
curl http://localhost:3001/api/mcp/servers \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### POST /api/mcp/servers

Register a new MCP server.

**Authentication:** JWT (Admin)

#### Request Body

```json
{
  "name": "string",
  "description": "string",
  "endpoint_url": "string",
  "transport_type": "string",
  "auth_type": "string",
  "auth_secret": "string"
}
```

| Field            | Type   | Required | Default            | Description                                     |
| ---------------- | ------ | -------- | ------------------ | ----------------------------------------------- |
| `name`           | string | Yes      | —                  | Unique server name                              |
| `description`    | string | No       | —                  | Human-readable description                      |
| `endpoint_url`   | string | Yes      | —                  | MCP server URL                                  |
| `transport_type` | string | No       | `streamable_http`  | Transport: `streamable_http` or `sse`           |
| `auth_type`      | string | No       | `none`             | Auth method: `none`, `bearer`, `header`, `query`|
| `auth_secret`    | string | No       | —                  | Auth credential (encrypted at rest)             |

#### Response Body

```json
{
  "id": "uuid",
  "name": "docs-search",
  "description": "Internal documentation search",
  "endpoint_url": "https://mcp.internal.corp/docs",
  "transport_type": "streamable_http",
  "auth_type": "bearer",
  "is_active": true,
  "created_at": "2026-03-28T10:00:00Z"
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/mcp/servers \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jira-tools",
    "description": "Jira issue management tools",
    "endpoint_url": "https://mcp.internal.corp/jira",
    "auth_type": "bearer",
    "auth_secret": "mcp-server-token-here"
  }'
```

#### Error Responses

| Status | Condition                     |
| ------ | ----------------------------- |
| 401    | Invalid JWT                   |
| 403    | Not an admin                  |
| 409    | Server name already exists    |
| 422    | Validation error              |

---

#### GET /api/mcp/servers/{id}

Retrieve details for a specific MCP server.

**Authentication:** JWT (Admin)

#### Path Parameters

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `id`      | UUID | MCP server ID  |

#### Response Body

Same schema as individual item in the list response.

---

#### DELETE /api/mcp/servers/{id}

Remove an MCP server registration. Active sessions will be terminated.

**Authentication:** JWT (Admin)

#### Response

```
HTTP/1.1 204 No Content
```

#### Example

```bash
curl -X DELETE http://localhost:3001/api/mcp/servers/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### POST /api/mcp/servers/{id}/discover

Trigger tool discovery on an MCP server. Connects to the server, calls `tools/list`, and stores the discovered tools in the database.

**Authentication:** JWT (Admin)

#### Path Parameters

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `id`      | UUID | MCP server ID  |

#### Response Body

```json
{
  "server_id": "uuid",
  "tools_discovered": 5,
  "tools": [
    {
      "name": "search_issues",
      "description": "Search Jira issues by JQL",
      "input_schema": {
        "type": "object",
        "properties": {
          "jql": {"type": "string"}
        },
        "required": ["jql"]
      }
    }
  ]
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/mcp/servers/550e8400-e29b-41d4-a716-446655440000/discover \
  -H "Authorization: Bearer eyJhbGciOi..."
```

#### Error Responses

| Status | Condition                       |
| ------ | ------------------------------- |
| 401    | Invalid JWT                     |
| 403    | Not an admin                    |
| 404    | Server not found                |
| 502    | Could not connect to MCP server |

---

### MCP Tools

#### GET /api/mcp/tools

List all discovered MCP tools across all registered servers.

**Authentication:** JWT

#### Response Body

```json
[
  {
    "id": "uuid",
    "server_id": "uuid",
    "server_name": "jira-tools",
    "name": "search_issues",
    "description": "Search Jira issues by JQL",
    "input_schema": {
      "type": "object",
      "properties": {
        "jql": {"type": "string"}
      },
      "required": ["jql"]
    }
  }
]
```

#### Example

```bash
curl http://localhost:3001/api/mcp/tools \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### Analytics

#### GET /api/analytics/usage

Retrieve usage data (request counts, token counts) over time.

**Authentication:** JWT

#### Query Parameters

| Parameter    | Type   | Required | Default    | Description                          |
| ------------ | ------ | -------- | ---------- | ------------------------------------ |
| `from`       | string | No       | 7 days ago | Start datetime (ISO 8601)            |
| `to`         | string | No       | now        | End datetime (ISO 8601)              |
| `group_by`   | string | No       | `day`      | Grouping: `hour`, `day`, `week`      |
| `model`      | string | No       | all        | Filter by model name                 |

#### Response Body

```json
{
  "data": [
    {
      "period": "2026-03-27",
      "request_count": 1520,
      "prompt_tokens": 450000,
      "completion_tokens": 120000,
      "total_tokens": 570000
    }
  ]
}
```

#### Example

```bash
curl "http://localhost:3001/api/analytics/usage?from=2026-03-01T00:00:00Z&group_by=day" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/analytics/usage/stats

Retrieve aggregated usage statistics (totals and averages).

**Authentication:** JWT

#### Response Body

```json
{
  "total_requests": 45000,
  "total_tokens": 12500000,
  "avg_latency_ms": 850,
  "models": {
    "gpt-4o": {"requests": 30000, "tokens": 9000000},
    "claude-sonnet-4-20250514": {"requests": 15000, "tokens": 3500000}
  }
}
```

#### Example

```bash
curl http://localhost:3001/api/analytics/usage/stats \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/analytics/costs

Retrieve cost data over time.

**Authentication:** JWT

#### Query Parameters

| Parameter    | Type   | Required | Default    | Description                     |
| ------------ | ------ | -------- | ---------- | ------------------------------- |
| `from`       | string | No       | 7 days ago | Start datetime (ISO 8601)       |
| `to`         | string | No       | now        | End datetime (ISO 8601)         |
| `group_by`   | string | No       | `day`      | Grouping: `hour`, `day`, `week` |

#### Response Body

```json
{
  "data": [
    {
      "period": "2026-03-27",
      "total_cost_usd": 45.20,
      "by_model": {
        "gpt-4o": 32.10,
        "claude-sonnet-4-20250514": 13.10
      }
    }
  ]
}
```

#### Example

```bash
curl "http://localhost:3001/api/analytics/costs?from=2026-03-01T00:00:00Z" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/analytics/costs/stats

Retrieve aggregated cost statistics.

**Authentication:** JWT

#### Response Body

```json
{
  "total_cost_usd": 1250.00,
  "avg_daily_cost_usd": 41.67,
  "by_model": {
    "gpt-4o": 890.00,
    "claude-sonnet-4-20250514": 360.00
  }
}
```

#### Example

```bash
curl http://localhost:3001/api/analytics/costs/stats \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### Audit

#### GET /api/audit/logs

Search audit log entries. Backed by Quickwit for full-text search.

**Authentication:** JWT (Admin)

#### Query Parameters

| Parameter | Type    | Required | Default | Description                            |
| --------- | ------- | -------- | ------- | -------------------------------------- |
| `q`       | string  | No       | —       | Full-text search query                 |
| `from`    | string  | No       | —       | Start datetime (ISO 8601)              |
| `to`      | string  | No       | —       | End datetime (ISO 8601)                |
| `limit`   | integer | No       | 50      | Number of results (max 1000)           |
| `offset`  | integer | No       | 0       | Pagination offset                      |

#### Response Body

```json
{
  "total": 2340,
  "offset": 0,
  "limit": 50,
  "entries": [
    {
      "id": "uuid",
      "timestamp": "2026-03-28T09:15:00Z",
      "user_id": "uuid",
      "user_email": "admin@example.com",
      "action": "provider.create",
      "resource_type": "provider",
      "resource_id": "uuid",
      "details": {"name": "openai-prod"},
      "ip_address": "10.0.1.50",
      "user_agent": "Mozilla/5.0..."
    }
  ]
}
```

#### Common Action Values

| Action               | Description                  |
| -------------------- | ---------------------------- |
| `auth.login`         | User logged in               |
| `auth.login_failed`  | Failed login attempt         |
| `auth.register`      | User registered              |
| `key.create`         | API key created              |
| `key.revoke`         | API key revoked              |
| `provider.create`    | Provider added               |
| `provider.delete`    | Provider removed             |
| `mcp_server.create`  | MCP server registered        |
| `mcp_server.delete`  | MCP server removed           |
| `user.create`        | User created by admin        |

#### Example

```bash
curl "http://localhost:3001/api/audit/logs?q=provider.create&from=2026-03-01T00:00:00Z&limit=20" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

#### Error Responses

| Status | Condition          |
| ------ | ------------------ |
| 401    | Invalid JWT        |
| 403    | Not an admin       |

---

### Admin Settings

#### GET /api/admin/settings/system

Retrieve system-level configuration settings.

**Authentication:** JWT (Admin)

#### Response Body

```json
{
  "gateway_port": 3000,
  "console_port": 3001,
  "cors_origins": ["https://console.example.com"],
  "registration_enabled": true,
  "default_rate_limit_rpm": 60
}
```

#### Example

```bash
curl http://localhost:3001/api/admin/settings/system \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/admin/settings/oidc

Retrieve OIDC/SSO configuration (secrets redacted).

**Authentication:** JWT (Admin)

#### Response Body

```json
{
  "enabled": true,
  "issuer_url": "https://login.microsoftonline.com/tenant-id/v2.0",
  "client_id": "app-client-id",
  "redirect_url": "https://console.example.com/api/auth/sso/callback",
  "scopes": ["openid", "email", "profile"]
}
```

> **Note:** The `client_secret` is never exposed in responses.

---

#### GET /api/admin/settings/audit

Retrieve audit logging configuration.

**Authentication:** JWT (Admin)

#### Response Body

```json
{
  "quickwit_enabled": true,
  "quickwit_url": "http://quickwit:7280",
  "quickwit_index": "agentbastion-audit",
  "syslog_enabled": true,
  "syslog_addr": "siem.corp.internal:514"
}
```

---

### Console Health

#### GET /api/health

Detailed health check reporting connectivity to backing services.

**Authentication:** Public

#### Response Body

```json
{
  "status": "ok",
  "services": {
    "postgres": "ok",
    "redis": "ok",
    "quickwit": "ok"
  }
}
```

If a dependency is unreachable:

```json
{
  "status": "degraded",
  "services": {
    "postgres": "ok",
    "redis": "ok",
    "quickwit": "error"
  }
}
```

#### Example

```bash
curl http://localhost:3001/api/health
```

| Status | Condition                               |
| ------ | --------------------------------------- |
| 200    | All services healthy                    |
| 503    | One or more backing services unreachable|
