/**
 * Test App Factory
 *
 * Creates an Express app for testing with mocked dependencies.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Types for mock dependencies
export interface MockDispatcher {
  dispatch: jest.Mock;
}

export interface MockWebhook {
  url: string;
  events: string[];
  registeredAt: Date;
}

export interface MockStateManager {
  init: jest.Mock;
  close: jest.Mock;
  registerWebhook: jest.Mock;
  unregisterWebhook: jest.Mock;
  getWebhooks: jest.Mock<Promise<MockWebhook[]>, [string]>;
}

export interface MockCachedMediaEntry {
  id: string;
  url: string;
  mimetype: string;
  filename?: string;
  size: number;
  expiresAt: Date;
  localPath: string;
  cachedAt: Date;
}

export interface MockMediaCacheService {
  init: jest.Mock;
  close: jest.Mock;
  fetchAndCache: jest.Mock<Promise<MockCachedMediaEntry>, [string, string?, string?]>;
  get: jest.Mock<MockCachedMediaEntry | null, [string]>;
  getFilePath: jest.Mock<string | null, [string]>;
  cleanup: jest.Mock<Promise<number>>;
  getStats: jest.Mock;
  clear: jest.Mock<Promise<void>>;
}

export interface TestAppConfig {
  apiKey?: string;
  dispatcher?: MockDispatcher;
  stateManager?: MockStateManager;
  mediaCacheService?: MockMediaCacheService;
}

/**
 * Creates an Express app for testing with mock dependencies
 */
export function createTestApp(config: TestAppConfig = {}) {
  const API_KEY = config.apiKey || 'test-api-key';

  // Default mock dispatcher
  const dispatcher = config.dispatcher || {
    dispatch: jest.fn().mockResolvedValue({ success: true, data: {} }),
  };

  // Default mock state manager
  const stateManager = config.stateManager || {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    registerWebhook: jest.fn().mockResolvedValue(undefined),
    unregisterWebhook: jest.fn().mockResolvedValue(undefined),
    getWebhooks: jest.fn().mockResolvedValue([]),
  };

  // Default mock media cache service
  const mediaCacheService = config.mediaCacheService || {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    fetchAndCache: jest.fn().mockResolvedValue({
      id: 'test-cache-id',
      url: 'https://example.com/image.jpg',
      mimetype: 'image/jpeg',
      filename: 'image.jpg',
      size: 1024,
      expiresAt: new Date(Date.now() + 300000),
      localPath: '/tmp/test-cache/test-cache-id.jpg',
      cachedAt: new Date(),
    }),
    get: jest.fn().mockReturnValue(null),
    getFilePath: jest.fn().mockReturnValue(null),
    cleanup: jest.fn().mockResolvedValue(0),
    getStats: jest.fn().mockReturnValue({
      totalEntries: 0,
      totalSize: 0,
      expiredEntries: 0,
    }),
    clear: jest.fn().mockResolvedValue(undefined),
  };

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Key authentication middleware
  const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!providedKey || providedKey !== API_KEY) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or missing API key',
      });
    }

    next();
  };

  // Apply auth to routes (skip health/ping and media cache serving)
  app.use((req, res, next) => {
    if (
      req.path === '/health' ||
      req.path === '/ping' ||
      req.path.startsWith('/media/cache/')
    ) {
      return next();
    }
    authenticateApiKey(req, res, next);
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'whatsapp-service',
      mode: 'thin-wrapper',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ping', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'pong',
    });
  });

  // Webhook endpoint for n8n actions (single session)
  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      const { action, data } = req.body;
      const sessionId = req.body.sessionId || 'default';

      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required',
        });
      }

      const result = await dispatcher.dispatch(sessionId, { action, data });
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // Webhook endpoint for n8n actions (multi-session)
  app.post('/session/:sessionId/webhook', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { action, data } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required',
        });
      }

      const result = await dispatcher.dispatch(sessionId, { action, data });
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // Register webhook
  app.post('/webhook/register/:sessionId?', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId || 'default';
      const { webhookUrl, events } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'webhookUrl is required',
        });
      }

      const eventList = events || ['message', 'qr', 'status_change', 'group_join', 'group_leave'];
      await stateManager.registerWebhook(sessionId, webhookUrl, eventList);

      res.json({
        success: true,
        message: 'Webhook registered successfully',
        registration: {
          sessionId,
          webhookUrl,
          events: eventList,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // Unregister webhook
  app.post('/webhook/unregister/:sessionId?', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId || 'default';
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'webhookUrl is required',
        });
      }

      await stateManager.unregisterWebhook(sessionId, webhookUrl);

      res.json({
        success: true,
        message: 'Webhook unregistered successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // List webhooks
  app.get('/webhook/list/:sessionId?', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId || 'default';
      const webhooks = await stateManager.getWebhooks(sessionId);

      res.json({
        success: true,
        sessionId,
        webhooks: webhooks.map(w => ({
          url: w.url,
          events: w.events,
          registeredAt: w.registeredAt,
        })),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // ==========================================================================
  // Media Proxy Routes
  // ==========================================================================

  /**
   * Proxy external media URL for use with whatsapp-api
   * POST /media/proxy
   */
  app.post('/media/proxy', async (req: Request, res: Response) => {
    try {
      const { url, filename, mimetype } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'url is required',
        });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format',
        });
      }

      const entry = await mediaCacheService.fetchAndCache(url, filename, mimetype);

      // Construct the proxy URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const proxyUrl = `${baseUrl}/media/cache/${entry.id}`;

      res.json({
        success: true,
        proxyUrl,
        expiresAt: entry.expiresAt,
        cacheId: entry.id,
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
   * Serve cached media file
   * GET /media/cache/:id
   */
  app.get('/media/cache/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const entry = mediaCacheService.get(id);

      if (!entry) {
        return res.status(404).json({
          success: false,
          error: 'Media not found or expired',
        });
      }

      // For testing, return JSON instead of streaming file
      res.json({
        success: true,
        entry: {
          id: entry.id,
          mimetype: entry.mimetype,
          filename: entry.filename,
          size: entry.size,
        },
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
   * Get media cache statistics
   * GET /media/stats
   */
  app.get('/media/stats', async (req: Request, res: Response) => {
    try {
      const stats = mediaCacheService.getStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  return { app, dispatcher, stateManager, mediaCacheService };
}
