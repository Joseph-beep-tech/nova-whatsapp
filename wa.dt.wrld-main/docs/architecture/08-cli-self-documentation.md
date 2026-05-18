# CLI Self-Documentation

The WhatsApp Service ships a subcommand-based CLI (`cli.ts`) backed by a zero-side-effect metadata module (`server_meta.ts`). Together they provide human and machine-readable introspection into every route, feature flag, dependency, and mode preset the service exposes.

## Architecture

```
src/server_meta.ts   — typed metadata: routes, flags, deps, mode presets, commands (zero imports)
src/cli.ts           — subcommand dispatch: parseArgs → env override → handler or require('./index')
```

**Separation of concerns:**

- `server_meta.ts` has no imports from the service codebase. It can be loaded instantly for `--help` and `info --json` without triggering database connections or module initialization.
- `cli.ts` is a thin dispatch layer. For the `serve` command it calls `require('./index')` which triggers the normal Express boot sequence. For all other commands it imports only the specific service module needed (e.g. `stateManager`, `llmService`).

**Docker CMD stays unchanged.** The Dockerfile uses `CMD ["node", "dist/index.js"]`. `cli.ts` is a local development and evaluation tool, never used in production containers. In production, configuration is done entirely through environment variables.

## Subcommand Pattern

The CLI uses a positional subcommand pattern with colon-namespaced groups:

```
azizi-wa <command> [flags] [positional-args]
```

If no command is given, `serve` is assumed. Commands are dispatched through a static `COMMAND_DISPATCH` map linking command names to handler functions.

### Command Groups

| Group | Commands | Data Source |
|-------|----------|-------------|
| (top-level) | `serve`, `info`, `check` | server_meta / TCP probes |
| `user:` | `user:list`, `user:get`, `user:register` | MongoDB via stateManager |
| `tag:` | `tag:list`, `tag:get` | MongoDB via eventRouter |
| `rag:` | `rag:search` | Qdrant via qdrantHandler |
| `intent:` | `intent:detect` | LLM via llmService |
| `config:` | `config:get`, `config:set`, `config:list` | MongoDB via stateManager |

### Command Reference

| Command | Description | Requires |
|---------|-------------|----------|
| `serve` | Start the WhatsApp service (default) | MongoDB, WhatsApp API |
| `info` | Print full server reference | Nothing (reads server_meta only) |
| `check` | Test dependency connectivity and exit | Nothing (TCP probes) |
| `user:list` | List all registered users | MongoDB |
| `user:get` | Get user by phone identifier | MongoDB |
| `user:register` | Register user with name and tags | MongoDB |
| `tag:list` | List all tag configurations | MongoDB |
| `tag:get` | Get a specific tag configuration | MongoDB |
| `rag:search` | Semantic search across RAG collections | Qdrant, embedding model |
| `intent:detect` | Detect intent from a message | LLM (OpenRouter) |
| `config:get` | Get a config value by key | MongoDB |
| `config:set` | Set a config value | MongoDB |
| `config:list` | List config values by key prefix | MongoDB |

## `--json` Convention

Every subcommand supports `--json` for machine-readable output. The JSON envelope is always:

```json
{
  "ok": true,
  "data": <command-specific payload>
}
```

On error:

```json
{
  "ok": false,
  "data": { "error": "User '12345' not found" }
}
```

This convention enables piping to `jq` and consumption by AI agents:

```bash
azizi-wa info --json | jq '.data.routes[].path'
azizi-wa check --json | jq '.data | to_entries[] | select(.value.status == "unreachable")'
azizi-wa user:list --json | jq '.data | length'
```

Without `--json`, output is human-readable plain text. The `info` command without `--json` produces the full `--help` reference including all commands, flags, feature flags, dependencies, routes, modes, and recipe examples.

## Global Flags

