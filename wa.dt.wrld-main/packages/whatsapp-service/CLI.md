# azizi-wa

Event-driven WhatsApp bot with tag-based routing, RAG memory, LLM conversations, SPAO voice integration, and HITL dashboard.

**Version**: 0.8.0 | **Default port**: 3001

## Quick Start

```bash
# Start the server (default command)
node dist/cli.js

# Print full reference (routes, flags, deps, modes)
node dist/cli.js info

# Check all dependency connections
node dist/cli.js check --json

# List all registered users
node dist/cli.js user:list --json
```

## Commands

### `serve` (default)

Start the WhatsApp service. If no command is given, `serve` is assumed.

```bash
node dist/cli.js serve --mode dev --port 3001
node dist/cli.js serve --enable LLM --enable QDRANT
node dist/cli.js serve --whatsapp-url https://wa-im.aziziafrica.com
node dist/cli.js serve --mongo-uri mongodb://localhost:27017/whatsapp-service
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--port` | INT | 3001 | Listening port |
| `--mode` | STRING | from `NODE_ENV` | Preset: `dev`, `test`, `eval`, `prod` |
| `--enable` | STRING | (none) | Enable a feature flag (repeatable) |
| `--disable` | STRING | (none) | Disable a feature flag (repeatable) |
| `--whatsapp-url` | URL | (env) | Override `WHATSAPP_API_URL` |
| `--mongo-uri` | URI | (env) | Override `MONGODB_URI` |
| `--json` | BOOL | false | Machine-readable JSON output |

### `info`

Print the full server reference: routes, feature flags, dependencies, commands, and mode presets. With `--json`, returns a single JSON object suitable for AI agent consumption.

```bash
node dist/cli.js info              # Human-readable reference
node dist/cli.js info --json       # Machine-readable JSON
node dist/cli.js info --json | jq '.data.routes[].path'   # List all route paths
```

### `check`

Test TCP connectivity to all configured dependencies and exit. Returns exit code 0 if all required dependencies are reachable, 1 otherwise.

```bash
node dist/cli.js check             # Human-readable status
node dist/cli.js check --json      # Machine-readable { ok, data }
```

Status indicators:

| Symbol | Meaning |
|--------|---------|
| `[ok]` | Reachable or configured (for key-based deps) |
| `[--]` | Not configured (env var not set) |
| `[!!]` | Unreachable (TCP connection failed) |

### `user:list`

List all registered users. Requires MongoDB connection.

```bash
node dist/cli.js user:list --json
```

### `user:get`

Get a user by phone identifier.

```bash
node dist/cli.js user:get --identifier 254722833440
node dist/cli.js user:get 254722833440            # positional also works
node dist/cli.js user:get 254722833440 --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--identifier` | STRING | Phone number (e.g. `254722833440`) |

### `user:register`

Register a new user with optional name and tags.

```bash
node dist/cli.js user:register --identifier 254722833440 --name "Jane Doe" --tags SOMO,PILOT
node dist/cli.js user:register 254722833440 --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--identifier` | STRING | Phone number (required) |
| `--name` | STRING | Display name |
| `--tags` | STRING | Comma-separated tag list |

### `tag:list`

List all tag configurations from the event router.

```bash
node dist/cli.js tag:list --json
```

### `tag:get`

Get a specific tag configuration by name.

```bash
node dist/cli.js tag:get --tag SOMO
node dist/cli.js tag:get SOMO --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--tag` | STRING | Tag name (e.g. `SOMO`) |

### `rag:search`

Semantic search across RAG collections via Qdrant hybrid search. Requires Qdrant and an embedding model.

```bash
node dist/cli.js rag:search "crop insurance" --json
node dist/cli.js rag:search "how to plant maize" --collection somo_buruka --limit 3
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--collection` | STRING | `documents` | Qdrant collection name |
| `--limit` | INT | 5 | Max results |
| `--identifier` | STRING | `cli` | User identifier for context |

### `intent:detect`

Detect intent from a message using the LLM service. Requires LLM to be enabled.

```bash
node dist/cli.js intent:detect "I want to learn about farming"
node dist/cli.js intent:detect "hello" --json
```

### `config:get`

Get a config value by key from MongoDB.

```bash
node dist/cli.js config:get --key tag_config_SOMO
node dist/cli.js config:get tag_config_SOMO --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--key` | STRING | Config key |

### `config:set`

