# CLAUDE.md - WhatsApp n8n Service Package

Package-specific guidance for Claude Code when working in `packages/whatsapp-service/`.

## Package Overview

**Event processing service** with tag-based routing, RAG memory, and user management. Receives events from whatsapp-api and routes them through configurable handlers.

**Version**: 2.0.0
**Architecture**: Express API + MongoDB state + Redis queue (optional) + Qdrant RAG (optional)

### Architecture

```
whatsapp-api → /service/events → eventRouter → handlers → response
                                      │
                                      ├── messageRouter (tag detection, dedup)
                                      ├── keywordHandler (echo, ping, help)
                                      ├── qdrantHandler (RAG memory)
                                      ├── llmService (intent detection, menus)
                                      └── welcomeService (auto-welcome)
```

n8n workflows are no longer used for routing. All logic is in TypeScript handlers.

**Migration details:** [spec/13-n8n-to-service-migration.md](../../spec/13-n8n-to-service-migration.md) - Why and how routing moved from n8n to TypeScript.

---

## Quick Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm run type-check   # Type check only (no emit)
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix lint issues
npm test             # Run Jest tests
npm run test:watch   # Watch mode for TDD
npm run tsoa         # Regenerate OpenAPI spec
```

---

## Directory Structure

```
src/
├── index.ts                    # Express server entry point
├── routes/                     # Express route modules
│   ├── events.ts               # POST /service/events/:sessionId
│   ├── users.ts                # User registration, tag management
│   ├── tags.ts                 # Tag configuration CRUD
│   ├── welcome.ts              # Welcome message configuration
│   ├── auth.ts                 # Keycloak OIDC endpoints
│   ├── health.ts               # Health checks
│   ├── media.ts                # Media proxy/cache
│   ├── progress.ts             # Learning module progress
│   └── queue.ts                # Queue statistics
├── handlers/
│   ├── messageRouter.ts        # Tag detection, dedup, filtering
│   └── keywordHandler.ts       # echo, ping, help, status commands
├── services/
│   ├── eventRouter.ts          # Tag-based routing engine
│   ├── eventQueue.ts           # BullMQ async processing
│   ├── qdrantHandler.ts        # RAG memory, hybrid search
│   ├── llmService.ts           # LLM intent detection, menus, help
│   ├── welcomeService.ts       # Auto-welcome on tag assignment
│   ├── threadDetector.ts       # Conversation thread detection
│   └── mediaCache.ts           # External media caching
├── dispatcher/
│   ├── webhookDispatcher.ts    # n8n action → API client (legacy)
│   └── whatsappApiClient.ts    # Axios wrapper for whatsapp-api
├── types/
│   ├── webhook.ts              # Webhook action data types
│   ├── routing.ts              # Tag config, routing targets
│   ├── llm.ts                  # LLM intent, completion types
│   ├── memory.ts               # Conversation memory types
│   ├── session.ts              # Multi-session types
│   ├── auth.ts                 # Authentication types
│   └── WhatsApp.ts             # WhatsApp message/event types
├── shared/
│   └── config.ts               # Environment configuration
└── utils/
    └── stateManager.ts         # MongoDB state (users, config)
```

---

## Type System

### Strict TypeScript Policy

- **No `any` types** - Use `unknown` for truly dynamic data
- **Type guards** for runtime type narrowing
- **Generic types** for flexible APIs (`ApiResponse<T>`)
- **Double-cast pattern** for webhook payloads: `data as unknown as TypeName`

### Key Type Files

| File | Purpose |
|------|---------|
| `src/types/webhook.ts` | Webhook action data interfaces (SendMessageData, CreateGroupData, etc.) |
| `src/types/session.ts` | Multi-session types (SessionConfig, SessionMetadata) |
| `src/types/auth.ts` | Authentication types, user roles, session data |
| `src/types/whatsapp-web.d.ts` | Type declarations for whatsapp-web.js |

### Type Patterns

```typescript
// 1. Generic API Response
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 2. Type guard for error handling
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return typeof error === 'object' && error !== null && 'message' in error;
}

