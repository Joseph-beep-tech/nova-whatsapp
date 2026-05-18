# Socket.io Real-Time Engine

## Overview

The Socket.io real-time engine enables WebSocket-based event streaming from `whatsapp-service` to the HITL dashboard. Dashboard clients receive live updates for messages, session status, and chat activity without polling.

**Issue**: #12 (Socket.io real-time engine for dashboard)
**Feature flag**: `ENABLE_SOCKET=true`

## Architecture

```
Dashboard (browser)                    whatsapp-service
┌─────────────┐                       ┌────────────────────────────┐
│ socket.io   │ ◄──── WebSocket ────► │ EventHub (Socket.io Server)│
│ client      │                       │    │                       │
│             │                       │    ▼                       │
│ message:new │                       │ eventRouter.emitSocketEvent│
│ chat:update │                       │    │                       │
│ session:    │                       │ ┌──▼──────────────────┐    │
│  status     │                       │ │ processEvent()      │    │
│ message:    │                       │ │ routeEventSync()    │    │
│  update     │                       │ └─────────────────────┘    │
└─────────────┘                       └────────────────────────────┘
```

### Event Flow

1. WhatsApp events arrive via `POST /service/events/:sessionId`
2. `eventRouter.processEvent()` or `routeEventSync()` processes the event
3. For `message_create`: emit happens **after** dedup/fromMe filter (only inbound user messages)
4. For `message_ack`, `qr`, `ready`, `disconnected`, etc.: emit happens immediately
5. `EventHub.emit*()` emits to the session room (if payload has `sessionId`), otherwise broadcasts to all

### Files

| File | Purpose |
|------|---------|
| `src/services/eventHub.ts` | Socket.io server wrapper, auth middleware, typed emitters |
| `src/types/socket.ts` | Event payload interfaces (`SocketMessagePayload`, etc.) |
| `src/utils/socketPayloads.ts` | Payload builders (`toSocketMessage`, `toSocketSessionStatus`, etc.) |
| `src/shared/config.ts` | `socketConfig` — feature flag and path configuration |

## Configuration

```bash
# Enable Socket.io server (default: false)
ENABLE_SOCKET=true

# Socket.io path (default: /socket.io)
SOCKET_PATH=/socket.io

# CORS origins (shared with Express, comma-separated)
CORS_ORIGINS=http://localhost:3001,http://localhost:3002
```

## Authentication

Socket.io connections require one of:

### 1. API Key (backend clients, automation)

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { apiKey: 'your-api-key' },
  query: { sessionId: 'mysession' },
});
```

Or via header:
```typescript
const socket = io('http://localhost:3001', {
  extraHeaders: { 'x-api-key': 'your-api-key' },
});
```

### 2. Keycloak Session Cookie (dashboard browser clients)

When `ENABLE_KEYCLOAK_AUTH=true`, the Express session middleware is shared with Socket.io's HTTP engine. Dashboard clients authenticated via Keycloak OIDC can connect without an API key — the session cookie is validated automatically.

```typescript
// Dashboard — cookie sent automatically by browser
const socket = io('https://wa.dater.world', {
  withCredentials: true,
  query: { sessionId: 'mysession' },
});
```

### Rejection

Unauthenticated connections receive a `connect_error` with message `"Authentication required"`.

## Events

| Event | Payload | When |
|-------|---------|------|
| `message:new` | `SocketMessagePayload` | Inbound message passes dedup + fromMe filter |
| `message:update` | `SocketMessageUpdatePayload` | Message ack status change (sent → delivered → read) |
| `chat:update` | `SocketChatUpdatePayload` | Emitted with `message:new` — refreshes chat list |
| `session:status` | `SocketSessionStatusPayload` | Session lifecycle: qr, authenticated, ready, disconnected |
| `typing:start` | `{ chatId, identifier?, platform? }` | (Infrastructure ready, not yet wired) |
| `typing:stop` | `{ chatId, identifier?, platform? }` | (Infrastructure ready, not yet wired) |

### Payload Types

```typescript
interface SocketMessagePayload {
  id: string;
  identifier: string;
  platform: string;
  content: string;
  contentType: string;
  timestamp: string; // ISO 8601
  sender: { type: 'customer' | 'bot' | 'agent'; name: string };
  status: string;
  isFromMe: boolean;
}

