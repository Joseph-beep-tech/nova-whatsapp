# PRD: Multi-Target Webhook Routing for WhatsApp n8n Integration

## Executive Summary

**Problem:** wwebjs-api supports only ONE `BASE_WEBHOOK_URL`, preventing multiple n8n workflows from receiving WhatsApp events simultaneously.

**Solution:** A two-phase approach:
1. **Phase 1 (Prototype):** n8n Router Workflow for immediate validation
2. **Phase 2 (Production):** Hybrid B+C architecture where whatsapp-service acts as the central webhook router with automatic n8n node registration

---

## Background

### Current State

```
wwebjs-api ──(single URL)──► n8n echo workflow
                              │
                              ✗ Custom WhatsApp Bot Trigger (never receives events)
```

| Component | Status |
|-----------|--------|
| wwebjs-api | Single `BASE_WEBHOOK_URL` env var |
| WhatsApp Bot Trigger | Deployed, filtering works, but no events received |
| whatsapp-service | Exists with `/events` endpoint and registration API |
| Echo workflow | Working, receives all events |

### Why This Matters

1. **Testing blocked** - Can't validate custom trigger without breaking echo workflow
2. **Production limitation** - Can't run multiple WhatsApp-triggered workflows
3. **Manual switching** - Must edit `BASE_WEBHOOK_URL` and restart container for each workflow

---

## Goals & Non-Goals

### Goals
- Enable multiple n8n workflows to receive WhatsApp events simultaneously
- Automatic registration when workflows activate (no manual config per workflow)
- Filtering at router level to reduce unnecessary HTTP calls
- Hot-reload configuration without service restart
- Backward compatible (existing echo workflow continues working)

### Non-Goals
- Modifying wwebjs-api source code
- Modifying n8n core
- Multi-tenant isolation (single deployment serves one WhatsApp account)
- Message queuing/persistence (fire-and-forget fanout)

---

## Phase 1: Prototype (Option A - n8n Router Workflow)

**Purpose:** Validate that custom WhatsApp Bot Trigger works correctly before investing in infrastructure.

### Architecture

```
wwebjs-api ──► /webhook/whatsapp/router (Router Workflow)
                         │
                   ┌─────┴─────┐
                   ▼           ▼
            Execute Workflow   Execute Workflow
                   │           │
                   ▼           ▼
            Echo Workflow   WhatsApp Bot Trigger Workflow
```

### Implementation Steps

1. **Create Router Workflow in n8n UI**
   - Webhook trigger: `POST /webhook/whatsapp/router`
   - Code node: Extract and normalize payload
   - Switch node: Route by `dataType`
   - Execute Workflow nodes: Fan out to target workflows

2. **Modify Target Workflows**
   - Replace Webhook trigger with "Execute Workflow Trigger"
   - OR keep Webhook and have router use HTTP Request nodes

3. **Update wwebjs-api**
   ```bash
   BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router
   ```

### Validation Criteria
- [ ] Echo workflow receives messages and replies
- [ ] WhatsApp Bot Trigger workflow receives messages
- [ ] Both filter correctly (fromMe, isGroup, eventType)
- [ ] No duplicate processing

### Limitations (Why Phase 2 is Needed)
- Extra n8n execution per message (router + target)
- Manual workflow management (add Execute Workflow node for each new target)
- No external consumers (everything must be n8n workflow)
- Target workflows must use Execute Workflow Trigger (not standard Webhook)

---

## Phase 2: Production Architecture (Hybrid B+C)

### Design Philosophy

Combine the best of Option B and C:
- **From Option B:** whatsapp-service as central router with JSON config for static routes
- **From Option C:** n8n nodes auto-register via `webhookMethods` lifecycle

