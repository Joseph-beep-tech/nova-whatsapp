# Option B: whatsapp-service Webhook Router

Multi-target webhook routing using the existing `packages/whatsapp-service` package.

## Overview

Enhance the existing whatsapp-service to act as a webhook router, receiving events from wwebjs-api and fanning out to multiple n8n workflow webhooks based on configurable rules.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Server: wa.dater.world                               │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │  nginx-proxy    │         │  nginx-proxy    │                           │
│  │  VIRTUAL_PATH=/ │         │ VIRTUAL_PATH=/ws│                           │
│  └────────┬────────┘         └────────┬────────┘                           │
│           │                           │                                     │
│           ▼                           ▼                                     │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │  whatsapp-api   │────────▶│whatsapp-service │──────┬──────┬──────┐     │
│  │  (wwebjs-api)   │ webhook │  (router)       │      │      │      │     │
│  │  :3000          │         │  :3001          │      ▼      ▼      ▼     │
│  └─────────────────┘         └─────────────────┘   n8n    n8n    n8n      │
│                                                   wf #1  wf #2  wf #3      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture

The whatsapp-service already has event forwarding infrastructure. This enhancement adds:

1. **JSON-based routing configuration** - Define targets in `config/routes.json`
2. **Event filtering** - Route based on `dataType`, `fromMe`, `isGroup`
3. **Parallel fanout** - Forward to multiple targets simultaneously
4. **Hot reload** - Update routes without restarting

### Current vs Enhanced Flow

**Current (whatsapp-service/src/index.ts:292-328):**
```
wwebjs-api → POST /events/:sessionId → stateManager.getWebhooks() → forward to registered URLs
```

**Enhanced:**
```
wwebjs-api → POST /webhook/inbound → routes.json config → filter & forward to multiple n8n URLs
```

## Implementation Steps

### Step 1: Create Routes Configuration

Create `packages/whatsapp-service/config/routes.json`:

```json
{
  "targets": [
    {
      "name": "Echo Bot Workflow",
      "url": "http://n8n:5678/webhook/whatsapp/webhook",
      "events": ["message"],
      "filters": {
        "fromMe": false,
        "isGroup": false
      },
      "headers": {
        "x-api-key": "${WHATSAPP_API_KEY}"
      },
      "enabled": true
    },
    {
      "name": "WhatsApp Bot Trigger",
      "url": "http://n8n:5678/webhook/${TRIGGER_WORKFLOW_UUID}/webhook",
      "events": ["message", "message_create"],
      "filters": {
        "fromMe": false
      },
      "headers": {},
      "enabled": true
    },
    {
      "name": "Session Status Handler",
      "url": "http://n8n:5678/webhook/session-status/webhook",
      "events": ["ready", "disconnected", "authenticated"],
      "filters": {},
      "enabled": true
    },
    {
      "name": "Message Ack Tracker",
      "url": "http://n8n:5678/webhook/message-ack/webhook",
      "events": ["message_ack"],
      "filters": {},
      "enabled": false
    },
    {
      "name": "All Events Logger (Debug)",
      "url": "http://n8n:5678/webhook/debug-logger/webhook",
      "events": ["*"],
      "filters": {},
      "enabled": false
    }
  ]
}
```

### Step 2: Create Route Types

Create `packages/whatsapp-service/src/types/routes.ts`:

```typescript
/**
 * Webhook routing configuration types
 */

export interface RouteFilter {
  /** Filter by fromMe field (true = bot sent, false = received) */
  fromMe?: boolean;
  /** Filter by group messages (true = groups only, false = DMs only) */
  isGroup?: boolean;
  /** Filter by session ID */
  sessionId?: string;
}

export interface RouteTarget {
  /** Human-readable name for logging */
  name: string;
  /** Target webhook URL (supports ${ENV_VAR} substitution) */
  url: string;
  /** Event types to forward: ['message', 'message_ack'] or ['*'] for all */
  events: string[];
  /** Optional filters to apply before forwarding */
  filters?: RouteFilter;
  /** Optional headers to include in forwarded request */
  headers?: Record<string, string>;
  /** Enable/disable this target */
  enabled: boolean;
}

export interface RoutesConfig {
  targets: RouteTarget[];
}

export interface ForwardResult {
  target: string;
  status?: number;
  error?: string;
  elapsed?: number;
}
```

