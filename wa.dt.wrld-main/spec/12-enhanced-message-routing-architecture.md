# Enhanced Message Routing Architecture

## Summary

Replace the synchronous webhook forwarding in `whatsapp-service` with a tag-based smart router that supports:
1. Event queueing via Redis/BullMQ
2. Tag-based routing to different targets (n8n, Qdrant RAG, local handlers)
3. Conversation memory via Qdrant integration
4. Backwards compatibility with existing n8n webhooks

## Current State

**Event flow** (lines 427-463 in `packages/whatsapp-service/src/index.ts`):
```
wwebjs-api → POST /events/:sessionId → sync forward to all matching webhooks → n8n
```

**Problems**: No queueing, no smart routing, all events go to all webhooks.

## Proposed Architecture

```
wwebjs-api → /events/:sessionId → BullMQ Queue → Smart Router → Routing Target
                                                      ↓
                                              (based on user tags)
                                                      ↓
                               ┌─────────────────────────────────────┐
                               │  n8n Workflow  │  Qdrant RAG  │  Local Handler  │
                               └─────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Event Queue Layer

**New dependencies** in `package.json`:
- `bullmq` - Job queue
- `ioredis` - Redis client

**New files**:
- `src/shared/config.ts` - Add `queueConfig`
- `src/services/eventQueue.ts` - BullMQ queue service

**Modify**:
- `src/index.ts:427-463` - Enqueue instead of sync forward

**Config**: `ENABLE_EVENT_QUEUE=true|false` (default false for backwards compat)

### Phase 2: Routing Types & Configuration

**New files**:
- `src/types/routing.ts` - Routing configuration types

```typescript
type RoutingTargetType = 'n8n_webhook' | 'qdrant_rag' | 'local_handler' | 'passthrough';

interface TagConfiguration {
  tag: string;
  enabled: boolean;
  welcomeMessage?: { messages: WelcomeMessageItem[]; enabled: boolean };
  routing?: {
    target: RoutingTarget;
    fallback?: RoutingTarget;
    eventTypes?: string[];
  };
  memory?: {
    enabled: boolean;
    sessionTimeoutMinutes?: number;
    persistToQdrant?: boolean;
  };
}
```

**New endpoints**:
- `GET/POST /tags/:tag/config` - Tag configuration CRUD
- `GET /tags/configs` - List all configurations

### Phase 3: Event Router Service

**New files**:
- `src/services/eventRouter.ts` - Core routing logic

**Routing algorithm**:
1. Extract `chatId` from event data
2. Lookup user tags from MongoDB
3. Get tag configurations for those tags
4. Filter by event type, sort by priority
5. Route to matching target(s)
6. If no tag routing matches → legacy webhook forwarding

### Phase 4: Qdrant Integration

**New dependencies**:
- `@qdrant/js-client-rest` - Qdrant client
- `openai` - OpenAI-compatible client (for OpenRouter)
- `uuid` - Message IDs

**New files**:
- `src/types/memory.ts` - Conversation memory types
- `src/services/qdrantHandler.ts` - RAG handler

**Capabilities**:
- Store messages with embeddings in tag-specific collections
- Retrieve semantically similar context
- Manage conversation sessions with timeouts
- Generate or forward to LLM for responses

**Embedding model**: `sentence-transformers/all-MiniLM-L6-v2` via OpenRouter

**Config**:
```bash
ENABLE_QDRANT=true|false
QDRANT_URL=http://qdrant:6333
OPENROUTER_API_KEY=your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_MODEL=sentence-transformers/all-minilm-l6-v2
LLM_MODEL=your-preferred-model  # for response generation
```

### Phase 5: Docker Infrastructure

**Modify** `docker-compose.yml` (dev) and `deploy/whatsapp-service/docker-compose.yml` (prod):
- Add Redis service
- Add Qdrant service (optional)

---

## Configuration Example: SOMO Tag

```json
{
  "tag": "SOMO",
  "enabled": true,
  "welcomeMessage": {
    "messages": [{ "contentType": "string", "content": "Welcome to SOMO!" }],
    "enabled": true
  },
  "routing": {
    "target": {
      "type": "qdrant_rag",
      "collectionName": "somo_conversations",
      "contextWindow": 10,
      "systemPrompt": "You are the SOMO assistant..."
    },
    "fallback": {
      "type": "n8n_webhook",
      "webhookUrl": "http://n8n:5678/webhook/somo-fallback"
    },
    "eventTypes": ["message_create"]
  },
  "memory": {
    "enabled": true,
    "sessionTimeoutMinutes": 30,
    "persistToQdrant": true
  }
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add bullmq, ioredis, qdrant, openai |
| `src/shared/config.ts` | Modify | Add queue + qdrant config |
| `src/types/routing.ts` | Create | Routing type definitions |
| `src/types/memory.ts` | Create | Conversation memory types |
| `src/services/eventQueue.ts` | Create | BullMQ queue service |
| `src/services/eventRouter.ts` | Create | Tag-based routing logic |
| `src/services/qdrantHandler.ts` | Create | Qdrant RAG handler |
| `src/index.ts` | Modify | Wire up queue, router, new endpoints |
| `docker-compose.yml` | Modify | Add redis, qdrant services |

---

## Backwards Compatibility

- `ENABLE_EVENT_QUEUE=false` (default) → sync mode (current behavior)
- `ENABLE_QDRANT=false` (default) → no Qdrant features
- No tag config → legacy webhook forwarding
- Existing welcome message system unchanged

---

## Verification

1. **Queue**: Send message → check Redis queue → verify processed
2. **Routing**: Configure SOMO tag → send message → verify routed to correct target
3. **Qdrant**: Send multiple messages → verify context retrieved in subsequent messages
4. **Fallback**: Disable primary target → verify fallback triggers
5. **Backwards compat**: Disable queue → verify sync forwarding works