interface SocketSessionStatusPayload {
  sessionId: string;
  status: 'connected' | 'disconnected' | 'qr_required' | 'loading';
  qrCode?: string; // Base64 QR data (only for qr_required)
}
```

## Test Plan

### Prerequisites

```bash
# Start MongoDB (required for integration tests; Redis not needed for socket tests)
cd packages/whatsapp-service
docker compose -f docker-compose.dev.yml up -d mongodb

# Verify services are healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Unit Tests (no external dependencies)

Run via `npm test -w packages/whatsapp-service`:

| Test | What it covers |
|------|---------------|
| `socketPayloads.ts` builders | `toSocketMessage`, `toSocketMessageUpdate`, `toSocketSessionStatus` produce correct payloads from RoutableEvent data |
| EventHub emit methods | Each typed emitter is no-op when `io` is null |
| Config parsing | `socketConfig.enabled` is `false` by default, `true` when env set |

### Integration Tests (require MongoDB)

Run via `npm test -w packages/whatsapp-service -- socketEventHub`:

| Test | What it covers |
|------|---------------|
| **Auth: reject no key** | Connection without API key or session gets `connect_error` |
| **Auth: reject wrong key** | Invalid API key rejected |
| **Auth: accept valid key** | Valid API key via `auth.apiKey` connects successfully |
| **Auth: accept x-api-key header** | Valid API key via `extraHeaders['x-api-key']` connects |
| **message:new emission** | Inbound `message_create` → `message:new` with correct payload |
| **chat:update emission** | `chat:update` emitted alongside `message:new` |
| **fromMe filtering** | `message_create` with `fromMe=true` does NOT emit `message:new` |
| **message:update emission** | `message_ack` → `message:update` with correct ack status |
| **session:status (ready)** | `ready` event → `session:status { status: 'connected' }` |
| **session:status (qr)** | `qr` event → `session:status { status: 'qr_required', qrCode: '...' }` |
| **session:status (disconnected)** | `disconnected` → `session:status { status: 'disconnected' }` |
| **Client count tracking** | Connect/disconnect updates `getConnectedClients()` correctly |
| **Multiple clients** | 3+ concurrent clients all receive events |
| **Graceful shutdown** | `hub.shutdown()` closes all connections, resets state |

### Manual Smoke Test (full stack)

```bash
# 1. Start full dev stack
cd packages/whatsapp-service
docker compose -f docker-compose.dev.yml up -d

# 2. Start service with Socket.io enabled
ENABLE_SOCKET=true npm run dev

# 3. Connect via wscat or browser console
npx wscat -c 'ws://localhost:3001/socket.io/?EIO=4&transport=websocket' \
  --header 'x-api-key: YOUR_API_KEY'

# 4. Send a WhatsApp message to the bot number
# 5. Verify message:new event arrives on the websocket

# 6. Check session status by restarting whatsapp-api
docker restart whatsapp-api
# Verify session:status events (disconnected → qr/loading → ready)
```

### Production Verification

```bash
# After deployment with ENABLE_SOCKET=true:
curl -s https://wa.dater.world/service/health | jq .

# Connect and verify auth rejection:
npx wscat -c 'wss://wa.dater.world/socket.io/?EIO=4&transport=websocket'
# Should receive: "Authentication required"

# Connect with valid key:
npx wscat -c 'wss://wa.dater.world/socket.io/?EIO=4&transport=websocket' \
  --header 'x-api-key: YOUR_API_KEY'
# Should connect and receive events
```

## Initialization Order

Socket.io is initialized in `startServer()` after session middleware (for Keycloak cookie auth):

```
1. stateManager.init()
2. mediaCacheService.init()
3. Keycloak OIDC + session middleware (if enabled)
4. eventHub.init(httpServer, sessionMiddleware)  ← Socket.io
5. createServiceRouter() + mount routes
6. eventQueue, qdrantHandler, etc.
7. httpServer.listen()
```

## Security Considerations

- All connections must authenticate (API key or session cookie)
- Events with `sessionId` emit to session-scoped rooms; others broadcast to all clients
- CORS origins shared with Express configuration
- Feature is opt-in (`ENABLE_SOCKET=true`) — no behavior change on existing deployments
- Socket.io `engine.use(sessionMiddleware)` ensures session cookies are validated on every handshake
