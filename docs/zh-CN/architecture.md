**[English](../en/architecture.md) | [中文](../zh-CN/architecture.md)**

# AgentBastion 架构设计

## 1. 概述

AgentBastion 是一个使用 Rust 构建的企业级 AI API 网关和 MCP（Model Context Protocol）管理平台。它作为组织内所有 AI 访问的**堡垒主机** —— 来自开发工具、自动化代理和内部应用的每个请求都通过单一受控网关流转，然后才到达上游 AI 提供商或 MCP 服务器。

该架构提供集中化的：

- **认证与授权** —— API 密钥验证、基于 JWT 的会话、OIDC SSO 以及基于角色的访问控制。
- **成本管理** —— 按密钥和按团队的预算、Token 级别的用量跟踪以及实时成本计算。
- **速率限制** —— 按 API 密钥执行每分钟请求数（RPM）和每分钟 Token 数（TPM）的限制。
- **审计日志** —— 每个请求都会记录完整上下文，用于合规和调试。
- **模型访问治理** —— 细粒度权限控制，管理哪些用户、团队和角色可以访问哪些 AI 模型和 MCP 工具。
- **多提供商抽象** —— 统一的 OpenAI 兼容 API，代理到 OpenAI、Anthropic、Google 及自定义提供商，并自动进行请求/响应格式转换。

---

## 2. 系统架构图

```
                          Downstream Clients
            +----------------+  +----------------+  +----------------+
            |  Claude Code   |  |    Cursor      |  | Custom Agents  |
            |  (MCP client)  |  | (OpenAI-compat)|  | (API / MCP)    |
            +-------+--------+  +-------+--------+  +-------+--------+
                    |                    |                    |
                    |   ab-xxx API key   |   JWT / API key   |
                    +--------------------+--------------------+
                                         |
                              +----------+-----------+
                              |   Reverse Proxy      |
                              |  (nginx / traefik)   |
                              +----+------------+----+
                                   |            |
                    +--------------+--+    +----+----------------+
                    |  Gateway :3000  |    |   Console :3001     |
                    |  +-----------+  |    |  +--------------+   |
                    |  | /v1/*     |  |    |  | /api/*       |   |
                    |  | AI Proxy  |  |    |  | Mgmt REST API|   |
                    |  +-----------+  |    |  +--------------+   |
                    |  +-----------+  |    |  +--------------+   |
                    |  | /mcp      |  |    |  | Web UI (SPA) |   |
                    |  | MCP Proxy |  |    |  | React 19     |   |
                    |  +-----------+  |    |  +--------------+   |
                    |  +-----------+  |    +---------------------+
                    |  | /health   |  |
                    |  +-----------+  |
                    +---------+-------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    +-----+------+    +------+------+    +-------+-------+
    | PostgreSQL  |    |    Redis    |    |   Quickwit    |
    | users, keys |    | rate limits |    | audit search  |
    | providers   |    | sessions    |    |               |
    | usage, RBAC |    | OIDC state  |    +-------+-------+
    +-------------+    +-------------+            |
                                           +------+------+
                                           |   RustFS    |
                                           | (S3 storage)|
                                           +-------------+

          +-------------------+-------------------+
          |                   |                   |
    +-----+------+    +------+------+    +-------+-------+
    |   OpenAI   |    |  Anthropic  |    |    Google     |
    |  API       |    |  API        |    |  Gemini API   |
    +------------+    +-------------+    +---------------+
          Upstream AI Providers

    +---------------------------------------------+
    | Upstream MCP Servers (Streamable HTTP)       |
    |  e.g. filesystem, github, database, etc.    |
    +---------------------------------------------+

    +---------------------------------------------+
    |   Zitadel (OIDC SSO Provider)               |
    |   External identity provider for SSO login  |
    +---------------------------------------------+
```

---

## 3. 双端口架构

AgentBastion 在单个进程中绑定两个独立的 TCP 监听器：

| 端口 | 名称    | 用途                                      | 目标用户           |
|------|---------|-------------------------------------------|--------------------|
| 3000 | Gateway | AI API 代理 (`/v1/*`)、MCP 代理 (`/mcp`)、健康检查 (`/health`) | AI 客户端、代理    |
| 3001 | Console | 管理 REST API (`/api/*`)、Web UI          | 管理员             |