This creates a **hub-and-spoke model** where whatsapp-service is the hub.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Server: wa.dater.world                         │
│                                                                             │
│  ┌──────────────┐          ┌─────────────────────────────────────────────┐ │
│  │              │          │            whatsapp-service                  │ │
│  │  wwebjs-api  │─────────►│                                             │ │
│  │              │  POST    │  ┌─────────────────────────────────────┐   │ │
│  │  :3000       │ /inbound │  │         WebhookRouter               │   │ │
│  │              │          │  │                                     │   │ │
│  └──────────────┘          │  │  ┌─────────────┐ ┌───────────────┐ │   │ │
│                            │  │  │   Dynamic   │ │    Static     │ │   │ │
│                            │  │  │ Registrations│ │   Routes      │ │   │ │
│                            │  │  │ (from n8n)  │ │ (routes.json) │ │   │ │
│                            │  │  └──────┬──────┘ └───────┬───────┘ │   │ │
│                            │  │         │                │         │   │ │
│                            │  │         └───────┬────────┘         │   │ │
│                            │  │                 │                   │   │ │
│                            │  │          Filter & Fanout            │   │ │
│                            │  │       (Promise.allSettled)          │   │ │
│                            │  └─────────────────┬───────────────────┘   │ │
│                            │                    │                       │ │
│                            │  :3001             │                       │ │
│                            └────────────────────┼───────────────────────┘ │
│                                                 │                         │
│         ┌───────────────────┬──────────────────┼──────────────────┐      │
│         │                   │                  │                  │      │
│         ▼                   ▼                  ▼                  ▼      │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐    ┌────────────┐ │
│  │ n8n        │     │ n8n        │     │ n8n        │    │ External   │ │
│  │ Workflow 1 │     │ Workflow 2 │     │ Workflow 3 │    │ Consumer   │ │
│  │ (dynamic)  │     │ (dynamic)  │     │ (dynamic)  │    │ (static)   │ │
│  └────────────┘     └────────────┘     └────────────┘    └────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. WebhookRouter Module

**Location:** `packages/whatsapp-service/src/router/webhookRouter.ts`

**Responsibilities:**
- Load static routes from `config/routes.json`
- Merge with dynamic registrations from stateManager
- Apply filters before forwarding
- Parallel fanout with `Promise.allSettled`
- Hot-reload on config file change

**Route Resolution Priority:**
1. Enabled static routes (from JSON)
2. Dynamic registrations (from n8n)
3. If same URL exists in both, static config overrides (allows admin disable)

**Data Structures:**

```typescript
interface RouteTarget {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  url: string;                   // Target webhook URL
  events: string[];              // ['message', '*']
  filters: {
    fromMe?: boolean;            // undefined = any
    isGroup?: boolean;           // undefined = any
    sessionId?: string;          // undefined = any
  };
  headers?: Record<string, string>;
  enabled: boolean;
  source: 'static' | 'dynamic';  // Where this route came from
  priority?: number;             // Lower = higher priority (for ordering)
  registeredAt?: Date;           // For dynamic routes
}

interface RoutingDecision {
  target: RouteTarget;
  shouldForward: boolean;
  reason?: string;               // Why filtered out
}
```

**Filtering Algorithm:**

```typescript
function shouldForward(route: RouteTarget, event: WebhookEvent): RoutingDecision {
  // 1. Check enabled
  if (!route.enabled) {
    return { target: route, shouldForward: false, reason: 'disabled' };
  }

  // 2. Check event type
  if (!route.events.includes('*') && !route.events.includes(event.dataType)) {
    return { target: route, shouldForward: false, reason: `event_type_mismatch: ${event.dataType}` };
  }

  // 3. Check fromMe filter
  if (route.filters.fromMe !== undefined && route.filters.fromMe !== event.fromMe) {
    return { target: route, shouldForward: false, reason: `fromMe_mismatch: ${event.fromMe}` };
  }

  // 4. Check isGroup filter
  if (route.filters.isGroup !== undefined && route.filters.isGroup !== event.isGroup) {
    return { target: route, shouldForward: false, reason: `isGroup_mismatch: ${event.isGroup}` };
  }

  // 5. Check sessionId filter
  if (route.filters.sessionId && route.filters.sessionId !== event.sessionId) {
    return { target: route, shouldForward: false, reason: `sessionId_mismatch` };
  }

  return { target: route, shouldForward: true };
}
```

#### 2. Registration API

**Endpoints:**

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/webhook/register` | Register dynamic route | API Key |
| POST | `/webhook/unregister` | Remove dynamic route | API Key |
| GET | `/webhook/routes` | List all routes (masked URLs) | API Key |
| POST | `/webhook/routes/reload` | Hot-reload static config | API Key |
| GET | `/webhook/routes/:id` | Get specific route details | API Key |
| PATCH | `/webhook/routes/:id` | Update route (enable/disable) | API Key |

**Registration Request:**

```typescript
// POST /webhook/register
{
  "webhookUrl": "http://n8n:5678/webhook/abc123/webhook",
  "events": ["message", "message_create"],
  "filters": {
    "fromMe": false,
    "isGroup": false
  },
  "name": "WhatsApp Bot Trigger - My Workflow",  // Optional, for logging
  "metadata": {                                    // Optional, for debugging
    "workflowId": "abc123",
    "nodeId": "xyz789"
  }
}