// 3. Double-cast for dynamic webhook data
case 'send_message':
  return this.handleSendMessage(sessionId, data as unknown as SendMessageData);

// 4. Config value type (avoids recursive type issues)
type ConfigValue = string | number | boolean | null | unknown[] | Record<string, unknown>;
```

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

**Memory architecture:** [docs/architecture/05-memory-schema-enhancements.md](../../docs/architecture/05-memory-schema-enhancements.md) - RAG memory schema and conversation context.

### LLM Conversational AI (Optional - enables intent detection, dynamic help)

```bash
ENABLE_LLM=true
OPENROUTER_API_KEY=sk-or-...    # Shared with Qdrant
LLM_MODEL=x-ai/grok-2           # OpenRouter model ID
BRAND_NAME=Azizi Africa         # Organization name in messages
```

**Architecture:** [docs/architecture/06-llm-conversational-system.md](../../docs/architecture/06-llm-conversational-system.md) - Intent detection, welcome flow, dynamic help.

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

**Setup guide:** [docs/keycloak/01-setup-guide.md](../../docs/keycloak/01-setup-guide.md) - Keycloak realm configuration, client setup, organization scoping.

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

---

## API Endpoints

All endpoints under `/service` prefix.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/health` | Full health check |
| GET | `/service/ping` | Simple ping |
| GET | `/service/health/ready` | Readiness probe |

### Events

| Method | Path | Description |
|--------|------|-------------|
| POST | `/service/events/:sessionId` | Main event receiver from wwebjs-api |

**Handlers:** `eventRouter.ts` routes to `messageRouter`, `keywordHandler`, `qdrantHandler`, `welcomeService`.

### Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/service/users/register` | Register new user with tags |
| GET | `/service/users/list` | List users (with filters) |
| GET | `/service/users?identifier=X` | Get user by identifier |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/tags/:tag/config` | Get tag configuration |
| POST | `/service/tags/:tag/config` | Create/update tag config |
| DELETE | `/service/tags/:tag/config` | Delete tag config |

### Welcome Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/welcome-messages/:tag` | Get welcome message for tag |
| POST | `/service/welcome-messages/:tag` | Set welcome message |
| DELETE | `/service/welcome-messages/:tag` | Delete welcome message |

### Media

| Method | Path | Description |
|--------|------|-------------|
| POST | `/service/media/proxy` | Proxy external media |
| GET | `/service/media/cache/:id` | Get cached media |

### Queue (if enabled)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/queue/stats` | Queue statistics |
| GET | `/service/queue/failed` | Failed jobs |

**Full API reference:** [docs/whatsapp/02-api-reference.md](../../docs/whatsapp/02-api-reference.md) - Complete request/response schemas.

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

## Service Initialization Order

In `src/index.ts`, setup happens in two phases:

### 1. Synchronous Setup (before `startServer()`)
- Express middleware (helmet, cors, rate limiting)
- Swagger UI setup (`setupSwagger(app)`)
- tsoa routes (`RegisterRoutes(app)`)

### 2. Async Setup (inside `startServer()`)
- State manager, media cache
- Keycloak OIDC client (if enabled)
- Session middleware (requires Redis)
- Service router (after session middleware)
- Event queue, Qdrant handler

**Why order matters:** Session middleware must come before routes that need `req.session`. tsoa routes are generated and don't have access to async-initialized services.

---

## Critical: Mirror wwebjs-api Schemas

**All user data and message payloads must mirror wwebjs-api schemas exactly.** This ensures payloads can be sent directly to wwebjs-api without transformation:

```typescript
// CORRECT - Mirrors wwebjs-api sendMessage schema exactly
interface WelcomeMessageItem {
  contentType: MessageContentType;
  content: string | MediaContent | LocationContent | PollContent | ContactContent;
  options?: MessageOptions;
}

// CORRECT - Can forward directly to wwebjs-api
await apiClient.sendMessage(sessionId, {
  chatId,
  contentType: item.contentType,
  content: item.content,
  options: item.options,
});

// WRONG - Custom schema requiring transformation
interface CustomMessage {
  text: string;
  imageUrl?: string;  // Non-standard field
}
```