Set a config value. Values are parsed as JSON if possible, otherwise stored as strings.

```bash
node dist/cli.js config:set --key welcome_enabled --value true
node dist/cli.js config:set --key max_retries --value 5
node dist/cli.js config:set --key greeting --value '"Hello world"'
```

| Flag | Type | Description |
|------|------|-------------|
| `--key` | STRING | Config key (required) |
| `--value` | STRING | Config value (required, auto-parsed as JSON) |

### `config:list`

List config values matching a key prefix.

```bash
node dist/cli.js config:list --prefix tag_config_
node dist/cli.js config:list tag_config_ --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--prefix` | STRING | Key prefix to match (required) |

## Feature Flags

| Name | Env Var | Default | Description |
|------|---------|---------|-------------|
| `EVENT_QUEUE` | `ENABLE_EVENT_QUEUE` | false | BullMQ async event processing |
| `QDRANT` | `ENABLE_QDRANT` | false | Qdrant RAG memory + semantic search |
| `LLM` | `ENABLE_LLM` | false | LLM intent detection + dynamic menus |
| `DEDUPLICATION` | `ENABLE_DEDUPLICATION` | true | Message deduplication |
| `ALERTS` | `ENABLE_ALERTS` | false | Session disconnect + queue backup alerts |
| `ERPNEXT_SYNC` | `ENABLE_ERPNEXT_SYNC` | false | ERPNext contact/campaign sync |
| `SPAO` | `ENABLE_SPAO` | false | SPAO voice AI integration |
| `SOCKET` | `ENABLE_SOCKET` | false | Socket.io real-time to HITL dashboard |
| `KEYCLOAK_AUTH` | `ENABLE_KEYCLOAK_AUTH` | false | Keycloak OIDC admin auth |

Enable or disable at the command line:

```bash
node dist/cli.js serve --enable LLM --enable QDRANT --disable DEDUPLICATION
```

Flag names are case-insensitive. Unknown flags produce a warning on stderr and are ignored.

## Dependencies

| Name | Env Var | Required | Description |
|------|---------|----------|-------------|
| MongoDB | `MONGODB_URI` | yes | User state, config, progress |
| WhatsApp API | `WHATSAPP_API_URL` | yes | wwebjs-api instance |
| Redis | `REDIS_URL` | no | BullMQ queue, session store |
| Qdrant | `QDRANT_URL` | no | Vector search for RAG |
| OpenRouter LLM | `OPENROUTER_API_KEY` | no | LLM via OpenRouter |
| SPAO API | `SPAO_API_URL` | no | Voice AI control plane |
| ERPNext | `ERPNEXT_URL` | no | CRM sync |

The `check` command tests TCP connectivity for URL-based dependencies and confirms env-var presence for key-based ones.

## Mode Presets

Modes set multiple feature flags at once. Explicit `--enable`/`--disable` flags override the preset. Environment variables already set in the shell take precedence over preset values.

| Flag | `dev` | `test` | `eval` | `prod` |
|------|-------|--------|--------|--------|
| LLM | on | off | on | on |
| QDRANT | off | off | on | on |
| EVENT_QUEUE | off | off | off | on |
| ALERTS | off | off | off | on |
| ERPNEXT_SYNC | off | off | off | on |
| SPAO | on | off | on | on |
| SOCKET | off | off | off | on |
| KEYCLOAK_AUTH | off | off | off | on |

Mode is inferred from `NODE_ENV` if `--mode` is not provided:

| `NODE_ENV` | Mode |
|------------|------|
| `development` (default) | `dev` |
| `test` | `test` |
| `production` | `prod` |

The `eval` mode is only available via `--mode eval` and is designed for prompt evaluation with LLM + Qdrant active but no queue or auth.

## Use Cases

### Local Development

```bash
# Minimal: just the server with LLM (default dev mode)
node dist/cli.js

# With Qdrant for RAG testing
node dist/cli.js serve --enable QDRANT

# Point at production WhatsApp API (bot runs locally, messages go through live session)
node dist/cli.js serve --whatsapp-url https://wa-im.aziziafrica.com
```

### CI Testing

```bash
# All features off, no external deps needed
node dist/cli.js serve --mode test

# Check that required deps are configured (exits 0 or 1)
node dist/cli.js check --json
```

### User Management

```bash
# Register a user with tags
node dist/cli.js user:register --identifier 254722833440 --name "Jane" --tags SOMO,PILOT

# Look up a user
node dist/cli.js user:get 254722833440 --json

# List everyone
node dist/cli.js user:list --json
```

