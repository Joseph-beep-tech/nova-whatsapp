/**
 * WhatsApp n8n Service - Thin Wrapper for n8n Integration
 *
 * This service acts as a bridge between n8n nodes and whatsapp-api.
 * It translates n8n webhook actions into whatsapp-api REST endpoint calls.
 *
 * Architecture:
 * - Shares Docker network and data volumes with whatsapp-api
 * - Does NOT manage WhatsApp sessions directly
 * - Proxies all operations to whatsapp-api
 * - Provides webhook registration for n8n triggers
 */

// Import config first - it loads dotenv before other modules access env vars
import { queueConfig, qdrantConfig, authConfig, llmConfig, corsConfig, socketConfig } from './shared/config';

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WhatsAppApiClient } from './dispatcher/whatsappApiClient';
import { WebhookDispatcher } from './dispatcher/webhookDispatcher';
import { stateManager } from './utils/stateManager';
import { mediaCacheService } from './services/mediaCache';
import { WelcomeService } from './services/welcomeService';
import { eventQueue } from './services/eventQueue';
import { eventRouter } from './services/eventRouter';
import { eventHub } from './services/eventHub';
import { qdrantHandler } from './services/qdrantHandler';
import { keywordHandler } from './handlers/keywordHandler';
import { llmService } from './services/llmService';
import { createServiceRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createSessionMiddleware, closeSessionRedis } from './middleware/sessionMiddleware';
import { initializeOidcClient } from './services/auth';
import { RoutableEvent } from './types/routing';
import { getErrorMessage } from './types/webhook';
import { setupSwagger } from './swagger';
import { RegisterRoutes } from './generated/routes';
import { initHealthController } from './controllers/HealthController';
import { initUsersController } from './controllers/UsersController';
import { initWelcomeController } from './controllers/WelcomeController';
import { initWebhookController } from './controllers/WebhookController';
import erpnextWebhookRouter from './routes/erpnextWebhooks';
import spaoWebhookRouter from './routes/spaoWebhooks';
import { spaoEventHandler } from './services/spaoEventHandler';
import { spaoVoiceHandler } from './handlers/spaoVoiceHandler';
import usageRouter from './routes/usage';

// Configuration
const PORT = process.env.PORT || 3001;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3000';
const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

// Initialize services
const apiClient = new WhatsAppApiClient({
  baseUrl: WHATSAPP_API_URL,
  apiKey: API_KEY,
  timeout: 30000,
});

const dispatcher = new WebhookDispatcher(apiClient);
const welcomeService = new WelcomeService(apiClient);

// Initialize tsoa controllers with dependencies
initHealthController(WHATSAPP_API_URL, API_KEY);
initUsersController(welcomeService);
initWelcomeController(welcomeService);
initWebhookController(dispatcher);

/**
 * Legacy webhook forwarder for backwards compatibility
 * Used when no tag-based routing is configured
 */
async function forwardToLegacyWebhooks(event: RoutableEvent): Promise<void> {
  const webhooks = await stateManager.getWebhooks(event.sessionId);
  const targetWebhooks = webhooks.filter(w => w.events.includes(event.dataType));

  const axios = require('axios');
  const promises = targetWebhooks.map(webhook =>
    axios.post(webhook.url, {
      dataType: event.dataType,
      data: event.data,
      sessionId: event.sessionId,
    }).catch((error: unknown) => {
      console.error(`Failed to forward event to ${webhook.url}:`, getErrorMessage(error));
    })
  );

  await Promise.allSettled(promises);
}

// Initialize Express app
const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsConfig.origins,
  credentials: corsConfig.credentials,
}));

// Mount ERPNext webhook receiver BEFORE express.json() —
// captureRawBody needs the raw request stream for HMAC signature validation.
app.use('/service/webhooks/erpnext', erpnextWebhookRouter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount SPAO webhook receiver (uses API key auth, after express.json() is fine)
app.use('/service/webhooks/spao', spaoWebhookRouter);

// Mount usage tracking API
app.use('/service/usage', usageRouter);

// Rate limiting (skip for API docs)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path.startsWith('/api-docs'),
});
app.use(limiter);

// Set up Swagger UI (before auth middleware - Swagger doesn't need async setup)
setupSwagger(app);

// Register tsoa routes (controllers)
RegisterRoutes(app);

// Session middleware, service router, and error handlers are initialized
// in startServer() after async Keycloak setup is complete

/**
 * Start server
 */