### 为什么使用两个端口？

**安全隔离。** 网关端口是唯一应暴露给公共网络或开发者工作站的端口。它接受 API 密钥认证并提供高吞吐量的代理路径。控制台端口提供管理界面，应限制在内部网络、VPN 或本地访问。

**网络拓扑建议：**

- **生产环境：** 在两个端口前放置反向代理（nginx、traefik 或云负载均衡器）。仅将端口 3000 暴露给公共或开发者网络。将端口 3001 限制在内部网段或要求 VPN 访问。
- **Kubernetes：** 创建两个独立的 Ingress 资源 —— 一个面向公共的网关主机 Ingress 和一个内部 Ingress（或完全不使用 Ingress，通过 port-forward 访问）用于控制台主机。
- **开发环境：** 两个端口都可以在 localhost 上访问。React 开发服务器（pnpm dev）将 API 调用代理到 `localhost:3001`。

---

## 4. AI API 网关数据流

当客户端通过网关发送聊天补全请求时，会执行以下步骤：

```
Client                Gateway :3000                        Upstream Provider
  |                        |                                      |
  |  POST /v1/chat/completions                                    |
  |  Authorization: Bearer ab-xxxx                                |
  |----------------------->|                                      |
  |                        |                                      |
  |               1. API Key Auth Middleware                       |
  |                  - Extract key prefix (ab-xxxx)               |
  |                  - Hash key, lookup in PostgreSQL              |
  |                  - Validate: active, not expired, budget ok    |
  |                  - Attach user_id, team_id, scopes to request |
  |                        |                                      |
  |               2. Model Router                                 |
  |                  - Extract model from request body             |
  |                  - Find provider + model in registry           |
  |                  - Check model_permissions for user/team/role  |
  |                  - Check allowed_models on the API key         |
  |                        |                                      |
  |               3. Request Transform                            |
  |                  - If provider is Anthropic: OpenAI -> Claude  |
  |                  - If provider is Google: OpenAI -> Gemini     |
  |                  - If provider is OpenAI: pass through         |
  |                        |                                      |
  |               4. Rate Limiter                                 |
  |                  - Check RPM counter in Redis                  |
  |                  - Estimate tokens, check TPM counter          |
  |                  - If exceeded: return 429 Too Many Requests   |
  |                        |                                      |
  |               5. Upstream Proxy                                |
  |                  - Build request with provider API key         |
  |                    (decrypted from providers.api_key_encrypted)|
  |                  - Forward to provider base_url                |
  |                        |--- POST provider.base_url ---------->|
  |                        |                                      |
  |                        |<--- SSE stream / JSON response ------|
  |                        |                                      |
  |               6. Response Transform                           |
  |                  - If provider is Anthropic: Claude -> OpenAI  |
  |                  - If provider is Google: Gemini -> OpenAI     |
  |                  - Stream SSE chunks back to client            |
  |                        |                                      |
  |<-- SSE stream ---------|                                      |
  |                        |                                      |
  |               7. Async Post-Processing (spawned task)         |
  |                  - Count input/output tokens (tiktoken)        |
  |                  - Calculate cost from model pricing           |
  |                  - Insert usage_record into PostgreSQL         |
  |                  - Write audit_log entry                       |
  |                  - Push audit log to Quickwit (if configured)  |
  |                  - Update rate limit counters in Redis         |
```

### 关键设计决策

- **流式优先：** 代理使用 `eventsource-stream` 和 `async-stream` 以最小缓冲实时转发 SSE 数据块。Token 计数在流完成后进行。
- **提供商 API 密钥静态加密存储**，使用 AES-256-GCM。`ENCRYPTION_KEY` 环境变量提供 256 位密钥。
- **格式转换** 允许所有客户端使用 OpenAI 格式（`/v1/chat/completions`），无论上游提供商是什么。这意味着单个 `ab-` API 密钥可以路由到任何已配置的提供商。

---

## 5. MCP 网关数据流

MCP 网关允许客户端（如 Claude Code 或 Cursor）通过单个经过认证的端点访问远程 MCP 工具服务器：

