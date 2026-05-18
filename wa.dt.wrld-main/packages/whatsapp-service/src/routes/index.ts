/**
 * Routes Index
 *
 * Aggregates all route modules and exports a configured router.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { healthRouter, initHealthRoutes } from './health';
import { eventsRouter } from './events';
import { usersRouter, initUserRoutes } from './users';
import { webhookRouter, initWebhookRoutes } from './webhook';
import { mediaRouter } from './media';
import { welcomeRouter, initWelcomeRoutes } from './welcome';
import { tagsRouter } from './tags';
import { queueRouter } from './queue';
import { adminRouter } from './admin';
import { progressRouter } from './progress';
import { authRouter, initAuthRoutes } from './auth';
import conversationStateRouter from './conversationState';
import { metricsRouter } from './metrics';
import { alertsRouter } from './alerts';
import { memoryRouter } from './memory';
import { chatsRouter } from './chats';
import { campaignsRouter, initCampaignsRoutes } from './campaigns';
import { WebhookDispatcher } from '../dispatcher/webhookDispatcher';
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import { WelcomeService } from '../services/welcomeService';
import { authConfig } from '../shared/config';

/**
 * Route initialization options
 */
export interface RouteInitOptions {
  whatsappApiUrl: string;
  apiKey: string;
  webhookDispatcher: WebhookDispatcher;
  welcomeService: WelcomeService;
}

/**
 * API Key authentication middleware
 */
function createAuthMiddleware(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!providedKey || providedKey !== apiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or missing API key',
      });
    }

    next();
  };
}

/**
 * Create and configure the service router
 */
export function createServiceRouter(options: RouteInitOptions): Router {
  const router = Router();
  const { whatsappApiUrl, apiKey, webhookDispatcher, welcomeService } = options;

  // Initialize route modules
  const apiClient = new WhatsAppApiClient({ baseUrl: whatsappApiUrl, apiKey });
  initCampaignsRoutes(apiClient);
  initHealthRoutes(whatsappApiUrl, apiKey);
  initWebhookRoutes(webhookDispatcher);
  initUserRoutes(welcomeService);
  initWelcomeRoutes(welcomeService);
  initAuthRoutes();

  // Create auth middleware
  const authenticateApiKey = createAuthMiddleware(apiKey);

  // Apply auth selectively (skip public routes)
  router.use((req: Request, res: Response, next: NextFunction) => {
    // Public routes that don't require API key
    if (
      req.path === '/health' ||
      req.path === '/health/ready' ||
      req.path === '/ping' ||
      req.path.startsWith('/admin') || // Admin routes have their own auth (Keycloak or Basic)
      req.path.startsWith('/auth/') || // Auth routes handle their own authentication
      req.path.startsWith('/media/cache/') // Cached media served without auth for whatsapp-api access
    ) {
      return next();
    }
    // /health/sessions handles its own auth (supports query string apiKey)
    if (req.path === '/health/sessions') {
      return next();
    }
    // Session status/qr routes need API key auth (handled by middleware)
    if (req.path.startsWith('/session/')) {
      return authenticateApiKey(req, res, next);
    }
    authenticateApiKey(req, res, next);
  });

  // Mount route modules
  router.use(healthRouter);
  router.use('/events', eventsRouter);
  router.use(usersRouter);
  router.use(webhookRouter);
  router.use(mediaRouter);
  router.use(welcomeRouter);
  router.use(tagsRouter);
  router.use(queueRouter);
  router.use(adminRouter);
  router.use('/progress', progressRouter);
  router.use('/conversation-state', conversationStateRouter);
  router.use('/metrics', metricsRouter);
  router.use(alertsRouter);
  router.use('/memory', memoryRouter);
  router.use('/chats', chatsRouter);
  router.use('/campaigns', campaignsRouter);

  // Always mount auth routes — handles both Keycloak OIDC and admin password fallback
  router.use('/auth', authRouter);

  return router;
}

// Re-export individual routers for testing
export {
  healthRouter,
  eventsRouter,
  usersRouter,
  webhookRouter,
  mediaRouter,
  welcomeRouter,
  tagsRouter,
  queueRouter,
  adminRouter,
  progressRouter,
  authRouter,
  conversationStateRouter,
  metricsRouter,
  alertsRouter,
  memoryRouter,
  chatsRouter,
  campaignsRouter,
};