**Why:** Eliminates transformation bugs, makes debugging easier, allows new wwebjs-api features to work immediately.

---

## Service Initialization Order

In `src/index.ts`, setup happens in two phases:

### 1. Synchronous Setup (before `startServer()`)
- Express middleware (helmet, cors, rate limiting)
- Swagger UI setup (`setupSwagger(app)`)
- tsoa routes (`RegisterRoutes(app)`)

### 2. Async Setup (inside `startServer()`)
- State manager, media cache
- Keycloak OIDC client (if enabled)
- Session middleware (requires Redis)
- Service router (after session middleware)
- Event queue, Qdrant handler

**Why order matters:**
- Session middleware must come before routes that need `req.session`
- tsoa routes are generated and don't have access to async-initialized services
- Swagger setup is synchronous and must happen before server starts

---

## Development Patterns

### Adding a New Webhook Action

**Before coding**, verify the action exists in upstream:
- Check [whatsapp-api endpoints](../../vendor/whatsapp-api/src/) for the REST endpoint
- Check [n8n node definitions](../whatsapp-n8n-nodes/) for the action schema

Then:

1. **Add type** in `src/types/webhook.ts`:
   ```typescript
   export interface NewActionData {
     requiredField: string;
     optionalField?: number;
   }
   ```

2. **Add to union type**:
   ```typescript
   export type WebhookActionData = ... | NewActionData;
   export type WebhookActionName = ... | 'new_action';
   ```

3. **Add case in dispatcher** (`src/dispatcher/webhookDispatcher.ts`):
   ```typescript
   case 'new_action':
     return this.handleNewAction(sessionId, data as unknown as NewActionData);
   ```

4. **Add API client method** if needed (`src/dispatcher/whatsappApiClient.ts`)

5. **Run checks**: `npm run type-check && npm run lint`

### Error Handling Pattern

```typescript
try {
  const result = await this.apiClient.someMethod(sessionId, data);
  return { success: true, data: result };
} catch (error: unknown) {
  return { success: false, error: getErrorMessage(error) };
}
```

---

## Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode (TDD)
npm run test:coverage # Coverage report
```

**Environment Setup**: Tests requiring config must set env vars **before imports**:

```typescript
// CORRECT - Set before imports
process.env.API_KEY = 'test-api-key';
import { something } from '../src/module';

// WRONG - Config already loaded
import { something } from '../src/module';
process.env.API_KEY = 'test-api-key';
```

Test files should be colocated: `src/dispatcher/webhookDispatcher.test.ts`

---

## Common Issues

### Type Errors

**Issue**: `Type 'X' is not assignable to type 'Record<string, unknown>'`
**Fix**: Use double-cast: `data as unknown as RequestData`

**Issue**: `Type instantiation is excessively deep`
**Fix**: Avoid recursive types. Use `unknown[]` instead of `T[]` for generic containers.

### Lint Warnings

**Issue**: `Unexpected any. Specify a different type`
**Fix**: Replace `any` with `unknown` and add type guards if needed.

---

## Critical Operations

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
- Consult [whatsapp-web.js docs](https://docs.wwebjs.dev/) for current API behavior
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

---

## New Features Available (Optional)

The migrated whatsapp-api fork (v1.34.4) includes new optional features:

### WebSocket Support
Real-time event streaming as an alternative to webhooks:
```bash
ENABLE_WEBSOCKET=true
```
Connect to `/ws/:sessionId` for real-time events.

### WhatsApp Channels
Full API support for WhatsApp Channels (create, subscribe, unsubscribe, search).

### Message Editing
Edit previously sent messages via `POST /message/edit/{sessionId}`.

### Pairing Code Authentication
Alternative to QR code scanning for headless setups via `POST /session/requestPairingCode/{sessionId}`.

**Full feature list:** [docs/whatsapp/02-api-reference.md](../../docs/whatsapp/02-api-reference.md)