These flags apply to all commands:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--help` | boolean | false | Print full reference and exit (equivalent to `info`) |
| `--json` | boolean | false | Machine-readable JSON output |
| `--verbose` | boolean | false | Verbose output (reserved) |
| `--port` | INT | 3001 | Override listening port (`PORT` env) |
| `--mode` | STRING | from `NODE_ENV` | Mode preset: `dev`, `test`, `eval`, `prod` |
| `--enable` | STRING | (none) | Enable a feature flag by name (repeatable) |
| `--disable` | STRING | (none) | Disable a feature flag by name (repeatable) |
| `--whatsapp-url` | URL | (env) | Override `WHATSAPP_API_URL` |
| `--mongo-uri` | URI | (env) | Override `MONGODB_URI` |

### Command-Specific Flags

| Flag | Used By | Description |
|------|---------|-------------|
| `--identifier` | `user:get`, `user:register`, `rag:search` | Phone number |
| `--name` | `user:register` | User display name |
| `--tags` | `user:register` | Comma-separated tag list |
| `--tag` | `tag:get` | Tag name |
| `--collection` | `rag:search` | Qdrant collection name (default: `documents`) |
| `--limit` | `rag:search` | Max results (default: 5) |
| `--message` | `rag:search`, `intent:detect` | Message text (alternative to positional) |
| `--key` | `config:get`, `config:set` | Config key |
| `--value` | `config:set` | Config value (auto-parsed as JSON) |
| `--prefix` | `config:list` | Config key prefix |

Most command-specific flags also accept positional arguments (e.g. `user:get 254722833440` is equivalent to `user:get --identifier 254722833440`).

## Flag Precedence

When determining the value of a feature flag or environment variable, the CLI applies values in this order (highest priority first):

1. **Shell environment** -- if `ENABLE_LLM=true` is already set in the shell, it wins
2. **`--enable` / `--disable`** CLI flags -- explicit per-flag overrides
3. **Mode preset** -- the `--mode` (or inferred mode) sets defaults for unset flags
4. **`server_meta.ts` defaults** -- the `defaultValue` in each `FeatureFlag` definition

Implementation detail: `applyArgs()` applies mode presets first (only for env vars that are unset or empty), then applies `--enable`/`--disable` overrides (which always write). This means CLI flags always override mode presets.

## Mode Presets

Four modes are available, each setting a different combination of feature flags:

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

### Mode Inference

If `--mode` is not provided, mode is inferred from `NODE_ENV`:

| `NODE_ENV` | Inferred Mode |
|------------|---------------|
| `development` (or unset) | `dev` |
| `test` | `test` |
| `production` | `prod` |

The `eval` mode must be requested explicitly with `--mode eval`. It is designed for prompt evaluation and RAG testing: LLM and Qdrant are active, but the queue, alerts, auth, and other production concerns are off.

### Mode Summaries

- **`dev`** -- LLM + SPAO on, everything else off. For local development against a WhatsApp API instance.
- **`test`** -- All features off. For CI and unit tests with no external dependencies.
- **`eval`** -- LLM + Qdrant + SPAO on. For evaluating prompts and RAG quality with full AI capabilities.
- **`prod`** -- All features on. Inferred automatically when `NODE_ENV=production`.

## Feature Flags

Nine feature flags control optional subsystems:

| Name | Env Var | Default | Description |
|------|---------|---------|-------------|
| `EVENT_QUEUE` | `ENABLE_EVENT_QUEUE` | false | BullMQ async event processing (requires Redis) |
| `QDRANT` | `ENABLE_QDRANT` | false | Qdrant RAG memory + semantic search |
| `LLM` | `ENABLE_LLM` | false | LLM intent detection + dynamic menus (requires OpenRouter) |
| `DEDUPLICATION` | `ENABLE_DEDUPLICATION` | true | Message deduplication (5-minute window) |
| `ALERTS` | `ENABLE_ALERTS` | false | Session disconnect + queue backup alerts |
| `ERPNEXT_SYNC` | `ENABLE_ERPNEXT_SYNC` | false | ERPNext contact/campaign sync |
| `SPAO` | `ENABLE_SPAO` | false | SPAO voice AI integration |
| `SOCKET` | `ENABLE_SOCKET` | false | Socket.io real-time to HITL dashboard |
| `KEYCLOAK_AUTH` | `ENABLE_KEYCLOAK_AUTH` | false | Keycloak OIDC admin auth |

Flag names in `--enable`/`--disable` are case-insensitive. Unknown flag names produce a warning on stderr and are ignored.

Note: `DEDUPLICATION` defaults to `true` and is not managed by any mode preset. It must be explicitly disabled with `--disable DEDUPLICATION` if needed.

## Dependencies

Seven external dependencies are declared:

| Name | Env Var | Required | Check Method |
|------|---------|----------|-------------|
| MongoDB | `MONGODB_URI` | yes | TCP probe (parsed from connection string) |
| WhatsApp API | `WHATSAPP_API_URL` | yes | TCP probe |
| Redis | `REDIS_URL` | no | TCP probe |
| Qdrant | `QDRANT_URL` | no | TCP probe |
| OpenRouter LLM | `OPENROUTER_API_KEY` | no | Env var presence (key-based) |
| SPAO API | `SPAO_API_URL` | no | TCP probe |
| ERPNext | `ERPNEXT_URL` | no | TCP probe |

The `check` command performs a 500ms TCP socket connection test for URL-based dependencies and confirms env-var presence for key/token/secret-based ones.

## Operational Defaults

Informational defaults declared in `server_meta.ts` (actual runtime values loaded from `shared/config.ts`):

| Setting | Default | Notes |
|---------|---------|-------|
| LLM Model | `openai/gpt-4o-mini` | Via OpenRouter |
| Embedding Model | `sentence-transformers/all-minilm-l6-v2` | For Qdrant vector search |
| Brand Name | `Azizi Africa` | Used in welcome messages and LLM system prompts |
| Queue Concurrency | 5 | BullMQ worker parallelism |
| Dedup Window | 300s | Message deduplication time window |

## Use Case Recipes

### Local Development

```bash
# Start with default dev mode (LLM + SPAO on)
node dist/cli.js