async function startServer() {
  // Initialize state manager
  await stateManager.init();
  console.log('✅ State manager initialized');

  // Load dynamic keyword patterns (Group Keyword Filtering)
  try {
    const keywordConfig = await stateManager.getConfig('tag_patterns_config') as { patterns?: { tag: string; pattern: string; flags?: string }[] };
    if (keywordConfig?.patterns && Array.isArray(keywordConfig.patterns)) {
      const { messageRouter } = await import('./handlers/messageRouter');

      // Clear defaults first if we have saved patterns
      for (const [tag] of messageRouter.getConfig().tagPatterns) {
        messageRouter.removeTagPattern(tag);
      }
      // Apply saved patterns
      for (const p of keywordConfig.patterns) {
        if (!p.tag || !p.pattern) continue;
        messageRouter.addTagPattern(p.tag, new RegExp(p.pattern, p.flags || 'i'));
      }
      console.log(`✅ Loaded ${keywordConfig.patterns.length} dynamic keyword patterns`);
    }
  } catch (error) {
    console.error('Failed to load keyword patterns:', error);
  }

  // Initialize media cache service
  await mediaCacheService.init();
  console.log('✅ Media cache service initialized');

  // Initialize Keycloak OIDC client (if enabled)
  let sessionMw: Awaited<ReturnType<typeof createSessionMiddleware>> | undefined;
  if (authConfig.enabled) {
    await initializeOidcClient();

    // Add session middleware (requires Redis)
    sessionMw = await createSessionMiddleware();
    app.use(sessionMw);
    console.log('✅ Session middleware initialized');
  } else {
    console.log('ℹ️  Keycloak auth disabled (set ENABLE_KEYCLOAK_AUTH=true to enable)');
  }

  // Initialize Socket.io real-time engine (after session middleware)
  // Pass session middleware so Socket.io can validate Keycloak session cookies
  if (socketConfig.enabled) {
    eventHub.init(httpServer, sessionMw);
    eventRouter.setEventHub(eventHub);
  } else {
    console.log('ℹ️  Socket.io disabled (set ENABLE_SOCKET=true to enable)');
  }

  // Create and mount service router (after session middleware)
  const serviceRouter = createServiceRouter({
    whatsappApiUrl: WHATSAPP_API_URL,
    apiKey: API_KEY,
    webhookDispatcher: dispatcher,
    welcomeService,
  });
  app.use('/service', serviceRouter);

  // Error handlers (must be after routes)
  app.use(errorHandler);
  app.use(notFoundHandler);

  // Initialize event queue (if enabled)
  if (queueConfig.enabled) {
    await eventQueue.initialize();
    console.log('✅ Event queue initialized');

    // Set up event handler for queue worker
    eventQueue.setEventHandler(async (queuedEvent) => {
      return await eventRouter.processEvent(queuedEvent);
    });

    // Start worker
    eventQueue.startWorker();
    console.log('✅ Event queue worker started');
  } else {
    console.log('ℹ️  Event queue disabled (set ENABLE_EVENT_QUEUE=true to enable)');
  }

  // Initialize Qdrant handler (if enabled)
  if (qdrantConfig.enabled) {
    await qdrantHandler.initialize();
    qdrantHandler.setApiClient(apiClient);
    console.log('✅ Qdrant handler initialized');

    // Wire up Qdrant handler to event router (tagConfig passed for SPAO content retrieval)
    eventRouter.setQdrantHandler(async (event, config, tagConfig) => {
      return await qdrantHandler.handleEvent(event, config, tagConfig);
    });
  } else {
    console.log('ℹ️  Qdrant RAG disabled (set ENABLE_QDRANT=true to enable)');
  }

  // Initialize keyword handler with API client
  keywordHandler.setApiClient(apiClient);
  console.log('✅ Keyword handler initialized');

  // Initialize SPAO event handler with API client
  spaoEventHandler.setApiClient(apiClient);
  console.log('✅ SPAO event handler initialized');

  // Register SPAO voice handler as a local handler
  spaoVoiceHandler.setApiClient(apiClient);
  eventRouter.registerLocalHandler('spao_voice_handler', async (event, handlerConfig) => {
    return await spaoVoiceHandler.handle(event, handlerConfig);
  });
  console.log('✅ SPAO voice handler registered');

  // Initialize LLM service (if enabled)
  if (llmConfig.enabled) {
    llmService.initialize();
    if (llmService.isEnabled()) {
      keywordHandler.setLlmService(llmService);
      eventRouter.setLlmService(llmService);
      eventRouter.setApiClient(apiClient);
      spaoVoiceHandler.setLlmService(llmService);
      spaoEventHandler.setLlmService(llmService);
      console.log('✅ LLM service initialized and wired');
    }
  } else {
    console.log('ℹ️  LLM features disabled (set ENABLE_LLM=true to enable)');
  }

  // Set up legacy webhook forwarder for backwards compatibility
  eventRouter.setLegacyWebhookForwarder(forwardToLegacyWebhooks);

  // Connect welcomeService to eventRouter for auto-tag welcome messages
  eventRouter.setWelcomeService(welcomeService);
  console.log('✅ Welcome service connected to event router');

  // Initialize ERPNext sync (batch timer + campaign refresh)
  const { erpnextSync } = await import('./services/erpnextSync');
  const { erpnextConfig: erpCfg } = await import('./shared/config');
  if (erpCfg.enabled) {
    erpnextSync.startBatchTimer();
    // Periodic campaign cache refresh (default 5 min)
    setInterval(() => {
      void erpnextSync.fetchCampaigns().then((campaigns) => {
        if (campaigns.length > 0) {
          console.log(`[ERPNext] Refreshed ${campaigns.length} campaigns`);
          // TODO: Apply campaign data to eventRouter tag configs
        }
      });
    }, erpCfg.refreshIntervalMs);
    console.log('✅ ERPNext sync enabled');
  } else {
    console.log('ℹ️  ERPNext sync disabled (set ENABLE_ERPNEXT_SYNC=true to enable)');
  }

  httpServer.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  WhatsApp n8n Service (Thin Wrapper)                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 WhatsApp API: ${WHATSAPP_API_URL}`);
    console.log(`🔐 API Key: ${API_KEY.substring(0, 8)}...`);
    console.log();
    console.log('Available endpoints (all under /service prefix):');
    console.log('  Health & Status:');
    console.log('    GET  /service/health           - Service health check');
    console.log('    GET  /service/ping             - Ping-pong test');
    console.log('    GET  /service/health/ready     - Readiness check');
    console.log('    GET  /service/health/sessions  - Session status');
    console.log();
    console.log('  Webhooks:');
    console.log('    POST /service/webhook          - n8n webhook (default session)');
    console.log('    POST /service/session/:id/webhook - n8n webhook (multi-session)');
    console.log('    POST /service/webhook/register/:id  - Register n8n trigger');
    console.log('    POST /service/webhook/unregister/:id - Unregister trigger');
    console.log('    GET  /service/webhook/list/:id - List webhooks');
    console.log();
    console.log('  Events:');
    console.log('    POST /service/events/:sessionId - Event receiver');
    console.log();
    console.log('  Users:');
    console.log('    POST /service/users/register   - Register/update user');
    console.log('    GET  /service/users/list       - List users');
    console.log('    GET  /service/users/tags       - List all tags');
    console.log('    GET  /service/users?identifier=X - Get user');
    console.log('    POST /service/users/tags       - Add tags (body: identifier, tags)');
    console.log('    DELETE /service/users/tags      - Remove tags (body: identifier, tags)');
    console.log();
    console.log('  Media:');
    console.log('    POST /service/media/proxy      - Proxy external media');
    console.log('    GET  /service/media/cache/:id  - Serve cached media');
    console.log('    GET  /service/media/stats      - Cache statistics');
    console.log();
    console.log('  Tags & Routing:');
    console.log('    GET  /service/tags/configs     - List tag configurations');
    console.log('    GET  /service/tags/:tag/config - Get tag config');
    console.log('    POST /service/tags/:tag/config - Set tag config');
    console.log('    DELETE /service/tags/:tag/config - Delete tag config');
    console.log();
    console.log('  Progress (Learning/LMS):');
    console.log('    GET  /service/progress/modules    - Module structure for tag');
    console.log('    GET  /service/progress/learners   - List learners for tag');
    console.log('    GET  /service/progress?identifier=X&tag=Y - Get learner progress');
    console.log('    POST /service/progress?identifier=X      - Update learner progress');
    console.log();
    console.log('  Welcome Messages:');
    console.log('    GET  /service/welcome-messages       - List all');
    console.log('    POST /service/welcome-messages/:tag  - Set message');
    console.log('    DELETE /service/welcome-messages/:tag - Remove message');
    console.log();
    console.log('  API Documentation:');
    console.log('    GET  /api-docs                 - Documentation index');
    console.log('    GET  /api-docs/service         - Interactive API docs (Swagger UI)');
    console.log();
    console.log('  Metrics:');
    console.log('    GET  /service/metrics/deduplication - Deduplication statistics');
    console.log();
    if (queueConfig.enabled) {
      console.log('  Queue:');
      console.log('    GET  /service/queue/stats      - Queue statistics');
      console.log('    GET  /service/queue/failed     - Failed jobs');
      console.log();
    }
    if (authConfig.enabled) {
      console.log('  Authentication (Keycloak OIDC):');
      console.log('    GET  /service/auth/login       - Initiate login');
      console.log('    GET  /service/auth/callback    - OIDC callback');
      console.log('    POST /service/auth/logout      - Logout');
      console.log('    GET  /service/auth/me          - Current user info');
      console.log();
    }
    if (socketConfig.enabled) {
      console.log('  Real-time (Socket.io):');
      console.log(`    WS   ${socketConfig.path}      - WebSocket endpoint`);
      console.log();
    }
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  // Shutdown Socket.io first (before other services)
  if (socketConfig.enabled) {
    await eventHub.shutdown();
    console.log('✅ Socket.io shutdown');
  }

  // Shutdown event queue
  if (queueConfig.enabled) {
    await eventQueue.shutdown();
    console.log('✅ Event queue shutdown');
  }

  // Shutdown Qdrant handler
  if (qdrantConfig.enabled) {
    await qdrantHandler.shutdown();
    console.log('✅ Qdrant handler shutdown');
  }

  // Shutdown session Redis (if Keycloak auth enabled)
  if (authConfig.enabled) {
    await closeSessionRedis();
    console.log('✅ Session Redis shutdown');
  }

  await mediaCacheService.close();
  await stateManager.close();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
