/**
 * API Route Tests
 *
 * Tests for Express routes using supertest.
 * Validates Task 029: "API tests pass, all 9 endpoints functional"
 */

import request from 'supertest';
import { createTestApp, MockWebhook } from '../fixtures/createTestApp';

describe('API Routes', () => {
  const API_KEY = 'test-api-key';

  describe('Health Endpoints (No Auth Required)', () => {
    it('GET /health returns healthy status', async () => {
      const { app } = createTestApp();

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'whatsapp-service',
        mode: 'thin-wrapper',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('GET /ping returns pong', async () => {
      const { app } = createTestApp();

      const response = await request(app).get('/ping');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'pong',
      });
    });
  });

  describe('Authentication', () => {
    it('returns 403 when API key is missing', async () => {
      const { app } = createTestApp();

      const response = await request(app)
        .post('/webhook')
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or missing API key',
      });
    });

    it('returns 403 when API key is invalid', async () => {
      const { app } = createTestApp();

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', 'wrong-key')
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or missing API key',
      });
    });

    it('accepts API key in x-api-key header', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(200);
    });

    it('accepts API key in Authorization Bearer header', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/webhook')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /webhook (Single Session)', () => {
    it('returns 400 when action is missing', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({ data: { chatId: '123' } });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Action is required',
      });
    });

    it('dispatches action with default sessionId', async () => {
      const { app, dispatcher } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({
          action: 'send_message',
          data: { chatId: '123456789@c.us', message: 'Hello' },
        });

      expect(response.status).toBe(200);
      expect(dispatcher.dispatch).toHaveBeenCalledWith('default', {
        action: 'send_message',
        data: { chatId: '123456789@c.us', message: 'Hello' },
      });
    });

    it('dispatches action with provided sessionId', async () => {
      const { app, dispatcher } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({
          action: 'send_message',
          sessionId: 'my-session',
          data: { chatId: '123456789@c.us', message: 'Hello' },
        });

      expect(response.status).toBe(200);
      expect(dispatcher.dispatch).toHaveBeenCalledWith('my-session', {
        action: 'send_message',
        data: { chatId: '123456789@c.us', message: 'Hello' },
      });
    });

    it('returns dispatcher result', async () => {
      const mockResult = { success: true, data: { messageId: 'msg123' } };
      const { app } = createTestApp({
        apiKey: API_KEY,
        dispatcher: { dispatch: jest.fn().mockResolvedValue(mockResult) },
      });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
    });

    it('returns 500 when dispatcher throws', async () => {
      const { app } = createTestApp({
        apiKey: API_KEY,
        dispatcher: { dispatch: jest.fn().mockRejectedValue(new Error('Dispatch failed')) },
      });

      const response = await request(app)
        .post('/webhook')
        .set('x-api-key', API_KEY)
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Dispatch failed',
      });
    });
  });

  describe('POST /session/:sessionId/webhook (Multi-Session)', () => {
    it('returns 400 when action is missing', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/session/my-session/webhook')
        .set('x-api-key', API_KEY)
        .send({ data: { chatId: '123' } });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Action is required',
      });
    });

    it('dispatches action with sessionId from URL path', async () => {
      const { app, dispatcher } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/session/business-session/webhook')
        .set('x-api-key', API_KEY)
        .send({
          action: 'get_chats',
          data: {},
        });

      expect(response.status).toBe(200);
      expect(dispatcher.dispatch).toHaveBeenCalledWith('business-session', {
        action: 'get_chats',
        data: {},
      });
    });

    it('returns 500 when dispatcher throws', async () => {
      const { app } = createTestApp({
        apiKey: API_KEY,
        dispatcher: { dispatch: jest.fn().mockRejectedValue(new Error('Session not found')) },
      });

      const response = await request(app)
        .post('/session/unknown/webhook')
        .set('x-api-key', API_KEY)
        .send({ action: 'send_message', data: {} });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Session not found',
      });
    });
  });

  describe('Webhook Registration Endpoints', () => {
    describe('POST /webhook/register/:sessionId?', () => {
      it('returns 400 when webhookUrl is missing', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/register')
          .set('x-api-key', API_KEY)
          .send({ events: ['message'] });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'webhookUrl is required',
        });
      });

      it('registers webhook with default sessionId and events', async () => {
        const { app, stateManager } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/register')
          .set('x-api-key', API_KEY)
          .send({ webhookUrl: 'https://example.com/webhook' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Webhook registered successfully',
          registration: {
            sessionId: 'default',
            webhookUrl: 'https://example.com/webhook',
            events: ['message', 'qr', 'status_change', 'group_join', 'group_leave'],
          },
        });
        expect(stateManager.registerWebhook).toHaveBeenCalledWith(
          'default',
          'https://example.com/webhook',
          ['message', 'qr', 'status_change', 'group_join', 'group_leave']
        );
      });

      it('registers webhook with custom sessionId and events', async () => {
        const { app, stateManager } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/register/my-session')
          .set('x-api-key', API_KEY)
          .send({
            webhookUrl: 'https://example.com/webhook',
            events: ['message', 'qr'],
          });

        expect(response.status).toBe(200);
        expect(response.body.registration).toEqual({
          sessionId: 'my-session',
          webhookUrl: 'https://example.com/webhook',
          events: ['message', 'qr'],
        });
        expect(stateManager.registerWebhook).toHaveBeenCalledWith(
          'my-session',
          'https://example.com/webhook',
          ['message', 'qr']
        );
      });

      it('returns 500 when stateManager throws', async () => {
        const { app } = createTestApp({
          apiKey: API_KEY,
          stateManager: {
            init: jest.fn(),
            close: jest.fn(),
            registerWebhook: jest.fn().mockRejectedValue(new Error('Database error')),
            unregisterWebhook: jest.fn(),
            getWebhooks: jest.fn(),
          },
        });

        const response = await request(app)
          .post('/webhook/register')
          .set('x-api-key', API_KEY)
          .send({ webhookUrl: 'https://example.com/webhook' });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Database error',
        });
      });
    });

    describe('POST /webhook/unregister/:sessionId?', () => {
      it('returns 400 when webhookUrl is missing', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/unregister')
          .set('x-api-key', API_KEY)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'webhookUrl is required',
        });
      });

      it('unregisters webhook with default sessionId', async () => {
        const { app, stateManager } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/unregister')
          .set('x-api-key', API_KEY)
          .send({ webhookUrl: 'https://example.com/webhook' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Webhook unregistered successfully',
        });
        expect(stateManager.unregisterWebhook).toHaveBeenCalledWith(
          'default',
          'https://example.com/webhook'
        );
      });

      it('unregisters webhook with custom sessionId', async () => {
        const { app, stateManager } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/webhook/unregister/my-session')
          .set('x-api-key', API_KEY)
          .send({ webhookUrl: 'https://example.com/webhook' });

        expect(response.status).toBe(200);
        expect(stateManager.unregisterWebhook).toHaveBeenCalledWith(
          'my-session',
          'https://example.com/webhook'
        );
      });
    });

    describe('GET /webhook/list/:sessionId?', () => {
      it('lists webhooks with default sessionId', async () => {
        const mockWebhooks: MockWebhook[] = [
          {
            url: 'https://example.com/webhook1',
            events: ['message'],
            registeredAt: new Date('2026-01-20T00:00:00Z'),
          },
          {
            url: 'https://example.com/webhook2',
            events: ['qr', 'status_change'],
            registeredAt: new Date('2026-01-21T00:00:00Z'),
          },
        ];

        const { app } = createTestApp({
          apiKey: API_KEY,
          stateManager: {
            init: jest.fn(),
            close: jest.fn(),
            registerWebhook: jest.fn(),
            unregisterWebhook: jest.fn(),
            getWebhooks: jest.fn().mockResolvedValue(mockWebhooks),
          },
        });

        const response = await request(app)
          .get('/webhook/list')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          sessionId: 'default',
          webhooks: [
            {
              url: 'https://example.com/webhook1',
              events: ['message'],
              registeredAt: '2026-01-20T00:00:00.000Z',
            },
            {
              url: 'https://example.com/webhook2',
              events: ['qr', 'status_change'],
              registeredAt: '2026-01-21T00:00:00.000Z',
            },
          ],
        });
      });

      it('lists webhooks with custom sessionId', async () => {
        const { app, stateManager } = createTestApp({ apiKey: API_KEY });

        await request(app)
          .get('/webhook/list/my-session')
          .set('x-api-key', API_KEY);

        expect(stateManager.getWebhooks).toHaveBeenCalledWith('my-session');
      });

      it('returns empty list when no webhooks', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .get('/webhook/list')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          sessionId: 'default',
          webhooks: [],
        });
      });
    });
  });

  describe('404 Handler', () => {
    it('returns 404 for unknown routes', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .get('/unknown-route')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Endpoint not found',
      });
    });

    it('returns 404 for unknown POST routes', async () => {
      const { app } = createTestApp({ apiKey: API_KEY });

      const response = await request(app)
        .post('/unknown-route')
        .set('x-api-key', API_KEY)
        .send({ data: {} });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Endpoint not found',
      });
    });
  });

  describe('Media Proxy Endpoints', () => {
    describe('POST /media/proxy', () => {
      it('returns 400 when url is missing', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/media/proxy')
          .set('x-api-key', API_KEY)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'url is required',
        });
      });

      it('returns 400 for invalid URL format', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/media/proxy')
          .set('x-api-key', API_KEY)
          .send({ url: 'not-a-valid-url' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          error: 'Invalid URL format',
        });
      });

      it('proxies valid URL and returns cache entry', async () => {
        const mockEntry = {
          id: 'cache-id-123',
          url: 'https://example.com/image.jpg',
          mimetype: 'image/jpeg',
          filename: 'image.jpg',
          size: 2048,
          expiresAt: new Date('2026-01-27T12:05:00.000Z'),
          localPath: '/tmp/cache/cache-id-123.jpg',
          cachedAt: new Date('2026-01-27T12:00:00.000Z'),
        };

        const { app, mediaCacheService } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn().mockResolvedValue(mockEntry),
            get: jest.fn(),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn(),
            clear: jest.fn(),
          },
        });

        const response = await request(app)
          .post('/media/proxy')
          .set('x-api-key', API_KEY)
          .send({ url: 'https://example.com/image.jpg' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.proxyUrl).toContain('/media/cache/cache-id-123');
        expect(response.body.cacheId).toBe('cache-id-123');
        expect(mediaCacheService.fetchAndCache).toHaveBeenCalledWith(
          'https://example.com/image.jpg',
          undefined,
          undefined
        );
      });

      it('passes filename and mimetype to fetchAndCache', async () => {
        const { app, mediaCacheService } = createTestApp({ apiKey: API_KEY });

        await request(app)
          .post('/media/proxy')
          .set('x-api-key', API_KEY)
          .send({
            url: 'https://example.com/file.dat',
            filename: 'custom.jpg',
            mimetype: 'image/jpeg',
          });

        expect(mediaCacheService.fetchAndCache).toHaveBeenCalledWith(
          'https://example.com/file.dat',
          'custom.jpg',
          'image/jpeg'
        );
      });

      it('returns 500 when fetchAndCache throws', async () => {
        const { app } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn().mockRejectedValue(new Error('Failed to fetch media')),
            get: jest.fn(),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn(),
            clear: jest.fn(),
          },
        });

        const response = await request(app)
          .post('/media/proxy')
          .set('x-api-key', API_KEY)
          .send({ url: 'https://example.com/image.jpg' });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Failed to fetch media',
        });
      });

      it('requires API key authentication', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app)
          .post('/media/proxy')
          .send({ url: 'https://example.com/image.jpg' });

        expect(response.status).toBe(403);
      });
    });

    describe('GET /media/cache/:id', () => {
      it('does not require API key authentication', async () => {
        const mockEntry = {
          id: 'cache-id-123',
          url: 'https://example.com/image.jpg',
          mimetype: 'image/jpeg',
          filename: 'image.jpg',
          size: 1024,
          expiresAt: new Date(Date.now() + 300000),
          localPath: '/tmp/cache/cache-id-123.jpg',
          cachedAt: new Date(),
        };

        const { app } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn(),
            get: jest.fn().mockReturnValue(mockEntry),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn(),
            clear: jest.fn(),
          },
        });

        // No x-api-key header
        const response = await request(app).get('/media/cache/cache-id-123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('returns 404 when entry not found', async () => {
        const { app } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn(),
            get: jest.fn().mockReturnValue(null),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn(),
            clear: jest.fn(),
          },
        });

        const response = await request(app).get('/media/cache/non-existent-id');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          success: false,
          error: 'Media not found or expired',
        });
      });

      it('returns entry details for valid cache id', async () => {
        const mockEntry = {
          id: 'cache-id-456',
          url: 'https://example.com/video.mp4',
          mimetype: 'video/mp4',
          filename: 'video.mp4',
          size: 5120,
          expiresAt: new Date(Date.now() + 300000),
          localPath: '/tmp/cache/cache-id-456.mp4',
          cachedAt: new Date(),
        };

        const { app, mediaCacheService } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn(),
            get: jest.fn().mockReturnValue(mockEntry),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn(),
            clear: jest.fn(),
          },
        });

        const response = await request(app).get('/media/cache/cache-id-456');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          entry: {
            id: 'cache-id-456',
            mimetype: 'video/mp4',
            filename: 'video.mp4',
            size: 5120,
          },
        });
        expect(mediaCacheService.get).toHaveBeenCalledWith('cache-id-456');
      });
    });

    describe('GET /media/stats', () => {
      it('requires API key authentication', async () => {
        const { app } = createTestApp({ apiKey: API_KEY });

        const response = await request(app).get('/media/stats');

        expect(response.status).toBe(403);
      });

      it('returns cache statistics', async () => {
        const mockStats = {
          totalEntries: 5,
          totalSize: 10240,
          expiredEntries: 1,
        };

        const { app } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn(),
            get: jest.fn(),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn().mockReturnValue(mockStats),
            clear: jest.fn(),
          },
        });

        const response = await request(app)
          .get('/media/stats')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          stats: {
            totalEntries: 5,
            totalSize: 10240,
            expiredEntries: 1,
          },
        });
      });

      it('returns 500 when getStats throws', async () => {
        const { app } = createTestApp({
          apiKey: API_KEY,
          mediaCacheService: {
            init: jest.fn(),
            close: jest.fn(),
            fetchAndCache: jest.fn(),
            get: jest.fn(),
            getFilePath: jest.fn(),
            cleanup: jest.fn(),
            getStats: jest.fn().mockImplementation(() => {
              throw new Error('Stats unavailable');
            }),
            clear: jest.fn(),
          },
        });

        const response = await request(app)
          .get('/media/stats')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Stats unavailable',
        });
      });
    });
  });
});