### RAG Search

```bash
# Search default collection
node dist/cli.js rag:search "crop insurance" --json

# Search specific collection with limit
node dist/cli.js rag:search "how to plant maize" --collection somo_buruka --limit 3
```

### Intent Detection

```bash
# Detect intent from a message
node dist/cli.js intent:detect "I want to learn about farming" --json

# Test keyword matching vs LLM
node dist/cli.js intent:detect "SOMO" --json
```

## Operational Defaults

These are informational defaults declared in `server_meta.ts`. Actual values are read from `shared/config.ts` and can be overridden via environment variables.

| Setting | Default | Notes |
|---------|---------|-------|
| LLM Model | `openai/gpt-4o-mini` | Via OpenRouter |
| Embedding Model | `sentence-transformers/all-minilm-l6-v2` | For Qdrant vector search |
| Brand Name | `Azizi Africa` | Used in welcome messages and LLM context |
| Queue Concurrency | 5 | BullMQ worker parallelism |
| Dedup Window | 300s | Message deduplication time window |

## Docker

The Dockerfile CMD remains `node dist/index.js`. The CLI (`cli.ts`) is a local development and evaluation tool -- it is not used in production containers.

In production, feature flags and configuration are set via environment variables in Docker Compose, not CLI arguments.

## Routes

32 registered routes across 11 categories:

| Tag | Method | Path | Auth | Description |
|-----|--------|------|------|-------------|
| health | GET | `/service/health` | none | Service health check |
| health | GET | `/service/ping` | none | Ping-pong test |
| health | GET | `/service/health/ready` | none | Readiness probe |
| events | POST | `/service/events/:sessionId` | api_key | Event receiver from wwebjs-api |
| webhooks | POST | `/service/webhook` | api_key | n8n webhook dispatch |
| webhooks | POST | `/service/webhook/register/:id` | api_key | Register n8n trigger |
| webhooks | GET | `/service/webhook/list/:id` | api_key | List webhooks |
| webhooks | POST | `/service/webhooks/erpnext/*` | hmac | ERPNext webhook receiver (HMAC) |
| webhooks | POST | `/service/webhooks/spao` | api_key | SPAO voice event receiver |
| users | POST | `/service/users/register` | api_key | Register/update user |
| users | GET | `/service/users/list` | api_key | List users |
| users | GET | `/service/users?identifier=X` | api_key | Get user by identifier |
| users | POST | `/service/users/tags` | api_key | Add tags to user |
| users | DELETE | `/service/users/tags` | api_key | Remove tags from user |
| tags | GET | `/service/tags/configs` | api_key | List tag configurations |
| tags | GET | `/service/tags/:tag/config` | api_key | Get tag config |
| tags | POST | `/service/tags/:tag/config` | api_key | Set tag config |
| tags | DELETE | `/service/tags/:tag/config` | api_key | Delete tag config |
| media | POST | `/service/media/proxy` | api_key | Proxy external media |
| media | GET | `/service/media/cache/:id` | none | Serve cached media |
| progress | GET | `/service/progress/modules` | api_key | Module structure for tag |
| progress | GET | `/service/progress/learners` | api_key | List learners for tag |
| progress | GET | `/service/progress?identifier&tag` | api_key | Get learner progress |
| progress | POST | `/service/progress?identifier` | api_key | Update learner progress |
| welcome | GET | `/service/welcome-messages` | api_key | List all welcome messages |
| welcome | POST | `/service/welcome-messages/:tag` | api_key | Set welcome message |
| welcome | DELETE | `/service/welcome-messages/:tag` | api_key | Remove welcome message |
| docs | GET | `/api-docs/service` | none | Interactive API docs (Swagger UI) |
| metrics | GET | `/service/metrics/deduplication` | api_key | Deduplication statistics |
| queue | GET | `/service/queue/stats` | api_key | Queue statistics |
| queue | GET | `/service/queue/failed` | api_key | Failed jobs |
| auth | GET | `/service/auth/login` | none | Initiate Keycloak login |
| auth | GET | `/service/auth/callback` | none | OIDC callback |
| auth | POST | `/service/auth/logout` | session | Logout |
| auth | GET | `/service/auth/me` | session | Current user info |
| usage | GET | `/service/usage` | api_key | Usage tracking API |
