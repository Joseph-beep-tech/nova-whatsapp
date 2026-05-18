/**
 * Integration Tests: EventsController (tsoa)
 *
 * Tests the tsoa-generated EventsController entry point for WhatsApp events.
 * Uses supertest against a minimal Express app with tsoa routes.
 *
 * Verifies:
 * - POST /service/events/:sessionId with valid payloads -> 200
 * - API key authentication (missing/invalid -> 403)
 * - Multiple event types: message_create, message_ack, qr, authenticated, ready
 * - Event routing via eventRouter.routeEventSync
 * - Legacy webhook fallback when no tag routing is configured
 * - Default session fallback via POST /service/events
 */

// CRITICAL: Set environment variables BEFORE imports
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.ENABLE_EVENT_QUEUE = 'false';
process.env.ENABLE_ERPNEXT_SYNC = 'false';
process.env.ENABLE_DEDUPLICATION = 'false';

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing anything
// ---------------------------------------------------------------------------

const mockRouteEventSync = jest.fn();
const mockGetUser = jest.fn();
const mockGetWebhooks = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('../../src/services/eventQueue', () => ({
  eventQueue: {
    isEnabled: jest.fn().mockReturnValue(false),
    enqueue: jest.fn(),
    initialize: jest.fn(),
    startWorker: jest.fn(),
    shutdown: jest.fn(),
    setEventHandler: jest.fn(),
  },
}));

jest.mock('../../src/services/eventRouter', () => ({
  eventRouter: {
    routeEventSync: mockRouteEventSync,
    processEvent: jest.fn(),
    setQdrantHandler: jest.fn(),
    setEventHub: jest.fn(),
    setLegacyWebhookForwarder: jest.fn(),
    setWelcomeService: jest.fn(),
    registerLocalHandler: jest.fn(),
    setLlmService: jest.fn(),
    setApiClient: jest.fn(),
  },
}));

jest.mock('../../src/utils/stateManager', () => ({
  stateManager: {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getUser: mockGetUser,
    getWebhooks: mockGetWebhooks,
    getConfig: jest.fn().mockResolvedValue(null),
    registerWebhook: jest.fn(),
    unregisterWebhook: jest.fn(),
  },
}));

jest.mock('axios', () => ({
  post: mockAxiosPost,
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: {} }),
    get: jest.fn().mockResolvedValue({ data: {} }),
  }),
}));

import request from 'supertest';
import express from 'express';
import { RegisterRoutes } from '../../src/generated/routes';

