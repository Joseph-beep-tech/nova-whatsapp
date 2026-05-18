# Spec: n8n Workflow Migration to whatsapp-service

## Overview

Migrate n8n workflow functionality into whatsapp-service, enabling the service to be the primary event handler instead of n8n. This eliminates the n8n dependency for core WhatsApp routing.

---

## Current State

### n8n Workflows to Migrate

| Workflow ID | Name | Function | Migration Target |
|-------------|------|----------|------------------|
| `L94Ziar3GQZLUU1V` | WhatsApp Router (Multi-Target Fanout) | SOMO detection, user registration, routing | Built-in routing logic |
| `whatsapp-debug` | WhatsApp Echo Reply | Keyword echo for health check | Admin keyword handler |
| `CBppy9-zrrQ51xjxBgQTy` | WhatsApp Send API | Send messages via wwebjs-api | Already exists (dispatcher) |

### Current Event Flow
```
wwebjs-api → n8n (Router) → whatsapp-service (user registration)
                         → n8n (Echo Reply)
                         → n8n (Bot workflows)
```

### Target Event Flow
```
wwebjs-api → whatsapp-service (all routing)
                ├── Built-in: SOMO detection + user registration
                ├── Built-in: Echo/health keywords
                ├── Built-in: Qdrant RAG
                └── Optional: Forward to n8n (for complex workflows)
```

---

## Phase 1: Refactor index.ts

### Current Problems
- **1,422 lines** with 30+ endpoints mixed together
- 8+ concerns in single file (auth, routing, media, users, tags, queue, health)
- Hard to test individual components
- Complex event processing logic (lines 473-566)

### Proposed Structure

```
src/
├── index.ts                    # ~100 lines: app setup, router mounting
├── app.ts                      # Express app configuration
├── server.ts                   # Server startup/shutdown
│
├── routes/
│   ├── index.ts               # Route aggregator
│   ├── health.ts              # /health, /ping, /health/ready, /health/sessions
│   ├── admin.ts               # /admin/*
│   ├── webhook.ts             # /webhook, /webhook/register, etc.
│   ├── events.ts              # /events/:sessionId (main event pipeline)
│   ├── media.ts               # /media/proxy, /media/cache/:id
│   ├── users.ts               # /users/* endpoints
│   ├── welcome.ts             # /welcome-messages/*
│   ├── tags.ts                # /tags/* endpoints
│   └── queue.ts               # /queue/stats, /queue/failed
│
├── middleware/
│   ├── auth.ts                # API key authentication
│   ├── errorHandler.ts        # Error handling middleware
│   └── notFound.ts            # 404 handler
│
├── handlers/
│   ├── messageRouter.ts       # Core routing logic (from n8n Router)
│   ├── keywordHandler.ts      # Keyword-based responses (echo, help)
│   └── tagHandler.ts          # Tag detection and registration
│
├── services/                   # Already exists
│   ├── eventQueue.ts          ✓
│   ├── eventRouter.ts         ✓
│   ├── qdrantHandler.ts       ✓
│   └── welcomeService.ts      ✓
│
└── utils/
    ├── stateManager.ts        ✓
    ├── eventExtractor.ts      # Extract chatId, message content
    └── messageBuilder.ts      # Build response messages
```

### Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `src/routes/health.ts` | ~80 | Health check endpoints |
| `src/routes/events.ts` | ~150 | Event processing pipeline |
| `src/routes/users.ts` | ~120 | User management |
| `src/routes/tags.ts` | ~100 | Tag configuration |
| `src/routes/webhook.ts` | ~100 | Webhook registration |
| `src/routes/media.ts` | ~80 | Media proxy |
| `src/routes/welcome.ts` | ~60 | Welcome messages |
| `src/routes/admin.ts` | ~30 | Admin UI |
| `src/routes/queue.ts` | ~50 | Queue status |
| `src/middleware/auth.ts` | ~40 | Auth middleware |
| `src/handlers/messageRouter.ts` | ~200 | Core routing (from n8n) |
| `src/handlers/keywordHandler.ts` | ~100 | Keyword responses |

---

## Phase 2: Implement n8n Router Logic

### n8n Router Workflow Analysis

The router workflow (`L94Ziar3GQZLUU1V`) does:

1. **Layer 1: Feedback Loop Prevention**
   ```javascript
   if (dataType === 'message_create' && fromMe) {
     return []; // Stop - our own message
   }
   ```

2. **Layer 2: Deduplication**
   ```javascript
   // 60-second cooldown on message key
   const messageKey = chatId + ':' + content.slice(0, 50);
   if (recentMessages[messageKey] && now - recentMessages[messageKey] < 60000) {
     return []; // Duplicate
   }
   ```

3. **Routing Decisions**
   ```javascript
   const isIncomingMessage = dataType === 'message_create' && !fromMe;
   const containsSOMO = messageContent.toUpperCase().includes('SOMO');
   ```

4. **Actions**
   - If incoming → Send echo reply
   - If contains SOMO → Register user with SOMO tag + forward to bot

### Implementation: `src/handlers/messageRouter.ts`

```typescript
import { RoutableEvent } from '../types/routing';
import { stateManager } from '../utils/stateManager';

interface RoutingDecision {
  shouldProcess: boolean;
  skipReason?: string;
  detectedTags: string[];
  keywords: string[];
  isGroup: boolean;
}

interface MessageRouterConfig {
  deduplicationWindowMs: number;
  tagPatterns: Map<string, RegExp>;  // e.g., 'SOMO' -> /\bSOMO\b/i
  keywordPatterns: Map<string, RegExp>;  // e.g., 'echo' -> /^\/echo\b/i
}

class MessageRouterService {
  private recentMessages: Map<string, number> = new Map();
  private config: MessageRouterConfig;

  constructor(config?: Partial<MessageRouterConfig>) {
    this.config = {
      deduplicationWindowMs: 60000,
      tagPatterns: new Map([
        ['SOMO', /\bSOMO\b/i],
        ['HELLO_TRACTOR', /\bHELLO[_\s]?TRACTOR\b/i],
      ]),
      keywordPatterns: new Map([
        ['echo', /^echo\s+/i],
        ['help', /^(help|\/help)\s*$/i],
        ['ping', /^(ping|\/ping)\s*$/i],
      ]),
      ...config,
    };
  }

  /**
   * Main routing decision
   */
  async route(event: RoutableEvent): Promise<RoutingDecision> {
    const { data, chatId, dataType } = event;
    const message = this.extractMessage(data);

    // Layer 1: Feedback loop prevention
    if (dataType === 'message_create' && message.fromMe) {
      return { shouldProcess: false, skipReason: 'own_message', detectedTags: [], keywords: [], isGroup: false };
    }

    // Layer 2: Deduplication
    const messageKey = `${chatId}:${message.body.slice(0, 50)}`;
    const now = Date.now();
    const lastSeen = this.recentMessages.get(messageKey);

    if (lastSeen && now - lastSeen < this.config.deduplicationWindowMs) {
      return { shouldProcess: false, skipReason: 'duplicate', detectedTags: [], keywords: [], isGroup: false };
    }
    this.recentMessages.set(messageKey, now);
    this.cleanOldEntries(now);

    // Detect tags
    const detectedTags = this.detectTags(message.body);

    // Detect keywords
    const keywords = this.detectKeywords(message.body);

    return {
      shouldProcess: true,
      detectedTags,
      keywords,
      isGroup: chatId.endsWith('@g.us'),
    };
  }

  private detectTags(content: string): string[] {
    const detected: string[] = [];
    for (const [tag, pattern] of this.config.tagPatterns) {
      if (pattern.test(content)) {
        detected.push(tag);
      }
    }
    return detected;
  }

  private detectKeywords(content: string): string[] {
    const detected: string[] = [];
    for (const [keyword, pattern] of this.config.keywordPatterns) {
      if (pattern.test(content)) {
        detected.push(keyword);
      }
    }
    return detected;
  }

  private extractMessage(data: Record<string, unknown>): { body: string; fromMe: boolean } {
    const message = (data.message || data.msg || data) as Record<string, unknown>;
    return {
      body: String(message.body || ''),
      fromMe: Boolean(message.fromMe),
    };
  }

  private cleanOldEntries(now: number): void {
    const maxAge = this.config.deduplicationWindowMs * 2;
    for (const [key, time] of this.recentMessages) {
      if (now - time > maxAge) {
        this.recentMessages.delete(key);
      }
    }
  }
}

export const messageRouter = new MessageRouterService();
```

---