### Step 3: Create Webhook Router Module

Create `packages/whatsapp-service/src/router/webhookRouter.ts`:

```typescript
/**
 * Webhook Router
 *
 * Receives events from wwebjs-api and fans out to multiple n8n workflow webhooks
 * based on configurable routing rules.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { RoutesConfig, RouteTarget, RouteFilter, ForwardResult } from '../types/routes';

export class WebhookRouter {
  private config: RoutesConfig;
  private configPath: string;
  private configWatcher: fs.FSWatcher | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.ROUTES_CONFIG || './config/routes.json';
    this.config = { targets: [] };
  }

  /**
   * Initialize router and load configuration
   */
  async init(): Promise<void> {
    await this.loadConfig();
    this.watchConfig();
    console.log(`[WebhookRouter] Initialized with ${this.getEnabledTargetCount()} enabled targets`);
  }

  /**
   * Load routing configuration from JSON file
   */
  private async loadConfig(): Promise<void> {
    try {
      const resolvedPath = path.resolve(this.configPath);

      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[WebhookRouter] Config file not found: ${resolvedPath}, using empty config`);
        this.config = { targets: [] };
        return;
      }

      const configContent = fs.readFileSync(resolvedPath, 'utf-8');
      const rawConfig = JSON.parse(configContent) as RoutesConfig;

      // Substitute environment variables in URLs and headers
      this.config = this.substituteEnvVars(rawConfig);

      console.log(`[WebhookRouter] Loaded ${this.config.targets.length} routing targets`);
    } catch (error) {
      console.error('[WebhookRouter] Failed to load config:', error);
      throw error;
    }
  }

  /**
   * Substitute ${ENV_VAR} patterns with actual environment variable values
   */
  private substituteEnvVars(config: RoutesConfig): RoutesConfig {
    const substitute = (str: string): string => {
      return str.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return process.env[varName] || '';
      });
    };

    return {
      targets: config.targets.map(target => ({
        ...target,
        url: substitute(target.url),
        headers: target.headers
          ? Object.fromEntries(
              Object.entries(target.headers).map(([k, v]) => [k, substitute(v)])
            )
          : undefined,
      })),
    };
  }

  /**
   * Watch config file for changes (hot reload)
   */
  private watchConfig(): void {
    try {
      const resolvedPath = path.resolve(this.configPath);

      if (!fs.existsSync(resolvedPath)) return;

      this.configWatcher = fs.watch(resolvedPath, async (eventType) => {
        if (eventType === 'change') {
          console.log('[WebhookRouter] Config file changed, reloading...');
          await this.loadConfig();
        }
      });
    } catch (error) {
      console.warn('[WebhookRouter] Could not watch config file:', error);
    }
  }

  /**
   * Route an incoming webhook event to matching targets
   */
  async route(payload: Record<string, unknown>): Promise<{
    received: string;
    matched: number;
    forwarded: number;
    elapsed: number;
    results: ForwardResult[];
  }> {
    const startTime = Date.now();

    // Extract routing fields from payload
    const dataType = (payload.dataType || payload.body?.dataType) as string;
    const data = (payload.data || payload.body?.data || {}) as Record<string, unknown>;
    const message = (data.message || {}) as Record<string, unknown>;
    const sessionId = (payload.sessionId || payload.body?.sessionId) as string;
    const fromMe = (message.fromMe ?? false) as boolean;
    const from = (message.from || '') as string;
    const isGroup = from.endsWith('@g.us');

    console.log(
      `[WebhookRouter] Received: dataType=${dataType} from=${from} fromMe=${fromMe} isGroup=${isGroup} sessionId=${sessionId}`
    );

    // Find matching targets
    const matchingTargets = this.config.targets.filter(target => {
      if (!target.enabled) return false;

      // Check event type
      if (!target.events.includes('*') && !target.events.includes(dataType)) {
        return false;
      }

      // Check filters
      if (target.filters) {
        if (target.filters.fromMe !== undefined && target.filters.fromMe !== fromMe) {
          return false;
        }
        if (target.filters.isGroup !== undefined && target.filters.isGroup !== isGroup) {
          return false;
        }
        if (target.filters.sessionId !== undefined && target.filters.sessionId !== sessionId) {
          return false;
        }
      }

      return true;
    });

    console.log(
      `[WebhookRouter] Matched ${matchingTargets.length} targets: ${matchingTargets.map(t => t.name).join(', ') || '(none)'}`
    );

    // Forward to all matching targets in parallel
    const results = await Promise.allSettled(
      matchingTargets.map(target => this.forwardToTarget(target, payload))
    );

    // Process results
    const forwardResults: ForwardResult[] = results.map((result, index) => {
      const target = matchingTargets[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          target: target.name,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const elapsed = Date.now() - startTime;
    const successCount = forwardResults.filter(r => !r.error).length;

    console.log(
      `[WebhookRouter] Completed: ${successCount}/${matchingTargets.length} successful in ${elapsed}ms`
    );

    return {
      received: dataType,
      matched: matchingTargets.length,
      forwarded: successCount,
      elapsed,
      results: forwardResults,
    };
  }

  /**
   * Forward payload to a single target
   */
  private async forwardToTarget(
    target: RouteTarget,
    payload: Record<string, unknown>
  ): Promise<ForwardResult> {
    const startTime = Date.now();

    try {
      const response = await axios.post(target.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...target.headers,
        },
        timeout: 10000,
        validateStatus: () => true, // Don't throw on non-2xx
      });

      const elapsed = Date.now() - startTime;

      if (response.status >= 400) {
        console.warn(
          `[WebhookRouter] Target "${target.name}" returned ${response.status}: ${JSON.stringify(response.data)}`
        );
      }

      return {
        target: target.name,
        status: response.status,
        elapsed,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WebhookRouter] Failed to forward to "${target.name}": ${message}`);
      return {
        target: target.name,
        error: message,
        elapsed: Date.now() - startTime,
      };
    }
  }

  /**
   * Manually reload configuration
   */
  async reloadConfig(): Promise<{ targets: number }> {
    await this.loadConfig();
    return { targets: this.config.targets.length };
  }

  /**
   * Get current routing configuration (for debugging)
   */
  getConfig(): RoutesConfig {
    return this.config;
  }

  /**
   * Get count of enabled targets
   */
  getEnabledTargetCount(): number {
    return this.config.targets.filter(t => t.enabled).length;
  }

  /**
   * Cleanup resources
   */
  close(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
  }
}
```

### Step 4: Integrate Router into Express App

Update `packages/whatsapp-service/src/index.ts` to add the router endpoints:

```typescript
// Add to imports
import { WebhookRouter } from './router/webhookRouter';

// After initializing dispatcher (~line 46)
const webhookRouter = new WebhookRouter();

// In startServer() function, after stateManager.init()
await webhookRouter.init();
console.log('✅ Webhook router initialized');

// Add new endpoints before error handler

/**
 * Inbound webhook receiver from wwebjs-api
 * This is the main entry point for all WhatsApp events
 * POST /webhook/inbound
 */
app.post('/webhook/inbound', async (req: Request, res: Response) => {
  try {
    const result = await webhookRouter.route(req.body);
    res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/webhook/inbound] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * Reload routing configuration
 * POST /webhook/routes/reload
 */
app.post('/webhook/routes/reload', async (req: Request, res: Response) => {
  try {
    const result = await webhookRouter.reloadConfig();
    res.json({
      success: true,
      message: 'Configuration reloaded',
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * Get current routing configuration
 * GET /webhook/routes
 */
app.get('/webhook/routes', (req: Request, res: Response) => {
  const config = webhookRouter.getConfig();
  res.json({
    success: true,
    targets: config.targets.map(t => ({
      name: t.name,
      url: t.url.replace(/^(https?:\/\/[^/]+).*/, '$1/...'), // Mask full URL
      events: t.events,
      filters: t.filters,
      enabled: t.enabled,
    })),
  });
});

// Update health endpoint to include router status
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-service',
    mode: 'thin-wrapper',
    router: {
      enabled: true,
      targets: webhookRouter.getEnabledTargetCount(),
    },
    timestamp: new Date().toISOString(),
  });
});

// In graceful shutdown handlers
await webhookRouter.close();
```

### Step 5: Update Package Exports

Add to `packages/whatsapp-service/src/types/index.ts`:

```typescript
export * from './routes';
```

### Step 6: Create Docker Configuration

Create `packages/whatsapp-service/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/
COPY config/ ./config/

# Create config directory if it doesn't exist
RUN mkdir -p ./config

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Create `packages/whatsapp-service/docker-compose.yml`:

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
      - API_KEY=${API_KEY}
      - WHATSAPP_API_URL=http://wwebjs-api:3000
      - ROUTES_CONFIG=/app/config/routes.json
      # Environment variables for route substitution
      - WHATSAPP_API_KEY=${API_KEY}
      - TRIGGER_WORKFLOW_UUID=${TRIGGER_WORKFLOW_UUID:-}
      # nginx-proxy settings
      - VIRTUAL_HOST=wa.dater.world
      - VIRTUAL_PATH=/ws
      - VIRTUAL_PORT=3001
      - LETSENCRYPT_HOST=wa.dater.world
    volumes:
      - ./config:/app/config:ro
    networks:
      - proxy
      - n8n_default

networks:
  proxy:
    external: true
  n8n_default:
    external: true
```

Create `packages/whatsapp-service/.env.example`:

```bash
# Required
API_KEY=your-api-key-here

# Optional - for route URL substitution
WHATSAPP_API_KEY=${API_KEY}
TRIGGER_WORKFLOW_UUID=df4ce89f-fe74-4d2b-8146-2c47b69f0262
```

### Step 7: Server Folder Structure

After deployment, server structure will be:

```
/var/www/wa.dater.world/
├── whatsapp-api/              # Existing wwebjs-api
│   ├── docker-compose.yml
│   ├── .env
│   │   └── BASE_WEBHOOK_URL=http://whatsapp-service:3001/webhook/inbound
│   └── ...
│
├── whatsapp-service/          # Webhook router service
│   ├── docker-compose.yml
│   ├── .env
│   ├── Dockerfile
│   ├── package.json
│   ├── dist/
│   │   ├── index.js
│   │   ├── router/
│   │   │   └── webhookRouter.js
│   │   └── types/
│   │       └── routes.js
│   └── config/
│       └── routes.json        # Routing configuration
│
└── docker-compose.override.yml  # Optional: shared network config
```

### Step 8: Build and Deploy

```bash
# On local machine
cd packages/whatsapp-service

# Build TypeScript
npm run build

# Create deployment package
mkdir -p deploy-package/config
cp -r dist deploy-package/
cp package*.json deploy-package/
cp Dockerfile deploy-package/
cp docker-compose.yml deploy-package/
cp .env.example deploy-package/.env
cp config/routes.json deploy-package/config/

# Upload to server
scp -r deploy-package/* root@no.flow:/var/www/wa.dater.world/whatsapp-service/
```

### Step 9: Configure and Start on Server

```bash
ssh root@no.flow

cd /var/www/wa.dater.world/whatsapp-service

# Edit .env with actual values
nano .env

# Edit routes.json with actual workflow UUIDs
nano config/routes.json

# Build and start
docker compose build
docker compose up -d

# Verify
docker logs whatsapp-service
curl http://localhost:3001/health
```

### Step 10: Update wwebjs-api to Point to Router

```bash
cd /var/www/wa.dater.world/whatsapp-api

# Update BASE_WEBHOOK_URL
sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://whatsapp-service:3001/webhook/inbound|' .env

# Recreate container (restart doesn't reload .env)
docker compose down && docker compose up -d

# Connect both containers to shared network
docker network connect n8n_default wwebjs-api
docker network connect n8n_default whatsapp-service
```

### Step 11: Verify End-to-End

```bash
# Watch whatsapp-service logs
docker logs -f whatsapp-service

# Send a WhatsApp message to bot number
# Expected log output:
# [WebhookRouter] Received: dataType=message from=254722833440@c.us fromMe=false isGroup=false
# [WebhookRouter] Matched 2 targets: Echo Bot Workflow, WhatsApp Bot Trigger
# [WebhookRouter] Completed: 2/2 successful in 45ms
```

## nginx-proxy VIRTUAL_PATH Configuration

The docker-compose.yml includes nginx-proxy environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VIRTUAL_HOST` | `wa.dater.world` | Domain for this service |
| `VIRTUAL_PATH` | `/ws` | URL path prefix |
| `VIRTUAL_PORT` | `3001` | Container port |

This makes the service available externally at:

| External URL | Internal Route |
|--------------|----------------|
| `https://wa.dater.world/` | whatsapp-api:3000 |
| `https://wa.dater.world/ws/health` | whatsapp-service:3001/health |
| `https://wa.dater.world/ws/webhook/routes` | whatsapp-service:3001/webhook/routes |

**Note:** The `/webhook/inbound` endpoint is internal-only (wwebjs-api → whatsapp-service). External access is not needed.

## Adding New Webhook Targets

To add a new n8n workflow as a routing target:

1. **Get the workflow's webhook path** from n8n UI (Webhook node settings)

2. **Edit routes.json:**
   ```bash
   ssh root@no.flow
   nano /var/www/wa.dater.world/whatsapp-service/config/routes.json
   ```

3. **Add new target entry:**
   ```json
   {
     "name": "My New Workflow",
     "url": "http://n8n:5678/webhook/new-workflow-path/webhook",
     "events": ["message"],
     "filters": {
       "fromMe": false
     },
     "enabled": true
   }
   ```

4. **Reload configuration** (no restart needed):
   ```bash
   curl -X POST http://localhost:3001/webhook/routes/reload \
     -H "x-api-key: YOUR_API_KEY"
   ```

   Or wait for automatic hot-reload (file watcher).

## Configuration Reference

### Route Target Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name for logging |
| `url` | string | Yes | Target webhook URL. Supports `${ENV_VAR}` substitution |
| `events` | string[] | Yes | Event types to forward. Use `["*"]` for all events |
| `filters` | object | No | Filtering rules (see below) |
| `headers` | object | No | Headers to include in forwarded request |
| `enabled` | boolean | Yes | Enable/disable this target |

### Filter Fields

| Field | Type | Description |
|-------|------|-------------|
| `fromMe` | boolean | `true` = bot-sent only, `false` = received only |
| `isGroup` | boolean | `true` = groups only, `false` = DMs only |
| `sessionId` | string | Match specific WhatsApp session |

### Event Types

| Event | Description |
|-------|-------------|
| `message` | Incoming/outgoing message (whatsapp-web.js normalized) |
| `message_create` | Message created (wwebjs-api raw) |
| `message_ack` | Delivery/read receipt |
| `ready` | Session connected |
| `disconnected` | Session disconnected |
| `authenticated` | QR code scanned successfully |
| `*` | All events (wildcard) |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhook/inbound` | API Key | Main webhook receiver (from wwebjs-api) |
| GET | `/webhook/routes` | API Key | View current routing config |
| POST | `/webhook/routes/reload` | API Key | Hot-reload configuration |
| GET | `/health` | None | Health check with router status |

## Troubleshooting

### Service not starting
```bash
docker logs whatsapp-service
# Check for config parsing errors or missing env vars
```

### Routes not matching
```bash
# Check current config
curl http://localhost:3001/webhook/routes -H "x-api-key: YOUR_KEY"

# Watch logs for routing decisions
docker logs -f whatsapp-service | grep WebhookRouter
```

### Target webhook failing
```bash
# Test target directly
docker exec whatsapp-service curl -X POST http://n8n:5678/webhook/path/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Hot reload not working
```bash
# Manually reload
curl -X POST http://localhost:3001/webhook/routes/reload -H "x-api-key: YOUR_KEY"

# Check file permissions
ls -la /var/www/wa.dater.world/whatsapp-service/config/
```

## Pros and Cons

| Aspect | Assessment |
|--------|------------|
| **Setup time** | 2-3 hours initial, then fast iterations |
| **Code changes** | New router module in existing package |
| **Maintenance** | Medium - code + JSON config |
| **Flexibility** | High - full programmatic control |
| **Performance** | Fast - parallel Promise.allSettled |
| **Debugging** | Docker logs + structured logging |
| **Scalability** | Good - stateless, can scale horizontally |
| **Hot reload** | Yes - file watcher or API endpoint |

## Comparison with Option A

| Aspect | Option A (n8n Router) | Option B (whatsapp-service) |
|--------|----------------------|----------------------------|
| Configuration | n8n UI workflow | JSON config file |
| Adding targets | Add Execute Workflow node | Edit JSON + hot reload |
| Filtering | IF nodes in workflow | JSON filter rules |
| Parallelism | "Don't wait" mode | Promise.allSettled |
| External access | Via n8n webhook | Via nginx-proxy |
| Code changes | None | Router module |