// Response
{
  "success": true,
  "registration": {
    "id": "reg_abc123",
    "url": "http://n8n:5678/webhook/.../webhook",
    "events": ["message", "message_create"],
    "filters": { "fromMe": false, "isGroup": false },
    "source": "dynamic",
    "registeredAt": "2026-01-20T10:00:00Z"
  }
}
```

#### 3. Static Routes Configuration

**Location:** `packages/whatsapp-service/config/routes.json`

**Use Cases:**
- Default catch-all logger for debugging
- Non-n8n consumers (external webhook endpoints)
- Admin override to disable specific routes
- Fallback routes if n8n is down

```json
{
  "$schema": "./routes.schema.json",
  "version": "1.0",
  "routes": [
    {
      "id": "debug-logger",
      "name": "Debug Logger (All Events)",
      "url": "http://n8n:5678/webhook/debug-logger/webhook",
      "events": ["*"],
      "filters": {},
      "enabled": false,
      "priority": 100,
      "description": "Enable for debugging - logs all events"
    },
    {
      "id": "echo-workflow-fallback",
      "name": "Echo Workflow (Static Fallback)",
      "url": "http://n8n:5678/webhook/whatsapp/webhook",
      "events": ["message"],
      "filters": {
        "fromMe": false,
        "isGroup": false
      },
      "enabled": true,
      "priority": 50,
      "description": "Fallback echo workflow if dynamic registration fails"
    }
  ],
  "settings": {
    "forwardTimeout": 10000,
    "maxConcurrentForwards": 10,
    "logLevel": "info"
  }
}
```

#### 4. WhatsApp Bot Trigger Node Changes

**File:** `packages/whatsapp-n8n-nodes/nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node.ts`

**Add webhookMethods:**

```typescript
webhookMethods = {
  default: {
    async checkExists(this: IHookFunctions): Promise<boolean> {
      const credentials = await this.getCredentials('whatsAppBotApi');
      const serviceUrl = credentials.serviceUrl as string;

      if (!serviceUrl) return true; // No service URL = skip registration

      const webhookUrl = this.getNodeWebhookUrl('default');
      const sessionId = credentials.sessionId as string || 'default';

      try {
        const response = await axios.get(
          `${serviceUrl}/webhook/routes`,
          { headers: { 'x-api-key': credentials.apiKey as string } }
        );

        return response.data.routes.some(
          (r: any) => r.url === webhookUrl && r.source === 'dynamic'
        );
      } catch {
        return false;
      }
    },

    async create(this: IHookFunctions): Promise<boolean> {
      const credentials = await this.getCredentials('whatsAppBotApi');
      const serviceUrl = credentials.serviceUrl as string;

      if (!serviceUrl) {
        console.log('[WhatsAppBotTrigger] No serviceUrl, skipping registration');
        return true;
      }

      const webhookUrl = this.getNodeWebhookUrl('default');
      const eventTypes = this.getNodeParameter('eventTypes', ['message']) as string[];
      const ignoreFromMe = this.getNodeParameter('ignoreFromMe', true) as boolean;
      const allowGroupMessages = this.getNodeParameter('allowGroupMessages', false) as boolean;
      const filterSessionId = this.getNodeParameter('filterSessionId', '') as string;

      const workflowId = this.getWorkflow().id;
      const nodeId = this.getNode().id;

      try {
        await axios.post(
          `${serviceUrl}/webhook/register`,
          {
            webhookUrl,
            events: eventTypes,
            filters: {
              fromMe: ignoreFromMe ? false : undefined,
              isGroup: allowGroupMessages ? undefined : false,
              sessionId: filterSessionId || undefined,
            },
            name: `WhatsApp Trigger - Workflow ${workflowId}`,
            metadata: { workflowId, nodeId },
          },
          { headers: { 'x-api-key': credentials.apiKey as string } }
        );

        console.log(`[WhatsAppBotTrigger] Registered: ${webhookUrl}`);
        return true;
      } catch (error) {
        console.error('[WhatsAppBotTrigger] Registration failed:', error);
        return true; // Don't fail activation
      }
    },

    async delete(this: IHookFunctions): Promise<boolean> {
      const credentials = await this.getCredentials('whatsAppBotApi');
      const serviceUrl = credentials.serviceUrl as string;

      if (!serviceUrl) return true;

      const webhookUrl = this.getNodeWebhookUrl('default');

      try {
        await axios.post(
          `${serviceUrl}/webhook/unregister`,
          { webhookUrl },
          { headers: { 'x-api-key': credentials.apiKey as string } }
        );

        console.log(`[WhatsAppBotTrigger] Unregistered: ${webhookUrl}`);
        return true;
      } catch (error) {
        console.error('[WhatsAppBotTrigger] Unregistration failed:', error);
        return true;
      }
    },
  },
};
```

#### 5. Credentials Update

**File:** `packages/whatsapp-n8n-nodes/credentials/WhatsAppBotApi.credentials.ts`

**Add serviceUrl field:**

```typescript
{
  displayName: 'Service URL (for Trigger Registration)',
  name: 'serviceUrl',
  type: 'string',
  default: '',
  placeholder: 'http://whatsapp-service:3001',
  description: 'URL of whatsapp-service for automatic webhook registration. Leave empty to use direct webhook configuration.',
  hint: 'Required for multi-workflow support. The trigger will auto-register when workflows activate.',
},
```

### Server Deployment

#### Directory Structure

```
/var/www/wa.dater.world/
├── whatsapp-api/                    # wwebjs-api (existing)
│   ├── docker-compose.yml
│   ├── .env
│   │   └── BASE_WEBHOOK_URL=http://whatsapp-service:3001/webhook/inbound
│   └── sessions/
│
├── whatsapp-service/                # Webhook router
│   ├── docker-compose.yml
│   ├── .env
│   ├── Dockerfile
│   ├── package.json
│   ├── dist/
│   │   ├── index.js
│   │   └── router/
│   │       └── webhookRouter.js
│   ├── config/
│   │   └── routes.json
│   └── data/
│       └── registrations.json       # Dynamic registrations
│
└── custom-nodes/                    # n8n custom nodes (existing)
    └── n8n-nodes-whatsapp-bot/