```
MCP Client              MCP Gateway :3000/mcp            Upstream MCP Server
  |                           |                                  |
  |  POST /mcp                |                                  |
  |  Authorization: Bearer <JWT>                                 |
  |  (or ab-xxx API key)      |                                  |
  |-------------------------->|                                  |
  |                           |                                  |
  |               1. Authentication                              |
  |                  - Validate JWT or API key                   |
  |                  - Extract user identity + roles             |
  |                           |                                  |
  |               2. Session Management                          |
  |                  - Mcp-Session-Id header check               |
  |                  - Create new session or resume existing     |
  |                  - Session state stored in Redis             |
  |                           |                                  |
  |               3. JSON-RPC Dispatch                           |
  |                  Parse method:                               |
  |                  - "initialize" -> return capabilities       |
  |                  - "tools/list" -> aggregate from registry   |
  |                  - "tools/call" -> route to server           |
  |                           |                                  |
  |               4. Tool Namespace Resolution (tools/call)      |
  |                  - Tool name: "github__create_issue"         |
  |                  - Split on "__" -> server="github",         |
  |                    tool="create_issue"                       |
  |                  - Look up server in mcp_servers registry    |
  |                           |                                  |
  |               5. Access Control Check                        |
  |                  - Check mcp_tool_permissions for            |
  |                    user/team/role against this tool           |
  |                  - Deny if not permitted                     |
  |                           |                                  |
  |               6. Connection Pool -> Upstream                 |
  |                  - Get/create connection from pool            |
  |                  - Forward JSON-RPC call to upstream server   |
  |                           |--- POST server.endpoint_url ---->|
  |                           |<-- JSON-RPC response ------------|
  |                           |                                  |
  |               7. Response Forwarding + Audit                 |
  |                  - Return JSON-RPC response to client        |
  |                  - Log tool invocation to audit_logs         |
  |                           |                                  |
  |<-- JSON-RPC response -----|                                  |
```

### 关键设计决策

- **Streamable HTTP 传输** 是主要的 MCP 传输方式。网关通过 `streamable_http` 连接上游服务器。
- **工具聚合：** 当客户端调用 `tools/list` 时，网关会聚合用户有权访问的所有已注册 MCP 服务器的工具，并在每个工具名称前加上其服务器名称和 `__` 以避免冲突。
- **连接池** 复用上游 MCP 连接，避免重复握手。
- **健康检查** 定期运行（可通过 `health_check_interval` 配置），将服务器标记为健康或不健康。

---

## 6. Crate 架构

AgentBastion 采用 Cargo workspace 结构，包含五个 crate：

```
crates/
  server/           # Binary crate -- HTTP servers, routes, handlers, middleware
  gateway/          # Library -- AI API proxy engine
  mcp-gateway/      # Library -- MCP proxy engine
  auth/             # Library -- authentication and authorization
  common/           # Library -- shared infrastructure
```

### server

应用程序入口点。包含：

- **`main.rs`** —— 初始化配置、数据库、Redis，并启动网关和控制台两个 Axum 服务器。
- **`app.rs`** —— 为两个端口构建 Axum 路由树。
- **`handlers/`** —— 按领域组织的请求处理器：
  - `auth.rs`、`sso.rs` —— 登录、注册、OIDC 回调
  - `api_keys.rs` —— 虚拟 API 密钥的 CRUD 操作
  - `providers.rs` —— AI 提供商和模型管理
  - `mcp_servers.rs`、`mcp_tools.rs` —— MCP 服务器注册管理
  - `analytics.rs`、`audit.rs` —— 用量仪表盘、审计日志查询
  - `admin.rs` —— 用户管理、角色分配、系统设置
  - `health.rs` —— 健康检查端点
- **`middleware/`** —— Axum 中间件层：
  - `api_key_auth.rs` —— 为网关路由提取和验证 `ab-` API 密钥
  - `auth_guard.rs` —— 为控制台路由验证 JWT 令牌
  - `require_role.rs` —— RBAC 强制执行中间件

### gateway

AI API 代理引擎。包含：