## Phase 3: Keyword Handler (Echo/Health)

### n8n Echo Reply Analysis

The echo workflow (`whatsapp-debug`) sends back the received message prefixed with "Echo: ".

### Implementation: `src/handlers/keywordHandler.ts`

```typescript
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';

interface KeywordResponse {
  handled: boolean;
  response?: string;
}

interface KeywordConfig {
  keyword: string;
  pattern: RegExp;
  handler: (match: RegExpMatchArray, context: KeywordContext) => Promise<KeywordResponse>;
  adminOnly?: boolean;
  description: string;
}

interface KeywordContext {
  chatId: string;
  sessionId: string;
  messageBody: string;
  userTags: string[];
}

class KeywordHandlerService {
  private apiClient: WhatsAppApiClient | null = null;
  private keywords: KeywordConfig[] = [];

  constructor() {
    this.registerBuiltinKeywords();
  }

  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
  }

  private registerBuiltinKeywords(): void {
    // Echo - health check
    this.keywords.push({
      keyword: 'echo',
      pattern: /^echo\s+(.+)$/i,
      description: 'Echo back the message (health check)',
      handler: async (match, ctx) => ({
        handled: true,
        response: `Echo: ${match[1]}`,
      }),
    });

    // Ping
    this.keywords.push({
      keyword: 'ping',
      pattern: /^(ping|\/ping)\s*$/i,
      description: 'Ping-pong health check',
      handler: async () => ({
        handled: true,
        response: 'pong 🏓',
      }),
    });

    // Help
    this.keywords.push({
      keyword: 'help',
      pattern: /^(help|\/help)\s*$/i,
      description: 'Show available commands',
      handler: async (_, ctx) => ({
        handled: true,
        response: this.generateHelpText(ctx.userTags),
      }),
    });

    // Status (admin)
    this.keywords.push({
      keyword: 'status',
      pattern: /^\/status\s*$/i,
      description: 'Show service status',
      adminOnly: true,
      handler: async () => ({
        handled: true,
        response: `✅ Service online\n📊 Queue: enabled\n🔍 Qdrant: enabled`,
      }),
    });
  }

  async handle(context: KeywordContext): Promise<KeywordResponse> {
    for (const config of this.keywords) {
      const match = context.messageBody.match(config.pattern);
      if (match) {
        // Check admin-only
        if (config.adminOnly && !context.userTags.includes('ADMIN')) {
          continue;
        }

        const result = await config.handler(match, context);

        if (result.handled && result.response && this.apiClient) {
          await this.apiClient.sendMessage(context.sessionId, {
            chatId: context.chatId,
            contentType: 'string',
            content: result.response,
          });
        }

        return result;
      }
    }

    return { handled: false };
  }

  private generateHelpText(userTags: string[]): string {
    const available = this.keywords.filter(k =>
      !k.adminOnly || userTags.includes('ADMIN')
    );

    return `Available commands:\n${available.map(k =>
      `• ${k.keyword} - ${k.description}`
    ).join('\n')}`;
  }
}

export const keywordHandler = new KeywordHandlerService();
```

---

## Phase 4: Updated Event Pipeline

### `src/routes/events.ts`

```typescript
import { Router } from 'express';
import { messageRouter } from '../handlers/messageRouter';
import { keywordHandler } from '../handlers/keywordHandler';
import { eventQueue } from '../services/eventQueue';
import { eventRouter } from '../services/eventRouter';
import { stateManager } from '../utils/stateManager';

const router = Router();

router.post('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { dataType, data } = req.body;
  const receivedAt = new Date().toISOString();

  try {
    // Extract chatId
    const chatId = extractChatId(data);

    // Lookup user and tags
    const user = chatId ? await stateManager.getUser(chatId) : null;
    const tags = user?.tags || [];

    // Build routable event
    const event = { sessionId, dataType, data, chatId: chatId || 'unknown', tags, receivedAt };

    // Step 1: Message routing decision
    const decision = await messageRouter.route(event);

    if (!decision.shouldProcess) {
      return res.json({ success: true, skipped: true, reason: decision.skipReason });
    }

    // Step 2: Auto-register detected tags
    if (chatId && decision.detectedTags.length > 0) {
      for (const tag of decision.detectedTags) {
        if (!tags.includes(tag)) {
          await stateManager.addUserTags(chatId, [tag]);
          tags.push(tag);
        }
      }
    }

    // Step 3: Handle keywords (echo, help, ping)
    if (decision.keywords.length > 0) {
      const keywordResult = await keywordHandler.handle({
        chatId: chatId || '',
        sessionId,
        messageBody: extractMessageBody(data),
        userTags: tags,
      });

      if (keywordResult.handled) {
        return res.json({ success: true, handled: 'keyword', keyword: decision.keywords[0] });
      }
    }

    // Step 4: Queue or sync routing
    if (eventQueue.isEnabled()) {
      const jobId = await eventQueue.enqueue({ ...event, tags });
      return res.json({ success: true, mode: 'async', jobId });
    } else {
      const result = await eventRouter.routeEventSync(sessionId, dataType, data);
      return res.json({ success: true, mode: 'sync', result });
    }

  } catch (error) {
    console.error('[Events] Processing error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
```