```

#### Docker Compose (whatsapp-service)

```yaml
name: whatsapp-service

services:
  service:
    build: .
    container_name: whatsapp-service
    restart: always
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - API_KEY=${API_KEY}
      - WHATSAPP_API_URL=http://wwebjs-api:3000
      - ROUTES_CONFIG=/app/config/routes.json
      - REGISTRATIONS_PATH=/app/data/registrations.json
      # nginx-proxy
      - VIRTUAL_HOST=wa.dater.world
      - VIRTUAL_PATH=/ws
      - VIRTUAL_PORT=3001
      - LETSENCRYPT_HOST=wa.dater.world
    volumes:
      - ./config:/app/config:ro
      - ./data:/app/data
    networks:
      - n8n_default
      - proxy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  n8n_default:
    external: true
  proxy:
    external: true
```

### Data Flow Sequence

```
1. WhatsApp message received
   │
2. wwebjs-api processes message
   │
3. wwebjs-api POSTs to BASE_WEBHOOK_URL
   │ POST http://whatsapp-service:3001/webhook/inbound
   │ Body: { dataType: "message", sessionId: "mysession", data: { message: {...} } }
   │
4. whatsapp-service WebhookRouter receives event
   │
5. Router extracts routing fields:
   │ - dataType: "message"
   │ - fromMe: false
   │ - isGroup: false (from ends with @c.us)
   │ - sessionId: "mysession"
   │
6. Router loads routes:
   │ - Static routes from config/routes.json
   │ - Dynamic routes from stateManager
   │
7. Router filters routes:
   │ - Route A: events=["message"], fromMe=false → MATCH
   │ - Route B: events=["message_ack"] → NO MATCH (event type)
   │ - Route C: events=["*"], enabled=false → NO MATCH (disabled)
   │
8. Router fans out to matching routes:
   │ Promise.allSettled([
   │   axios.post(routeA.url, event),
   │   // ... other matches
   │ ])
   │
9. Each n8n workflow receives event at its webhook URL
   │
10. WhatsAppBotTrigger.webhook() applies fine-grained filters
    │ - filterToNumber, filterFromNumber (specific numbers)
    │ - Returns {} if no match, workflowData if match
    │