# Add Qdrant for RAG testing
node dist/cli.js serve --enable QDRANT

# Point at production WhatsApp API
node dist/cli.js serve --whatsapp-url https://wa-im.aziziafrica.com

# Override port
node dist/cli.js serve --port 4000
```

### CI Testing

```bash
# All features off, exit code reflects dep health
node dist/cli.js check --json

# Start server in test mode (no external deps required for unit tests)
node dist/cli.js serve --mode test
```

### Prompt Evaluation

```bash
# eval mode: LLM + Qdrant + SPAO, no queue/auth
node dist/cli.js serve --mode eval

# Test intent detection standalone
node dist/cli.js intent:detect "I want to learn about farming" --json

# Search RAG
node dist/cli.js rag:search "crop insurance" --collection somo_buruka --limit 3 --json
```

### User Management

```bash
# Register a user
node dist/cli.js user:register --identifier 254722833440 --name "Jane Doe" --tags SOMO,PILOT

# Look up a user
node dist/cli.js user:get 254722833440 --json

# List all users
node dist/cli.js user:list --json
```

### Configuration Management

```bash
# Get a config value
node dist/cli.js config:get --key tag_config_SOMO --json

# Set a config value (auto-parsed as JSON)
node dist/cli.js config:set --key welcome_enabled --value true

# List configs by prefix
node dist/cli.js config:list --prefix tag_config_ --json
```

### Agent/Script Integration

```bash
# Get full service metadata as JSON for programmatic use
node dist/cli.js info --json

# Extract just routes
node dist/cli.js info --json | jq '.data.routes[] | {method, path}'

# Extract feature flag status
node dist/cli.js info --json | jq '.data.feature_flags[] | {name, current}'

# Check deps and fail CI if anything is unreachable
node dist/cli.js check --json || echo "DEPENDENCY CHECK FAILED"
```

## Source Files

| File | Purpose |
|------|---------|
| `src/server_meta.ts` | Static metadata declarations (zero side effects, zero imports) |
| `src/cli.ts` | CLI entry point with subcommand dispatch |
| `src/shared/config.ts` | Runtime configuration (reads env vars set by CLI) |

## Convention

When modifying the service codebase, keep `server_meta.ts` in sync:

- **New route** -- add to `ROUTES` array in the same commit
- **New feature flag** -- add to `FEATURE_FLAGS` and update all `MODE_PRESETS` in the same commit
- **New dependency** -- add to `DEPENDENCIES` in the same commit
- **New CLI command** -- add to `COMMANDS` array and `COMMAND_DISPATCH` map in the same commit