- **`providers/`** —— 基于统一 trait 的提供商实现：
  - `traits.rs` —— 定义代理接口的 `AiProvider` trait
  - `openai.rs` —— OpenAI 代理（直通）
  - `anthropic.rs` —— Anthropic Claude 代理，带格式转换
  - `google.rs` —— Google Gemini 代理，带格式转换
  - `custom.rs` —— 通用 OpenAI 兼容提供商代理
- **`proxy.rs`** —— 核心代理逻辑：接收请求、选择提供商、转发、返回响应。
- **`router.rs`** —— 模型到提供商的路由和权限检查。
- **`streaming.rs`** —— SSE 流转发和数据块处理。
- **`transform/`** —— OpenAI、Anthropic 和 Google 格式之间的请求/响应格式转换。
- **`rate_limiter.rs`** —— 基于 Redis 的 RPM/TPM 速率限制，使用滑动窗口计数器。
- **`token_counter.rs`** —— 使用 `tiktoken-rs` 进行 Token 计数，用于用量跟踪和 TPM 限制。
- **`cost_tracker.rs`** —— 基于数据库中模型定价的实时成本计算。

### mcp-gateway

MCP 代理引擎。包含：

- **`proxy.rs`** —— 核心 MCP 代理：接收 JSON-RPC 请求，分发到正确的上游服务器。
- **`registry.rs`** —— MCP 服务器及其工具的内存注册表，从 PostgreSQL 同步。
- **`pool.rs`** —— 上游 MCP 服务器连接池。
- **`session.rs`** —— 有状态 MCP 交互的会话管理（基于 Redis）。
- **`access_control.rs`** —— 针对 `mcp_tool_permissions` 的工具调用权限检查。
- **`health.rs`** —— 已注册 MCP 服务器的定期健康检查。
- **`transport/`** —— 传输层实现：
  - `streamable_http.rs` —— 用于上游 MCP 服务器的 Streamable HTTP 传输客户端。

### auth

认证与授权库。包含：

- **`jwt.rs`** —— 使用 `jsonwebtoken` 进行 JWT 令牌创建和验证。
- **`api_key.rs`** —— API 密钥生成（`ab-` 前缀）、哈希和验证。
- **`password.rs`** —— 使用 Argon2 进行密码哈希和验证。
- **`oidc.rs`** —— 用于与 Zitadel 或任何 OIDC 提供商进行 SSO 的 OpenID Connect 客户端。处理授权 URL 生成、回调处理和用户配置。
- **`rbac.rs`** —— 基于角色的访问控制：权限加载、角色层级和授权检查。

### common

所有其他 crate 使用的共享基础设施。包含：

- **`config.rs`** —— 从环境变量加载的 `AppConfig` 结构体。
- **`db.rs`** —— 使用 `sqlx` 设置 PostgreSQL 连接池。
- **`models/`** —— 数据库模型结构体（每个领域实体一个）：`user.rs`、`team.rs`、`api_key.rs`、`provider.rs`、`mcp_server.rs`、`usage.rs`、`audit_log.rs`。
- **`dto/`** —— 用于 API 请求/响应序列化的数据传输对象。
- **`errors.rs`** —— 统一的错误类型，带 HTTP 状态码映射。
- **`crypto.rs`** —— 用于提供商 API 密钥的 AES-256-GCM 加密/解密。
- **`audit.rs`** —— 审计日志写入器（PostgreSQL + 可选 Quickwit + 可选 syslog 转发）。

---

## 7. 数据库 Schema 概述

数据库 Schema 由七个迁移文件定义，在启动时按顺序应用：

### 001_init_users —— 用户账户

| 表      | 用途 |
|---------|------|
| `users` | 核心用户账户，包含邮箱、显示名称、密码哈希（用于本地认证）以及 OIDC subject/issuer（用于 SSO）。|

### 002_init_teams —— 团队组织

| 表             | 用途 |
|----------------|------|
| `teams`        | 组织团队，可选的月度预算限制。|
| `team_members` | 用户和团队之间的多对多关联，带角色字段（owner/member）。|

### 003_init_rbac —— 基于角色的访问控制