11. Workflow executes (or not, based on filter result)
```

### Migration Strategy

#### Step 1: Deploy whatsapp-service (No disruption)

```bash
# Deploy whatsapp-service
scp -r packages/whatsapp-service/deploy-package/* \
  root@no.flow:/var/www/wa.dater.world/whatsapp-service/

ssh root@no.flow "cd /var/www/wa.dater.world/whatsapp-service && \
  docker compose up -d && \
  docker network connect n8n_default whatsapp-service"
```

#### Step 2: Add static route for echo workflow

Edit `config/routes.json`:
```json
{
  "routes": [{
    "id": "echo-workflow",
    "name": "Echo Workflow",
    "url": "http://n8n:5678/webhook/whatsapp/webhook",
    "events": ["message"],
    "filters": { "fromMe": false, "isGroup": false },
    "enabled": true
  }]
}
```

#### Step 3: Switch wwebjs-api to use whatsapp-service

```bash
ssh root@no.flow "cd /var/www/wa.dater.world/whatsapp-api && \
  sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://whatsapp-service:3001/webhook/inbound|' .env && \
  docker compose down && docker compose up -d && \
  docker network connect n8n_default wwebjs-api"
```

#### Step 4: Verify echo workflow still works

Send WhatsApp message → Echo reply received

#### Step 5: Deploy updated n8n nodes with webhookMethods

```bash
cd packages/whatsapp-n8n-nodes
npm run build && npm run deploy
```

#### Step 6: Update credentials with serviceUrl

In n8n UI: Settings → Credentials → WhatsApp Bot API
- Add `serviceUrl`: `http://whatsapp-service:3001`

#### Step 7: Activate WhatsApp Bot Trigger workflow

- Workflow activates
- Trigger auto-registers with whatsapp-service
- Both echo AND custom trigger now receive events

---

## Testing Strategy

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| WebhookRouter | Route matching, filtering, priority ordering |
| Registration API | Register, unregister, list, validation |
| webhookMethods | create/delete lifecycle, error handling |

### Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Single workflow | Send message | Workflow executes |
| Multiple workflows | Send message | Both workflows execute |
| Filter: fromMe | Bot sends message | Only fromMe=true routes fire |
| Filter: isGroup | Send to group | Only isGroup=true routes fire |
| Deactivate workflow | Deactivate in n8n | Route unregistered |
| Service restart | Restart whatsapp-service | Dynamic routes restored |

### End-to-End Validation

1. **Baseline:** Echo workflow works
2. **Add trigger workflow:** Both receive events
3. **Deactivate trigger:** Only echo receives
4. **Reactivate trigger:** Both receive again
5. **Static override:** Disable via JSON → Route stops
6. **Re-enable:** Enable via JSON → Route resumes

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| whatsapp-service down | All webhooks fail | Health checks, auto-restart, static fallback routes |
| n8n registration fails | Workflow doesn't receive events | Graceful failure, log errors, manual registration API |
| Race condition on activate | Duplicate registrations | Idempotent registration (upsert by URL) |
| Config file corruption | Routes lost | JSON schema validation, backup on write |
| Network partition | Events lost | Retry logic, dead letter logging |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Webhook forwarding latency | < 100ms p95 |
| Registration success rate | > 99% |
| Event delivery rate | > 99.9% |
| Config hot-reload time | < 1s |
| Zero-downtime deployments | Yes |

---

## Files to Create/Modify

### New Files
- `packages/whatsapp-service/src/router/webhookRouter.ts`
- `packages/whatsapp-service/src/types/routes.ts`
- `packages/whatsapp-service/config/routes.json`
- `packages/whatsapp-service/config/routes.schema.json`

### Modified Files
- `packages/whatsapp-service/src/index.ts` - Add router initialization and endpoints
- `packages/whatsapp-n8n-nodes/nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node.ts` - Add webhookMethods
- `packages/whatsapp-n8n-nodes/credentials/WhatsAppBotApi.credentials.ts` - Add serviceUrl field

### Server Files
- `/var/www/wa.dater.world/whatsapp-api/.env` - Update BASE_WEBHOOK_URL

---

## Related Documentation

- [06-webhook-routing-option-a-n8n-router.md](06-webhook-routing-option-a-n8n-router.md) - Phase 1 implementation details
- [07-webhook-routing-option-b-whatsapp-service.md](07-webhook-routing-option-b-whatsapp-service.md) - Service router details
- [08-webhook-routing-option-c-auto-registration.md](08-webhook-routing-option-c-auto-registration.md) - n8n webhookMethods pattern
