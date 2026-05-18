/**
 * Integration Test: Session Disconnect Alerts
 *
 * End-to-end test for session disconnect alert flow:
 * 1. Simulate session disconnect event
 * 2. Verify alert created in database
 * 3. Verify alert appears via API
 * 4. Verify webhook sent (if configured)
 */

// CRITICAL: Set environment variables BEFORE imports
process.env.ENABLE_ALERTS = 'true';
process.env.ALERT_MAX_RETENTION = '1000';
process.env.ALERT_AUTO_ACK_MINUTES = '0';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-test';
process.env.API_KEY = 'test-api-key';

import request from 'supertest';
import express, { Application } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { alertService } from '../../src/services/alertService';
import { eventRouter } from '../../src/services/eventRouter';
import { alertsRouter } from '../../src/routes/alerts';
import { Alert as AlertModel } from '../../src/models/Alert';
import { QueuedEvent } from '../../src/services/eventQueue';
import { alertConfig } from '../../src/shared/config';

// Mock axios for webhook testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Session Disconnect Alert E2E', () => {
  let app: Application;
  const API_KEY = 'test-api-key';
  let alertId: string;

  beforeAll(async () => {
    // Verify alerts are enabled
    expect(alertConfig.enabled).toBe(true);

    // Connect to test MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-test');
    }

    // Initialize alert service
    await alertService.initialize();

    // Create Express app with alert routes
    app = express();
    app.use(express.json());

    // API key middleware
    app.use((req, res, next) => {
      const providedKey = req.headers['x-api-key'];
      if (!providedKey || providedKey !== API_KEY) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or missing API key',
        });
      }
      next();
    });

    app.use(alertsRouter);
  });

  afterAll(async () => {
    // Cleanup: Delete all test alerts
    await AlertModel.deleteMany({});

    // Close MongoDB connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear alerts before each test
    await AlertModel.deleteMany({});

    // Reset axios mock
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} as never });
  });

  describe('Step 1: Simulate session disconnect event', () => {
    it('should create alert when session disconnects', async () => {
      const sessionId = 'test-session-123';

      // Create a session disconnect event
      const disconnectEvent: QueuedEvent = {
        sessionId,
        dataType: 'disconnected',
        data: undefined as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      // Process the event through eventRouter
      const result = await eventRouter.processEvent(disconnectEvent);

      // Verify event was processed successfully
      expect(result.success).toBe(true);

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify alert was created in database
      const alerts = await AlertModel.find({ type: 'session_disconnect' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toContain('disconnected');
      expect(alerts[0].metadata?.sessionId).toBe(sessionId);
      expect(alerts[0].acknowledged).toBe(false);

      // Store alert ID for next tests
      alertId = alerts[0]._id.toString();
    });

    it('should handle session_disconnect dataType', async () => {
      const sessionId = 'test-session-456';

      // Alternative disconnect event type
      const disconnectEvent: QueuedEvent = {
        sessionId,
        dataType: 'session_disconnect',
        data: {} as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(disconnectEvent);
      expect(result.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 100));

      const alerts = await AlertModel.find({
        type: 'session_disconnect',
        'metadata.sessionId': sessionId,
      });
      expect(alerts).toHaveLength(1);
    });
  });

  describe('Step 2: Verify alert in database', () => {
    beforeEach(async () => {
      // Create a test alert
      const sessionId = 'db-test-session';
      const disconnectEvent: QueuedEvent = {
        sessionId,
        dataType: 'disconnected',
        data: undefined as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(disconnectEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      const alerts = await AlertModel.find({ 'metadata.sessionId': sessionId });
      alertId = alerts[0]._id.toString();
    });

    it('should retrieve alert from database by ID', async () => {
      const alert = await AlertModel.findById(alertId);

      expect(alert).toBeDefined();
      expect(alert?.type).toBe('session_disconnect');
      expect(alert?.severity).toBe('critical');
      expect(alert?.acknowledged).toBe(false);
      expect(alert?.metadata).toBeDefined();
      expect(alert?.createdAt).toBeDefined();
      expect(alert?.updatedAt).toBeDefined();
    });

    it('should query alerts by type', async () => {
      const alerts = await AlertModel.find({ type: 'session_disconnect' });

      expect(alerts.length).toBeGreaterThan(0);
      alerts.forEach(alert => {
        expect(alert.type).toBe('session_disconnect');
      });
    });

    it('should query alerts by severity', async () => {
      const alerts = await AlertModel.find({ severity: 'critical' });

      expect(alerts.length).toBeGreaterThan(0);
      alerts.forEach(alert => {
        expect(alert.severity).toBe('critical');
      });
    });

    it('should query unacknowledged alerts', async () => {
      const alerts = await AlertModel.find({ acknowledged: false });

      expect(alerts.length).toBeGreaterThan(0);
      alerts.forEach(alert => {
        expect(alert.acknowledged).toBe(false);
      });
    });
  });

  describe('Step 3: Verify alert appears via API', () => {
    beforeEach(async () => {
      // Create a test alert
      const sessionId = 'api-test-session';
      const disconnectEvent: QueuedEvent = {
        sessionId,
        dataType: 'disconnected',
        data: undefined as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(disconnectEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      const alerts = await AlertModel.find({ 'metadata.sessionId': sessionId });
      alertId = alerts[0]._id.toString();
    });

    it('should list alerts via GET /alerts', async () => {
      const response = await request(app)
        .get('/alerts')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toBeDefined();
      expect(response.body.alerts.length).toBeGreaterThan(0);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/alerts?type=session_disconnect')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toBeDefined();

      response.body.alerts.forEach((alert: { type: string }) => {
        expect(alert.type).toBe('session_disconnect');
      });
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/alerts?severity=critical')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.alerts.forEach((alert: { severity: string }) => {
        expect(alert.severity).toBe('critical');
      });
    });

    it('should filter unacknowledged alerts', async () => {
      const response = await request(app)
        .get('/alerts?acknowledged=false')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.alerts.forEach((alert: { acknowledged: boolean }) => {
        expect(alert.acknowledged).toBe(false);
      });
    });

    it('should get specific alert by ID', async () => {
      const response = await request(app)
        .get(`/alerts/${alertId}`)
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert).toBeDefined();
      expect(response.body.alert._id).toBe(alertId);
      expect(response.body.alert.type).toBe('session_disconnect');
    });

    it('should get alert statistics', async () => {
      const response = await request(app)
        .get('/alerts/stats')
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.bySeverity).toBeDefined();
      expect(response.body.bySeverity.critical).toBeGreaterThan(0);
      expect(response.body.byType).toBeDefined();
      expect(response.body.byType.session_disconnect).toBeGreaterThan(0);
    });

    it('should acknowledge alert via POST /alerts/:id/acknowledge', async () => {
      const response = await request(app)
        .post(`/alerts/${alertId}/acknowledge`)
        .set('x-api-key', API_KEY)
        .send({ acknowledgedBy: 'test-operator' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert).toBeDefined();
      expect(response.body.alert.acknowledged).toBe(true);
      expect(response.body.alert.acknowledgedBy).toBe('test-operator');
      expect(response.body.alert.acknowledgedAt).toBeDefined();
    });

    it('should delete alert via DELETE /alerts/:id', async () => {
      const response = await request(app)
        .delete(`/alerts/${alertId}`)
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedId).toBe(alertId);

      // Verify alert is deleted from database
      const alert = await AlertModel.findById(alertId);
      expect(alert).toBeNull();
    });
  });

  describe('Step 4: Verify webhook sent (if configured)', () => {
    beforeEach(() => {
      // Reset webhook mock
      jest.clearAllMocks();
      mockedAxios.post.mockResolvedValue({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      });
    });

    it('should send webhook when webhook is configured', async () => {
      // Temporarily enable webhook for this test
      const originalWebhook = { ...alertConfig.webhook };
      alertConfig.webhook.enabled = true;
      alertConfig.webhook.webhookUrl = 'https://hooks.slack.com/test-webhook';
      alertConfig.webhook.severityFilter = [];
      alertConfig.webhook.typeFilter = [];

      try {
        const sessionId = 'webhook-test-session';
        const disconnectEvent: QueuedEvent = {
          sessionId,
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        };

        await eventRouter.processEvent(disconnectEvent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify webhook was called
        expect(mockedAxios.post).toHaveBeenCalled();
        const callArgs = mockedAxios.post.mock.calls[0];
        expect(callArgs[0]).toBe('https://hooks.slack.com/test-webhook');

        const payload = callArgs[1] as { alert: { type: string; severity: string }; source: string };
        expect(payload.alert).toBeDefined();
        expect(payload.alert.type).toBe('session_disconnect');
        expect(payload.alert.severity).toBe('critical');
        expect(payload.source).toBe('whatsapp-service');
      } finally {
        // Restore original webhook config
        Object.assign(alertConfig.webhook, originalWebhook);
      }
    });

    it('should respect severity filter in webhook delivery', async () => {
      // Configure webhook to only send 'warning' severity
      const originalWebhook = { ...alertConfig.webhook };
      alertConfig.webhook.enabled = true;
      alertConfig.webhook.webhookUrl = 'https://hooks.slack.com/test-webhook';
      alertConfig.webhook.severityFilter = ['warning'];
      alertConfig.webhook.typeFilter = [];

      try {
        const sessionId = 'webhook-filter-session';
        const disconnectEvent: QueuedEvent = {
          sessionId,
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        };

        await eventRouter.processEvent(disconnectEvent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Webhook should NOT be called because severity is 'critical', not 'warning'
        expect(mockedAxios.post).not.toHaveBeenCalled();
      } finally {
        // Restore original webhook config
        Object.assign(alertConfig.webhook, originalWebhook);
      }
    });

    it('should respect type filter in webhook delivery', async () => {
      // Configure webhook to only send 'queue_backup' type
      const originalWebhook = { ...alertConfig.webhook };
      alertConfig.webhook.enabled = true;
      alertConfig.webhook.webhookUrl = 'https://hooks.slack.com/test-webhook';
      alertConfig.webhook.severityFilter = [];
      alertConfig.webhook.typeFilter = ['queue_backup'];

      try {
        const sessionId = 'webhook-type-filter-session';
        const disconnectEvent: QueuedEvent = {
          sessionId,
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        };

        await eventRouter.processEvent(disconnectEvent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Webhook should NOT be called because type is 'session_disconnect', not 'queue_backup'
        expect(mockedAxios.post).not.toHaveBeenCalled();
      } finally {
        // Restore original webhook config
        Object.assign(alertConfig.webhook, originalWebhook);
      }
    });

    it('should not send webhook when webhook is disabled', async () => {
      // Ensure webhook is disabled
      const originalWebhook = { ...alertConfig.webhook };
      alertConfig.webhook.enabled = false;

      try {
        const sessionId = 'webhook-disabled-session';
        const disconnectEvent: QueuedEvent = {
          sessionId,
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        };

        await eventRouter.processEvent(disconnectEvent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Webhook should NOT be called
        expect(mockedAxios.post).not.toHaveBeenCalled();
      } finally {
        // Restore original webhook config
        Object.assign(alertConfig.webhook, originalWebhook);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple simultaneous disconnect events', async () => {
      const events: QueuedEvent[] = [
        {
          sessionId: 'session-1',
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        },
        {
          sessionId: 'session-2',
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        },
        {
          sessionId: 'session-3',
          dataType: 'disconnected',
          data: undefined as unknown as Record<string, unknown>,
          receivedAt: new Date().toISOString(),
          tags: [],
        },
      ];

      // Process all events concurrently
      await Promise.all(events.map(event => eventRouter.processEvent(event)));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all alerts were created
      const alerts = await AlertModel.find({ type: 'session_disconnect' });
      expect(alerts.length).toBeGreaterThanOrEqual(3);
    });

    it('should require API key for protected endpoints', async () => {
      const response = await request(app).get('/alerts');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('API key');
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/alerts/${fakeId}`)
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