---

## Phase 5: Test Cases

### Test Structure

```
__tests__/
├── unit/
│   ├── handlers/
│   │   ├── messageRouter.test.ts
│   │   └── keywordHandler.test.ts
│   ├── routes/
│   │   ├── events.test.ts
│   │   └── users.test.ts
│   └── services/
│       └── eventRouter.test.ts
│
└── integration/
    ├── event-pipeline.test.ts      # Full event flow
    ├── somo-registration.test.ts   # SOMO tag detection
    └── keyword-responses.test.ts   # Echo, ping, help
```

### Test Cases from n8n Workflow

#### `messageRouter.test.ts`

```typescript
describe('MessageRouter', () => {
  describe('Feedback Loop Prevention', () => {
    it('should skip messages where fromMe is true', async () => {
      const event = createEvent({ dataType: 'message_create', fromMe: true });
      const result = await messageRouter.route(event);
      expect(result.shouldProcess).toBe(false);
      expect(result.skipReason).toBe('own_message');
    });

    it('should process messages where fromMe is false', async () => {
      const event = createEvent({ dataType: 'message_create', fromMe: false });
      const result = await messageRouter.route(event);
      expect(result.shouldProcess).toBe(true);
    });
  });

  describe('Deduplication', () => {
    it('should skip duplicate messages within 60 seconds', async () => {
      const event = createEvent({ body: 'Hello world' });

      const first = await messageRouter.route(event);
      expect(first.shouldProcess).toBe(true);

      const second = await messageRouter.route(event);
      expect(second.shouldProcess).toBe(false);
      expect(second.skipReason).toBe('duplicate');
    });

    it('should process same message after cooldown', async () => {
      const event = createEvent({ body: 'Hello world' });

      await messageRouter.route(event);

      // Fast-forward 61 seconds
      jest.advanceTimersByTime(61000);

      const result = await messageRouter.route(event);
      expect(result.shouldProcess).toBe(true);
    });
  });

  describe('Tag Detection', () => {
    it('should detect SOMO in message', async () => {
      const event = createEvent({ body: 'I want to join SOMO please' });
      const result = await messageRouter.route(event);
      expect(result.detectedTags).toContain('SOMO');
    });

    it('should detect SOMO case-insensitively', async () => {
      const event = createEvent({ body: 'somo registration' });
      const result = await messageRouter.route(event);
      expect(result.detectedTags).toContain('SOMO');
    });

    it('should detect multiple tags', async () => {
      const event = createEvent({ body: 'SOMO and HELLO_TRACTOR' });
      const result = await messageRouter.route(event);
      expect(result.detectedTags).toContain('SOMO');
      expect(result.detectedTags).toContain('HELLO_TRACTOR');
    });
  });

  describe('Keyword Detection', () => {
    it('should detect echo keyword', async () => {
      const event = createEvent({ body: 'echo hello' });
      const result = await messageRouter.route(event);
      expect(result.keywords).toContain('echo');
    });

    it('should detect ping keyword', async () => {
      const event = createEvent({ body: 'ping' });
      const result = await messageRouter.route(event);
      expect(result.keywords).toContain('ping');
    });
  });

  describe('Group Detection', () => {
    it('should identify group messages', async () => {
      const event = createEvent({ chatId: '123456789@g.us' });
      const result = await messageRouter.route(event);
      expect(result.isGroup).toBe(true);
    });

    it('should identify DM messages', async () => {
      const event = createEvent({ chatId: '123456789@c.us' });
      const result = await messageRouter.route(event);
      expect(result.isGroup).toBe(false);
    });
  });
});
```