describe('EventsController (tsoa integration)', () => {
  const API_KEY = 'test-api-key';
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Register tsoa routes (includes EventsController at /service/events/*)
    RegisterRoutes(app);

    // Error handler for tsoa validation errors and auth errors
    app.use(
      (
        err: Error & { status?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        const status = err.status || 500;
        res.status(status).json({
          success: false,
          error: err.message,
        });
      },
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: no tag routing configured (empty results)
    mockRouteEventSync.mockResolvedValue({
      success: true,
      results: [],
      totalDurationMs: 0,
    });

    mockGetUser.mockResolvedValue(null);
    mockGetWebhooks.mockResolvedValue([]);
    mockAxiosPost.mockResolvedValue({ data: {} });
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  describe('Authentication', () => {
    it('rejects requests without API key', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .send({
          dataType: 'message_create',
          data: { from: '254722833440@c.us', body: 'Hello' },
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or missing API key');
    });

    it('rejects requests with invalid API key', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', 'wrong-key')
        .send({
          dataType: 'message_create',
          data: { from: '254722833440@c.us', body: 'Hello' },
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or missing API key');
    });

    it('accepts requests with valid x-api-key header', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: { from: '254722833440@c.us', body: 'Hello' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('accepts requests with Bearer token', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          dataType: 'message_create',
          data: { from: '254722833440@c.us', body: 'Hello' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /service/events/:sessionId - message_create
  // ---------------------------------------------------------------------------

  describe('POST /service/events/:sessionId - message_create', () => {
    it('processes a valid message_create event', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Hello bot!',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('calls routeEventSync with correct arguments for message with chatId', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [{ target: { type: 'local_handler' }, success: true, durationMs: 5 }],
        totalDurationMs: 5,
      });

      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Test message',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.mode).toBe('sync_routed');
      expect(response.body.message).toContain('1 target(s)');

      expect(mockRouteEventSync).toHaveBeenCalledWith(
        'mysession',
        'message_create',
        expect.objectContaining({
          from: '254722833440@c.us',
          body: 'Test message',
          fromMe: false,
        }),
      );
    });

    it('uses sessionId from URL param', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [{ target: { type: 'local_handler' }, success: true, durationMs: 3 }],
        totalDurationMs: 3,
      });

      await request(app)
        .post('/service/events/custom-session-id')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Hello',
            fromMe: false,
          },
        });

      expect(mockRouteEventSync).toHaveBeenCalledWith(
        'custom-session-id',
        'message_create',
        expect.any(Object),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Various event types
  // ---------------------------------------------------------------------------

  describe('Event types', () => {
    it('handles qr event', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'qr',
          data: { qr: 'base64-qr-data' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('handles authenticated event (no data payload)', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'authenticated',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('handles ready event', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'ready',
          data: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('handles message_ack event', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_ack',
          data: {
            id: 'msg_12345',
            ack: 2,
            from: '254722833440@c.us',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('handles disconnected event (no data payload)', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'disconnected',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Legacy webhook fallback
  // ---------------------------------------------------------------------------

  describe('Legacy webhook fallback', () => {
    it('falls back to legacy webhooks when no tag routing is configured', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [],
        totalDurationMs: 0,
      });

      mockGetWebhooks.mockResolvedValue([
        {
          url: 'https://example.com/hook',
          events: ['message_create'],
          registeredAt: new Date().toISOString(),
        },
      ]);

      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Test',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.mode).toBe('legacy');
    });

    it('forwards event to matching webhook targets', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [],
        totalDurationMs: 0,
      });

      mockGetWebhooks.mockResolvedValue([
        {
          url: 'https://example.com/hook1',
          events: ['message_create'],
          registeredAt: new Date().toISOString(),
        },
        {
          url: 'https://example.com/hook2',
          events: ['qr'], // Does not match message_create
          registeredAt: new Date().toISOString(),
        },
      ]);

      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Test',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('1 webhook(s)');

      // Only the matching webhook should be called
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://example.com/hook1',
        expect.objectContaining({
          dataType: 'message_create',
          sessionId: 'mysession',
        }),
      );
    });

    it('reports 0 webhooks when none match the event type', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [],
        totalDurationMs: 0,
      });

      mockGetWebhooks.mockResolvedValue([
        {
          url: 'https://example.com/hook',
          events: ['qr'], // Does not match message_create
          registeredAt: new Date().toISOString(),
        },
      ]);

      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Test',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('0 webhook(s)');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /service/events (default session)
  // ---------------------------------------------------------------------------

  describe('POST /service/events (default session)', () => {
    it('uses default session when no sessionId in URL or body', async () => {
      const response = await request(app)
        .post('/service/events')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Hello',
            fromMe: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('uses sessionId from body when no URL param', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [{ target: { type: 'local_handler' }, success: true, durationMs: 2 }],
        totalDurationMs: 2,
      });

      await request(app)
        .post('/service/events')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          sessionId: 'body-session',
          data: {
            from: '254722833440@c.us',
            body: 'Hello',
            fromMe: false,
          },
        });

      expect(mockRouteEventSync).toHaveBeenCalledWith(
        'body-session',
        'message_create',
        expect.any(Object),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('Error handling', () => {
    it('returns 500 when eventRouter throws', async () => {
      mockRouteEventSync.mockRejectedValue(
        new Error('Router exploded'),
      );

      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: {
            from: '254722833440@c.us',
            body: 'Hello',
            fromMe: false,
          },
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('handles events with no chatId extractable (event without from field)', async () => {
      const response = await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'status_change',
          data: { status: 'CONNECTED' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // No chatId => no tag routing attempted, falls through to legacy
      expect(response.body.mode).toBe('legacy');
    });
  });

  // ---------------------------------------------------------------------------
  // ChatId extraction from different data shapes
  // ---------------------------------------------------------------------------

  describe('ChatId extraction from event data', () => {
    it('extracts chatId from data.from and routes', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [{ target: { type: 'local_handler' }, success: true, durationMs: 1 }],
        totalDurationMs: 1,
      });

      await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: { from: '254722833440@c.us', body: 'Hi' },
        });

      // routeEventSync should be called (chatId was extracted)
      expect(mockRouteEventSync).toHaveBeenCalled();
    });

    it('extracts chatId from data.chatId and routes', async () => {
      mockRouteEventSync.mockResolvedValue({
        success: true,
        results: [{ target: { type: 'local_handler' }, success: true, durationMs: 1 }],
        totalDurationMs: 1,
      });

      await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'message_create',
          data: { chatId: '254722833440@c.us', body: 'Hi' },
        });

      expect(mockRouteEventSync).toHaveBeenCalled();
    });

    it('does not route when data has no identifiable chatId', async () => {
      await request(app)
        .post('/service/events/mysession')
        .set('x-api-key', API_KEY)
        .send({
          dataType: 'unknown_event',
          data: { randomField: 'value' },
        });

      // routeEventSync should NOT be called when no chatId is found
      expect(mockRouteEventSync).not.toHaveBeenCalled();
    });
  });
});
