/**
 * Tests for SPAO webhook receiver routes.
 *
 * Verifies:
 * - API key validation (valid, invalid, missing)
 * - Event body validation (valid, malformed, missing fields)
 * - Each event type accepted and dispatched
 * - Health check endpoint
 * - Async processing (respond immediately, process in background)
 */

// Set env before imports
process.env.ENABLE_SPAO = 'false';
process.env.SPAO_API_URL = '';
process.env.SPAO_VOICE_API_URL = '';
process.env.SPAO_API_KEY = '';

import express from 'express';
import request from 'supertest';
import type { SpaoEvent, SpaoEventType } from '../../../src/types/spao';

// Mock spaoEventHandler before importing the router
jest.mock('../../../src/services/spaoEventHandler', () => ({
  spaoEventHandler: {
    processEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spaoEventHandler } = require('../../../src/services/spaoEventHandler') as {
  spaoEventHandler: { processEvent: jest.Mock };
};

function createSpaoTestApp() {
  jest.resetModules();

  // Re-mock after resetModules
  jest.mock('../../../src/services/spaoEventHandler', () => ({
    spaoEventHandler: {
      processEvent: jest.fn().mockResolvedValue(undefined),
    },
  }));

  const app = express();
  app.use(express.json());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const router = require('../../../src/routes/spaoWebhooks').default;
  app.use('/webhooks/spao', router);
  return app;
}

function makeValidEvent(overrides: Partial<SpaoEvent> = {}): SpaoEvent {
  return {
    event_type: 'voice.call.started',
    event_id: 'evt-001',
    timestamp: new Date().toISOString(),
    phone: '254722833440',
    data: { behavior_name: 'somo_buruka' },
    ...overrides,
  };
}

describe('SPAO Webhook Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createSpaoTestApp();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------

  describe('GET /webhooks/spao/health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/webhooks/spao/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('api_url');
    });
  });

  // -------------------------------------------------------------------------
  // API Key Validation
  // -------------------------------------------------------------------------

  describe('API key validation', () => {
    it('rejects request with missing API key', async () => {
      const event = makeValidEvent();

      const res = await request(app)
        .post('/webhooks/spao')
        .send(event);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or missing/i);
    });

    it('rejects request with wrong API key', async () => {
      const event = makeValidEvent();

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'wrong-api-key')
        .send(event);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or missing/i);
    });

    it('accepts request with valid API key', async () => {
      const event = makeValidEvent();

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');
    });
  });

  // -------------------------------------------------------------------------
  // Event Body Validation
  // -------------------------------------------------------------------------

  describe('event body validation', () => {
    it('rejects empty body', async () => {
      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid spao event/i);
      expect(res.body.required).toEqual(
        expect.arrayContaining(['event_type', 'event_id', 'timestamp', 'phone', 'data'])
      );
    });

    it('rejects missing event_type', async () => {
      const event = makeValidEvent();
      const { event_type: _, ...partial } = event;

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('rejects missing event_id', async () => {
      const event = makeValidEvent();
      const { event_id: _, ...partial } = event;

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('rejects missing phone', async () => {
      const event = makeValidEvent();
      const { phone: _, ...partial } = event;

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('rejects missing data', async () => {
      const event = makeValidEvent();
      const { data: _, ...partial } = event;

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('rejects null data', async () => {
      const event = makeValidEvent({ data: null as unknown as Record<string, unknown> });

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      expect(res.status).toBe(400);
    });

    it('rejects invalid event_type', async () => {
      const event = makeValidEvent({ event_type: 'invalid.event' as SpaoEventType });

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      expect(res.status).toBe(400);
      expect(res.body.valid_types).toBeDefined();
    });

    it('returns valid_types in 400 response', async () => {
      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send({});

      expect(res.body.valid_types).toEqual(
        expect.arrayContaining([
          'voice.call.started',
          'voice.call.ended',
          'voice.transcript.summary',
          'voice.module.completed',
          'voice.mcp.tool_call',
          'voice.transcript.chunk',
        ])
      );
    });
  });

  // -------------------------------------------------------------------------
  // Event Type Acceptance
  // -------------------------------------------------------------------------

  describe('event type acceptance', () => {
    const eventTypes: SpaoEventType[] = [
      'voice.call.started',
      'voice.call.ended',
      'voice.transcript.summary',
      'voice.module.completed',
      'voice.mcp.tool_call',
      'voice.transcript.chunk',
    ];

    it.each(eventTypes)('accepts %s event and returns accepted status', async (eventType) => {
      const event = makeValidEvent({
        event_type: eventType,
        event_id: `evt-${eventType}`,
      });

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'accepted',
        event_id: `evt-${eventType}`,
        event_type: eventType,
      });
    });

    it('dispatches event to spaoEventHandler.processEvent', async () => {
      // Get the mocked handler from the actual module after createSpaoTestApp
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { spaoEventHandler: handler } = require('../../../src/services/spaoEventHandler') as {
        spaoEventHandler: { processEvent: jest.Mock };
      };

      const event = makeValidEvent({
        event_type: 'voice.call.ended',
        event_id: 'evt-dispatch-test',
        call_sid: 'CA123',
      });

      await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      // processEvent is called asynchronously, give it a tick
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'voice.call.ended',
          event_id: 'evt-dispatch-test',
          call_sid: 'CA123',
          phone: '254722833440',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Response Format
  // -------------------------------------------------------------------------

  describe('response format', () => {
    it('includes event_id and event_type in accepted response', async () => {
      const event = makeValidEvent({
        event_id: 'evt-response-format',
        event_type: 'voice.call.started',
      });

      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);

      expect(res.body).toEqual({
        status: 'accepted',
        event_id: 'evt-response-format',
        event_type: 'voice.call.started',
      });
    });

    it('responds immediately (does not wait for processEvent)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { spaoEventHandler: handler } = require('../../../src/services/spaoEventHandler') as {
        spaoEventHandler: { processEvent: jest.Mock };
      };

      // Make processEvent take a long time
      handler.processEvent.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      const event = makeValidEvent();

      const start = Date.now();
      const res = await request(app)
        .post('/webhooks/spao')
        .set('x-api-key', 'test-api-key')
        .send(event);
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      // Should respond well under 5 seconds since it doesn't await processEvent
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
