# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp bot with event-driven architecture. **Monorepo** with two packages + one vendor submodule:

| Package | Description |
|---------|-------------|
| `packages/whatsapp-service/` | Event processing, tag-based routing, RAG memory, user management |
| `packages/whatsapp-n8n-nodes/` | Custom n8n community nodes (for optional n8n integration) |
| `packages/whatsapp-dashboard/` | React HITL dashboard for agent conversations |
| `vendor/whatsapp-api/` | Git submodule ([kulemantu/wwebjs-api](https://github.com/kulemantu/wwebjs-api)) |

**Production URL**: `https://wa.dater.world`

---

## Development Commands

```bash
# Service development
npm run dev:service     # WhatsApp n8n service (port 3001)
npm run dev:dashboard   # React HITL dashboard (port 3002)
npm run dev:nodes       # n8n nodes watch mode (optional)

# Build & check
npm run build           # Build all packages
npm run type-check      # TypeScript check
npm run lint            # ESLint
npm run lint:fix        # Auto-fix lint issues

# Testing
npm test                        # All tests
npm run test:watch              # Watch mode (TDD)
npm run test:coverage           # Coverage report
npm test MessageHandler.test.ts # Single file
npm test -w packages/whatsapp-service  # Single package
```

### Per-Package Commands
```bash
cd packages/whatsapp-service
npm run dev        # Dev server with hot reload
npm test           # Package tests
npm run type-check # Type check only
```

### Testing

**Structure:** `__tests__/{unit,api,fixtures}/` - flat OK for small packages

**Rules:** Tests with features, `npm test` before push, names match features

**Environment Setup**: Tests requiring config must set env vars **before imports**:
```typescript
// ✅ CORRECT - Set before imports
process.env.API_KEY = 'test-api-key';
import { something } from '../src/module';

// ❌ WRONG - Config already loaded
import { something } from '../src/module';
process.env.API_KEY = 'test-api-key';
```

---

## Architecture

### Message Flow (Current)
```
WhatsApp → wwebjs-api → whatsapp-service (eventRouter) → Response
                              │
                              ├── messageRouter: Tag detection, dedup, filtering
                              ├── keywordHandler: echo, ping, help commands
                              ├── qdrantHandler: RAG memory & responses
                              ├── llmService: Intent detection, dynamic menus
                              └── welcomeService: Auto-welcome on new tags
```

**Note**: n8n workflows are NO LONGER used for message routing. All routing logic is now in TypeScript handlers within whatsapp-service. See `spec/13-n8n-to-service-migration.md`.

### Key Services

| Service | Purpose |
|---------|---------|
| `eventRouter.ts` | Tag-based routing, event processing |
| `messageRouter.ts` | Message filtering, tag/keyword detection |
| `keywordHandler.ts` | Built-in commands (echo, ping, help, status) |
| `qdrantHandler.ts` | RAG memory, hybrid search, conversation context |
| `llmService.ts` | LLM intent detection, dynamic menus, help generation |
| `welcomeService.ts` | Auto-welcome messages on tag registration |
| `eventQueue.ts` | BullMQ async event processing |
| `threadDetector.ts` | Conversation thread boundaries |

### Auto-Tag Detection

Users are automatically registered with tags based on message keywords:
- Send "SOMO" → User gets `SOMO` tag + welcome message
- Tags configured in `messageRouter.ts` via regex patterns
- Welcome messages configured via `/service/welcome-messages/:tag` API

### Technology Stack
- **Backend**: TypeScript + Express + whatsapp-web.js (Puppeteer)
- **Queue**: Redis + BullMQ (async event processing)
- **Memory/RAG**: Qdrant (vector search) + MongoDB (state, summaries)
- **Storage**: MongoDB (users, config, progress) + Redis (queue, cache)
- **Testing**: Jest + Supertest
- **Deployment**: Docker + nginx-proxy

---

## Type System

**Strict TypeScript policy** - no `any` types allowed.

| Pattern | Example |
|---------|---------|
| Use `unknown` for dynamic data | `catch (error: unknown)` |
| Type guards for narrowing | `isErrorWithMessage(error)` |
| Double-cast for webhooks | `data as unknown as SendMessageData` |
| Generic responses | `ApiResponse<T>` |
| Avoid recursive types | Use `Record<string, unknown>` |

Key type files in `packages/whatsapp-service/src/types/`:
- `webhook.ts` - Webhook action data interfaces (20+)
- `session.ts` - Multi-session management types
- `WhatsApp.ts` - WhatsApp message/event types
- `whatsapp-web.d.ts` - whatsapp-web.js declarations
- `auth.ts` - Authentication types, session data, user roles

### Express Type Augmentation

Extend Express types via module augmentation (see `src/types/auth.ts`):
```typescript
// Extend Request with custom properties
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// Extend express-session
declare module 'express-session' {
  interface SessionData {
    tokens?: TokenSet;
    user?: AuthUser;
  }
}
```

---

## Automation Philosophy

**Prefer TypeScript over shell for anything beyond simple commands.**

| Complexity | Approach |
|------------|----------|
| Single command | Shell (`"clean": "rm -rf dist"`) |
| Multiple steps, conditionals, or error handling | TypeScript script (`npx tsx script.ts`) |

**Principles:**

1. **Testable over clever** - If logic can fail, it should be testable. Extract to functions, inject dependencies, mock externals.

2. **Declarative over imperative** - Define *what* should happen in typed data structures, not *how* in procedural code.
   ```typescript
   // Good: intent is clear
   const config = [
     { from: 'A', to: 'B', transform: uppercase },
   ];

   // Avoid: intent buried in procedure
   "script": "cat A | tr ... > B && ..."
   ```

3. **Single source of truth** - One canonical location for each piece of data. Everything else derives from it.

4. **Fail loud** - Errors should surface immediately, not propagate silently. Explicit checks over optimistic assumptions.

5. **Self-documenting** - Typed structures are searchable, hoverable, and refactorable. Shell strings are not.

---

## n8n Integration (Legacy Reference)

> **Note**: Message routing has moved from n8n workflows to TypeScript handlers in whatsapp-service. This section is kept for reference if you still use n8n for custom workflows.

### Docker Network URLs
When using n8n, containers must use internal Docker URLs:
```javascript
// WRONG: "https://wa.dater.world/client/sendMessage/mysession"
// CORRECT: "http://wwebjs-api:3000/client/sendMessage/{{ $json.sessionId }}"
```

---

## Configuration

### Required Environment Variables
```bash
API_KEY=<api-authentication-key>
WHATSAPP_API_URL=http://whatsapp-api:3000
MONGODB_URI=mongodb://mongodb:27017/whatsapp-service
```

### Event Queue (Optional - enables async processing)
```bash
ENABLE_EVENT_QUEUE=true
REDIS_URL=redis://redis:6379
QUEUE_CONCURRENCY=5
```

### Qdrant RAG (Optional - enables semantic memory)
```bash
ENABLE_QDRANT=true
QDRANT_URL=http://qdrant:6333
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=openai/gpt-4o-mini
```

### LLM Conversational AI (Optional - enables intent detection, dynamic help)
```bash
ENABLE_LLM=true
OPENROUTER_API_KEY=sk-or-...   # Shared with Qdrant
LLM_MODEL=x-ai/grok-2          # OpenRouter model ID
BRAND_NAME=Azizi Africa        # Organization name in messages
```

### Media Proxy (Optional)
```bash
MEDIA_CACHE_DIR=/tmp/whatsapp-media-cache
MEDIA_CACHE_TTL_SECONDS=300
```

### Keycloak Auth (Optional - enables OIDC login)
```bash
ENABLE_KEYCLOAK_AUTH=true
KEYCLOAK_ISSUER_URL=https://auth.dater.world/realms/dater
KEYCLOAK_CLIENT_ID=whatsapp-service
KEYCLOAK_CLIENT_SECRET=<from-keycloak>
SESSION_SECRET=<32+-char-random-string>
SESSION_TTL_SECONDS=86400
```

---

## Authentication

### Keycloak OIDC (v0.6.0+)

The admin UI uses Keycloak OIDC with BFF (Backend-for-Frontend) pattern:
- **Server-side sessions** in Redis (no tokens in browser)
- **httpOnly cookies** with `SameSite=Lax`
- **Keycloak organizations** for multi-tenant scoping

### User Roles

| Role | Access Level |
|------|--------------|
| `creator_admin` | Platform owner, global access to all tenants |
| `tenant_admin` | Tenant owner, full access to their organization |
| `agent` | Support agent, HITL conversation access |
| `automation_engineer` | Workflow builder, routing configuration |
| `read_only` | Observer, dashboard read-only access |

### Route Protection Matrix

| Route Pattern | Auth Method |
|---------------|-------------|
| `/service/health`, `/service/ping` | None (public) |
| `/service/auth/*` | Mixed (login public, me/logout require session) |
| `/service/admin/*` | Keycloak session (or basic auth fallback) |
| `/service/events/*`, `/service/webhook/*` | API Key (`x-api-key` header) |
| `/service/users/*`, `/service/tags/*` | API Key |

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/auth/login` | Redirect to Keycloak |
| GET | `/service/auth/callback` | OIDC callback handler |
| GET/POST | `/service/auth/logout` | Destroy session |
| GET | `/service/auth/me` | Current user info |
| GET | `/service/auth/status` | Auth system status |

See [docs/keycloak/01-setup-guide.md](docs/keycloak/01-setup-guide.md) for full setup.

---

## Task Management

Tasks are tracked in `tasks.json`. Each task should be completable in a single context window.

### Simple Task
```json
{
  "description": "Short description",
  "type": "fix|feature|improvement|docs|chore",
  "priority": 1,
  "status": "active",
  "context": { "files": ["src/file.ts"], "summary": "What these files do" },
  "tasks": ["Step 1", "Step 2"],
  "verification": ["How to verify", "docs/{folder}/ updated if user-facing"],
  "passes": false
}
```

### Complex Task (With Subtasks)
```json
{
  "description": "Complex feature",
  "type": "feature",
  "priority": 2,
  "status": "active",
  "subtasks": [
    { "id": "1-research", "priority": 1, "context": {...}, "tasks": [...], "output": "What this produces" },
    { "id": "2-implement", "priority": 2, "depends_on": ["1-research"], "context": {...}, "tasks": [...] }
  ],
  "passes": false
}
```

Rules:
- **Priority**: Decimal numbers (1, 2, 2.1, 3) - lower executes first. Use `null` for unprioritized
- **Status**: `active` (ready), `in_progress` (resume point), `blocked`, `cancelled`
- **8-file rule**: If task needs >8 files, break into subtasks
- Each subtask has its own `context.files` to minimize context loading
- Use `output` field to pass information between subtasks
- Set `passes: true` only after verification succeeds
- **Doc verification**: `feature` and user-facing tasks must verify `docs/` folder is updated
- See [.claude/rules/tasks.md](.claude/rules/tasks.md) for complete documentation

---

## Path Aliases

| Package | Alias | Maps To |
|---------|-------|---------|
| whatsapp-service | `@/*` | `src/*` |
| whatsapp-service | `@shared/*` | `src/shared/*` |
| whatsapp-dashboard | `@/*` | `src/*` |

---

## Frontend Patterns (Dashboard)

### Component Organization
```
src/components/
├── common/     # Reusable UI primitives (Avatar, Badge, Button)
├── chat/       # Chat domain (ChatList, MessageBubble)
├── contact/    # Contact domain (ContactPanel, Labels)
└── layout/     # App shell (Sidebar, AppShell)
```

### Auth Pattern
```
AuthProvider (context) → ProtectedRoute (guard) → RoleGate (conditional render)
```

| Component | Purpose |
|-----------|---------|
| `AuthProvider` | Wraps app, calls `/auth/me` on mount |
| `ProtectedRoute` | Route guard with `requiredRoles` prop |
| `RoleGate` | Conditional render: `<RoleGate roles={['admin']}>` |

### State Management (Zustand)
- **Separate stores by domain**: `authStore`, `chatStore`, `sessionStore`
- **No providers needed**: Direct import via hooks
- **Reset in tests**: `useStore.setState({...})` in `beforeEach`

### Testing (Vitest)
- Custom render with providers in `src/test/utils.tsx`
- Co-locate tests: `components/common/__tests__/Button.test.tsx`
- Mock stores directly: `useAuthStore.setState({ user: mockUser })`

---

## API Endpoints

### whatsapp-service (port 3001)

All endpoints under `/service` prefix:

| Category | Endpoints |
|----------|-----------|
| **Health** | `GET /service/health`, `/service/ping`, `/service/health/ready` |
| **Events** | `POST /service/events/:sessionId` - Main event receiver from wwebjs-api |
| **Webhook** | `POST /service/webhook` - n8n action dispatch |
| **Users** | `POST /service/users/register`, `GET /service/users/list`, `GET /service/users?identifier=X` |
| **Tags** | `GET/POST/DELETE /service/tags/:tag/config` - Tag routing configuration |
| **Welcome** | `GET/POST/DELETE /service/welcome-messages/:tag` |
| **Media** | `POST /service/media/proxy`, `GET /service/media/cache/:id` |
| **Progress** | `GET/POST /service/progress?identifier=X&tag=Y` - Learning module progress |
| **Queue** | `GET /service/queue/stats`, `/service/queue/failed` (if queue enabled) |

### wwebjs-api (port 3000)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/session/status/:sessionId` | Session status |
| GET | `/session/qr/:sessionId/image` | QR code image |
| POST | `/client/sendMessage/:sessionId` | Send message |

See [docs/whatsapp/02-api-reference.md](docs/whatsapp/02-api-reference.md) for full API.

---

## Git Commits

See global rule `~/.claude/rules/git-conventions.md` and [.claude/rules/git-commits.md](.claude/rules/git-commits.md) for full details (no auto-commit, conventional commits, sign-off, co-author, batch by concern).

---

## Git Worktrees

This repo uses worktrees in `.worktrees/` for parallel branch work.

```bash
# Create worktree for feature branch
git worktree add .worktrees/feature-name -b feature-name

# List all worktrees
git worktree list

# Work in isolation
cd .worktrees/feature-name

# Remove when merged
git worktree remove .worktrees/feature-name
```

**Before force-pushing:** Always use `--force-with-lease` instead of `--force` to prevent overwriting others' work.

---

## Deployment

### Server Structure

The monorepo is deployed to `/var/opt/wa.dt.wrld`:

```
/var/opt/wa.dt.wrld/                    # Git repo (CORRECT PATH)
├── packages/whatsapp-service/      # Service code
├── vendor/whatsapp-api/                # Submodule (kulemantu/wwebjs-api)
├── deploy/                             # Production docker-compose
│   ├── whatsapp-api/
│   │   └── patches/                    # Runtime patches for wwebjs-api
│   └── whatsapp-service/
└── data/whatsapp-sessions/             # Persistent data (gitignored)
```

### Standard Deployment

```bash
# SSH and pull latest
ssh root@no.flow
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api

# Rebuild and restart services
cd deploy/whatsapp-api && docker compose up -d --build
cd ../whatsapp-service && docker compose up -d --build
```

### Local Development

```bash
docker compose up -d                    # Full stack locally
docker compose -f docker-compose.dev.yml up  # Development mode
```

### Server Access
```bash
ssh root@no.flow
cd /var/opt/wa.dt.wrld

# View logs
docker logs -f wwebjs-api --tail 100
docker logs -f whatsapp-service --tail 100
```

### Health Checks
```bash
curl https://wa.dater.world/service/health   # Note: /service/health not /health
curl https://wa.dater.world/ping # Whatsapp-API service
```

---

## API Documentation

Interactive API docs at `/api-docs/service` using Swagger UI + tsoa.

### Adding New Endpoints

1. Create/update controller in `src/controllers/`
2. Add types to `src/types/api.ts`
3. Run `npm run tsoa` to regenerate spec
4. Verify at `/api-docs/service`

### tsoa Controller Gotchas

- **Method name conflicts**: Don't use `getStatus`, `setStatus`, `setHeader` - these exist on base `Controller` class
- **Auth endpoints**: Use session auth (no `@Security('api_key')`), actual implementation in `src/routes/auth.ts`
- **Redirect endpoints**: Return `void` and use `this.setStatus(302)` + `this.setHeader('Location', url)`

---

## Related Documentation

| File | Purpose |
|------|---------|
| [README.md](README.md) | Quick start guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [packages/whatsapp-service/CLAUDE.md](packages/whatsapp-service/CLAUDE.md) | Service-specific guidance |
| [packages/whatsapp-dashboard/CLAUDE.md](packages/whatsapp-dashboard/CLAUDE.md) | Dashboard-specific guidance |
| [docs/whatsapp/02-api-reference.md](docs/whatsapp/02-api-reference.md) | WhatsApp API reference |
| [docs/dashboard/01-dashboard-overview.md](docs/dashboard/01-dashboard-overview.md) | Dashboard architecture |
| [docs/keycloak/01-setup-guide.md](docs/keycloak/01-setup-guide.md) | Keycloak OIDC setup |
| [docs/architecture/05-memory-schema-enhancements.md](docs/architecture/05-memory-schema-enhancements.md) | RAG memory architecture |
| [spec/13-n8n-to-service-migration.md](spec/13-n8n-to-service-migration.md) | Migration from n8n workflows |
| [.claude/rules/tasks.md](.claude/rules/tasks.md) | Task system rules |
| [.claude/rules/git-commits.md](.claude/rules/git-commits.md) | Git commit workflow (no auto-commit) |

---

## Quick Reference

```bash
# Run tests
npm run test:watch

# Type check
npm run type-check

# Deploy (git-based)
git push origin main
ssh root@no.flow "cd /var/opt/wa.dt.wrld && git pull && git submodule update --remote vendor/whatsapp-api"
ssh root@no.flow "cd /var/opt/wa.dt.wrld/deploy/whatsapp-api && docker compose up -d --build"
ssh root@no.flow "cd /var/opt/wa.dt.wrld/deploy/whatsapp-service && docker compose up -d --build"
```

---

## Critical Operations (from Working Sessions)

### WhatsApp Session Management

**Active Session:** `mysession` (bot number: 254748085137)

```bash
# Get fresh QR code
curl -s "https://wa.dater.world/session/qr/mysession/image" \
  -H "x-api-key: YOUR_API_KEY" \
  -o /tmp/whatsapp_qr.png && open /tmp/whatsapp_qr.png

# Check session status
ssh root@no.flow "curl -s -H 'x-api-key: YOUR_API_KEY' http://localhost:3000/session/status/mysession"

# Monitor logs for message events
ssh root@no.flow "docker logs wwebjs-api --since 1m 2>&1 | grep -E '(ready|authenticated|message)'"
```

### Debugging Order (Critical)

**Never modify wwebjs-api container as first resort.** Follow this order:

1. **Check whatsapp-service logs first** - Most issues are in the routing/translation layer
2. **Check nginx-proxy logs** - Routing and SSL issues
3. **Check wwebjs-api logs** - Only if the above are clean
4. **Modify wwebjs-api container as LAST RESORT** - It's the most fragile layer

**Before any wwebjs-api changes:**
- Consult [context7 whatsapp-web.js docs](https://context7.com/websites/wwebjs_dev) for current API behavior
- Check [whatsapp-web.js GitHub issues](https://github.com/pedroslopez/whatsapp-web.js/issues) for known problems

### When Message Callbacks Stop Working

1. **Check console errors** for module errors like `"Requiring unknown module..."`
2. **Check [whatsapp-web.js releases](https://github.com/pedroslopez/whatsapp-web.js/releases)** for fixes
3. **Update version** in `vendor/whatsapp-api/package.json`
4. **Run** `npm update whatsapp-web.js` to update lock file
5. **Commit, push, and redeploy**

### Patch System

Runtime patches for wwebjs-api are in `/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/`:

```bash
# After container rebuild, apply patches
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
./patches/apply-patches.sh && docker restart wwebjs-api

# Or use convenience script
./patches/rebuild-and-patch.sh
```

### Event Sequence (Expected)

```
qr → loading_screen → authenticated → ready → message_create
```

If `ready` event doesn't fire, message callbacks won't work.

### wwebjs-api Content Types (Common Gotcha)

| contentType | content format |
|-------------|---------------|
| `string` | Plain text string |
| `MessageMedia` | `{mimetype, data, filename}` where `data` is **base64** |
| `MessageMediaFromURL` | **URL string directly** (NOT an object with url property!) |

**Wrong:** `{"contentType": "MessageMediaFromURL", "content": {"url": "https://..."}}`
**Correct:** `{"contentType": "MessageMediaFromURL", "content": "https://..."}`