| 表                 | 用途 |
|--------------------|------|
| `roles`            | 命名角色。预置五个系统角色：`super_admin`、`admin`、`team_manager`、`developer`、`viewer`。|
| `permissions`      | 细粒度权限，以（资源, 操作）对形式表示。|
| `role_permissions`  | 将角色映射到其授权的权限。|
| `user_roles`       | 为用户分配角色，可选范围（全局或团队范围）。|

### 004_init_api_keys —— 虚拟 API 密钥

| 表         | 用途 |
|------------|------|
| `api_keys` | 颁发给用户或团队的虚拟 API 密钥（`ab-` 前缀）。每个密钥存储：哈希密钥、允许的模型、速率限制（RPM/TPM）、月度预算、过期时间和权限范围。|

### 005_init_providers —— AI 提供商配置

| 表                  | 用途 |
|---------------------|------|
| `providers`         | 上游 AI 提供商配置：名称、类型（openai/anthropic/google/custom）、基础 URL 和 AES 加密的 API 密钥。|
| `models`            | 注册在提供商下的 AI 模型，包含输入/输出 Token 定价。|
| `model_permissions` | 模型的访问控制规则，可按角色、团队或个人用户授权。|

### 006_init_mcp_servers —— MCP 服务器注册

| 表                     | 用途 |
|------------------------|------|
| `mcp_servers`          | 已注册的上游 MCP 服务器：端点 URL、传输类型、认证配置、健康状态和检查间隔。|
| `mcp_tools`            | 从每个 MCP 服务器发现的工具，包含其 JSON Schema 输入定义。|
| `mcp_tool_permissions` | 单个 MCP 工具的访问控制规则，可按角色、团队或用户授权。|

### 007_init_usage_audit —— 用量跟踪与审计

| 表              | 用途 |
|-----------------|------|
| `usage_records` | 每请求的用量数据：API 密钥、用户、团队、提供商、模型、Token 数量、USD 成本、延迟和 HTTP 状态。按时间和按用户/团队/密钥建立索引，用于仪表盘查询。|
| `audit_logs`    | 安全审计跟踪：用户、API 密钥、操作、资源、详情 JSON、IP 地址和用户代理。|
| `budget_alerts` | 团队和 API 密钥的预算阈值通知记录。|

---

## 8. 前端架构

Web 控制台是一个位于 `web/` 目录下的单页应用。

### 技术栈

- **React 19** + TypeScript
- **shadcn/ui** 组件库（基于 Tailwind CSS）
- **简单的 pushState 路由**（无外部路由库）
- **Fetch API** 用于所有 HTTP 请求，JWT 存储在 `localStorage` 中

### 页面结构

UI 由 15 个页面组成，分为五组：

| 分组        | 页面                              | 描述 |
|-------------|-----------------------------------|------|
| 认证        | `login.tsx`                       | 登录表单（本地 + OIDC SSO） |
| 仪表盘      | `dashboard.tsx`                   | 概览：用量图表、成本摘要、近期活动 |
| 网关        | `providers.tsx`、`models.tsx`、`api-keys.tsx`、`logs.tsx` | AI 提供商管理、模型注册、API 密钥 CRUD、请求日志 |
| MCP         | `servers.tsx`、`tools.tsx`、`logs.tsx` | MCP 服务器注册、工具发现/权限、MCP 请求日志 |
| 分析        | `usage.tsx`、`costs.tsx`、`audit.tsx` | Token 用量仪表盘、成本明细、审计日志搜索 |
| 管理        | `users.tsx`、`roles.tsx`、`settings.tsx` | 用户管理、RBAC 角色配置、系统设置 |

### API 客户端模式

所有页面通过共享的 fetch 封装与控制台服务器（`/api/*`）通信，该封装会：

1. 从 `localStorage` 读取 JWT。
2. 将其作为 `Authorization: Bearer <token>` 附加到请求中。
3. 处理 401 响应，重定向到登录页面。
4. 解析 JSON 响应并将错误展示到 UI 中。

Web UI 构建为静态 SPA，由开发服务器（Vite + `pnpm dev`）或生产环境中的 nginx 容器提供服务（参见 `deploy/docker/Dockerfile.web` 和 `deploy/docker/nginx.conf`）。