#### `keywordHandler.test.ts`

```typescript
describe('KeywordHandler', () => {
  describe('Echo Command', () => {
    it('should echo back the message', async () => {
      const result = await keywordHandler.handle({
        chatId: '123@c.us',
        sessionId: 'test',
        messageBody: 'echo hello world',
        userTags: [],
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Echo: hello world');
    });
  });

  describe('Ping Command', () => {
    it('should respond with pong', async () => {
      const result = await keywordHandler.handle({
        chatId: '123@c.us',
        sessionId: 'test',
        messageBody: 'ping',
        userTags: [],
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe('pong 🏓');
    });
  });

  describe('Admin Commands', () => {
    it('should reject status command for non-admin', async () => {
      const result = await keywordHandler.handle({
        chatId: '123@c.us',
        sessionId: 'test',
        messageBody: '/status',
        userTags: ['USER'],
      });

      expect(result.handled).toBe(false);
    });

    it('should allow status command for admin', async () => {
      const result = await keywordHandler.handle({
        chatId: '123@c.us',
        sessionId: 'test',
        messageBody: '/status',
        userTags: ['ADMIN'],
      });

      expect(result.handled).toBe(true);
    });
  });
});
```

#### `event-pipeline.test.ts` (Integration)

```typescript
describe('Event Pipeline Integration', () => {
  describe('SOMO Registration Flow', () => {
    it('should auto-register user with SOMO tag when message contains SOMO', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'I want to register for SOMO',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);

      // Verify user was registered with SOMO tag
      const user = await stateManager.getUser('254722833440@c.us');
      expect(user?.tags).toContain('SOMO');
    });
  });

  describe('Echo Health Check', () => {
    it('should echo back messages starting with echo', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'echo test message',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.handled).toBe('keyword');
    });
  });

  describe('Feedback Loop Prevention', () => {
    it('should not process bot outgoing messages', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Echo: test',
            fromMe: true,  // Bot's own message
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.skipped).toBe(true);
      expect(response.body.reason).toBe('own_message');
    });
  });
});
```

---

## Phase 6: Webhook Migration

### Update wwebjs-api Configuration

After testing is complete, update wwebjs-api to send events to whatsapp-service:

```bash
# Current
BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router

# New
BASE_WEBHOOK_URL=http://whatsapp-service:3001/service/events
```

### Migration Steps

1. **Parallel Running** (1 week)
   - Keep n8n router active
   - Add forwarding from whatsapp-service to n8n for unhandled events

2. **Cutover**
   - Update BASE_WEBHOOK_URL
   - Monitor for 24 hours

3. **Cleanup**
   - Disable n8n router workflow
   - Remove forwarding logic

---

## Implementation Order

| Phase | Task | Priority | Dependencies |
|-------|------|----------|--------------|
| 1.1 | Create `src/routes/` structure | High | None |
| 1.2 | Extract health routes | High | 1.1 |
| 1.3 | Extract events route | High | 1.1 |
| 1.4 | Extract remaining routes | Medium | 1.1 |
| 2.1 | Implement messageRouter | High | 1.3 |
| 2.2 | Implement keywordHandler | High | 1.3 |
| 3.1 | Write unit tests for handlers | High | 2.1, 2.2 |
| 3.2 | Write integration tests | High | 3.1 |
| 4.1 | Update wwebjs-api config | Medium | 3.2 passes |
| 4.2 | Monitor and validate | High | 4.1 |

---

## Success Criteria

- [ ] index.ts reduced from 1,422 to ~100 lines
- [ ] All existing tests pass
- [ ] New handler tests pass (20+ test cases)
- [ ] SOMO detection works without n8n
- [ ] Echo/ping keywords work without n8n
- [ ] Feedback loop prevention verified
- [ ] Deduplication verified
- [ ] wwebjs-api switched to whatsapp-service
- [ ] n8n router workflow disabled

---

## Rollback Plan

If issues occur after webhook switch:

```bash
# Revert wwebjs-api
docker exec wwebjs-api env BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router
docker restart wwebjs-api

# Re-enable n8n router
# Via n8n UI: Activate workflow L94Ziar3GQZLUU1V
```
