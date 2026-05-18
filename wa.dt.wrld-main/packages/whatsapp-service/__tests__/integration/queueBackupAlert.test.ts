/**
 * Integration Test: Queue Backup Alerts
 *
 * End-to-end test for queue backup alert flow:
 * 1. Fill queue with test events (simulate high queue depth)
 * 2. Verify alert triggered when threshold exceeded
 * 3. Verify alert appears in dashboard (via API)
 * 4. Acknowledge alert and verify state change
 */

// CRITICAL: Set environment variables BEFORE imports
process.env.ENABLE_ALERTS = 'true';
process.env.ALERT_MAX_RETENTION = '1000';
process.env.ALERT_AUTO_ACK_MINUTES = '0';
process.env.ALERT_QUEUE_THRESHOLD = '100';
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
import { alertConfig } from '../../src/shared/config';
import { Alert } from '../../src/types/alert';

// Mock axios for webhook testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Queue Backup Alert E2E', () => {
  let app: Application;
  const API_KEY = 'test-api-key';
  let alertId: string;

  beforeAll(async () => {
    // Verify alerts are enabled
    expect(alertConfig.enabled).toBe(true);
    expect(alertConfig.queueBackupThreshold).toBe(100);

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

  describe('Step 1: Fill queue with test events', () => {
    it('should trigger alert when queue depth exceeds threshold', async () => {
      // Simulate queue stats exceeding threshold
      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };

      const totalPending = queueStats.waiting + queueStats.active + queueStats.delayed; // 105
      expect(totalPending).toBeGreaterThan(alertConfig.queueBackupThreshold);

      // Call checkQueueBackup
      await eventRouter.checkQueueBackup(queueStats);

      // Verify alert created in database
      const alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);

      const alert = alerts[0];
      expect(alert.type).toBe('queue_backup');
      expect(alert.severity).toBe('warning');
      expect(alert.message).toContain('Event queue depth (105) exceeded threshold (100)');
      expect(alert.acknowledged).toBe(false);
      expect(alert.metadata).toMatchObject({
        queueName: 'whatsapp-events',
        queueDepth: totalPending,
        threshold: alertConfig.queueBackupThreshold,
        waiting: queueStats.waiting,
        active: queueStats.active,
        delayed: queueStats.delayed,
      });

      // Save alertId for later tests
      alertId = alert._id.toString();
    });

    it('should not trigger alert when queue depth is below threshold', async () => {
      // Simulate queue stats below threshold
      const queueStats = {
        waiting: 20,
        active: 15,
        delayed: 10,
      };

      const totalPending = queueStats.waiting + queueStats.active + queueStats.delayed; // 45
      expect(totalPending).toBeLessThan(alertConfig.queueBackupThreshold);

      // Call checkQueueBackup
      await eventRouter.checkQueueBackup(queueStats);

      // Verify no alert created
      const alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(0);
    });

    it('should not create duplicate alerts (deduplication)', async () => {
      // Simulate queue stats exceeding threshold
      const queueStats = {
        waiting: 80,
        active: 20,
        delayed: 10,
      };

      // Call checkQueueBackup twice
      await eventRouter.checkQueueBackup(queueStats);
      await eventRouter.checkQueueBackup(queueStats);

      // Verify only one alert created (deduplication)
      const alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);
    });

    it('should create new alert after previous alert is acknowledged', async () => {
      // Simulate queue stats exceeding threshold
      const queueStats = {
        waiting: 80,
        active: 20,
        delayed: 10,
      };

      // Create first alert
      await eventRouter.checkQueueBackup(queueStats);

      let alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);

      // Acknowledge the alert
      const firstAlertId = alerts[0]._id.toString();
      await alertService.acknowledgeAlert(firstAlertId);

      // Call checkQueueBackup again - should create new alert
      await eventRouter.checkQueueBackup(queueStats);

      alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(2);
      expect(alerts[0].acknowledged).toBe(true);
      expect(alerts[1].acknowledged).toBe(false);
    });
  });

  describe('Step 2: Verify alert in database', () => {
    beforeEach(async () => {
      // Create test alert
      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };
      await eventRouter.checkQueueBackup(queueStats);

      const alerts = await AlertModel.find({ type: 'queue_backup' });
      alertId = alerts[0]._id.toString();
    });

    it('should find alert by ID', async () => {
      const alert = await AlertModel.findById(alertId);

      expect(alert).toBeTruthy();
      expect(alert?.type).toBe('queue_backup');
      expect(alert?.severity).toBe('warning');
      expect(alert?.metadata?.queueName).toBe('whatsapp-events');
      expect(alert?.metadata?.queueDepth).toBe(105);
    });

    it('should find alert by type', async () => {
      const alerts = await AlertModel.find({ type: 'queue_backup' });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('queue_backup');
    });

    it('should find alert by severity', async () => {
      const alerts = await AlertModel.find({ severity: 'warning' });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every((a) => a.severity === 'warning')).toBe(true);
    });

    it('should find unacknowledged alerts', async () => {
      const alerts = await AlertModel.find({ acknowledged: false });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every((a) => a.acknowledged === false)).toBe(true);
    });
  });

  describe('Step 3: Verify alert appears in dashboard (API)', () => {
    beforeEach(async () => {
      // Create test alert
      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };
      await eventRouter.checkQueueBackup(queueStats);

      const alerts = await AlertModel.find({ type: 'queue_backup' });
      alertId = alerts[0]._id.toString();
    });

    it('should list alerts via GET /alerts', async () => {
      const response = await request(app)
        .get('/alerts')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].type).toBe('queue_backup');
      expect(response.body.total).toBe(1);
    });

    it('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/alerts?type=queue_backup')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].type).toBe('queue_backup');
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/alerts?severity=warning')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts.length).toBeGreaterThan(0);
      expect(response.body.alerts.every((a: Alert) => a.severity === 'warning')).toBe(true);
    });

    it('should filter alerts by acknowledged status', async () => {
      const response = await request(app)
        .get('/alerts?acknowledged=false')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts.length).toBeGreaterThan(0);
      expect(response.body.alerts.every((a: Alert) => a.acknowledged === false)).toBe(true);
    });

    it('should get specific alert by ID', async () => {
      const response = await request(app)
        .get(`/alerts/${alertId}`)
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alert._id).toBe(alertId);
      expect(response.body.alert.type).toBe('queue_backup');
      expect(response.body.alert.metadata.queueDepth).toBe(105);
    });

    it('should get alert statistics', async () => {
      const response = await request(app)
        .get('/alerts/stats')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total).toBe(1);
      expect(response.body.unacknowledged).toBe(1);
      expect(response.body.acknowledged).toBe(0);
      expect(response.body.bySeverity.warning).toBe(1);
      expect(response.body.byType.queue_backup).toBe(1);
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/alerts/${fakeId}`)
        .set('x-api-key', API_KEY)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should require API key', async () => {
      await request(app)
        .get('/alerts')
        .expect(403);
    });

    it('should reject invalid API key', async () => {
      await request(app)
        .get('/alerts')
        .set('x-api-key', 'wrong-key')
        .expect(403);
    });
  });

  describe('Step 4: Acknowledge alert and verify state change', () => {
    beforeEach(async () => {
      // Create test alert
      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };
      await eventRouter.checkQueueBackup(queueStats);

      const alerts = await AlertModel.find({ type: 'queue_backup' });
      alertId = alerts[0]._id.toString();
    });

    it('should acknowledge alert via POST /alerts/:id/acknowledge', async () => {
      const response = await request(app)
        .post(`/alerts/${alertId}/acknowledge`)
        .set('x-api-key', API_KEY)
        .send({ acknowledgedBy: 'test-operator' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alert._id).toBe(alertId);
      expect(response.body.alert.acknowledged).toBe(true);
      expect(response.body.alert.acknowledgedBy).toBe('test-operator');
      expect(response.body.alert.acknowledgedAt).toBeTruthy();
    });

    it('should verify acknowledgment in database', async () => {
      // Acknowledge via service
      const result = await alertService.acknowledgeAlert(alertId, 'test-operator');

      expect(result.success).toBe(true);
      expect(result.alert?.acknowledged).toBe(true);
      expect(result.alert?.acknowledgedBy).toBe('test-operator');

      // Verify in database
      const alert = await AlertModel.findById(alertId);
      expect(alert?.acknowledged).toBe(true);
      expect(alert?.acknowledgedBy).toBe('test-operator');
      expect(alert?.acknowledgedAt).toBeTruthy();
    });

    it('should delete alert via DELETE /alerts/:id', async () => {
      const response = await request(app)
        .delete(`/alerts/${alertId}`)
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deletedId).toBe(alertId);

      // Verify deleted from database
      const alert = await AlertModel.findById(alertId);
      expect(alert).toBeNull();
    });

    it('should return 404 when acknowledging non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/alerts/${fakeId}/acknowledge`)
        .set('x-api-key', API_KEY)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Step 5: Verify webhook sent (if configured)', () => {
    beforeEach(async () => {
      // Clear alerts before each test
      await AlertModel.deleteMany({});

      // Reset axios mock
      jest.clearAllMocks();
      mockedAxios.post.mockResolvedValue({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} as never });

      // Temporarily enable webhook for this test suite
      alertConfig.webhook.enabled = true;
      alertConfig.webhook.webhookUrl = 'https://webhook.test/alerts';
      alertConfig.webhook.severityFilter = ['info', 'warning', 'critical'];
      alertConfig.webhook.typeFilter = ['session_disconnect', 'failed_message', 'queue_backup', 'escalation_needed'];
    });

    afterEach(() => {
      // Restore webhook config
      alertConfig.webhook.enabled = false;
      alertConfig.webhook.webhookUrl = undefined;
    });

    it('should send webhook when alert is created', async () => {
      // Simulate queue stats exceeding threshold
      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };

      await eventRouter.checkQueueBackup(queueStats);

      // Verify webhook was called
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://webhook.test/alerts',
        expect.objectContaining({
          alert: expect.objectContaining({
            type: 'queue_backup',
            severity: 'warning',
            metadata: expect.objectContaining({
              queueName: 'whatsapp-events',
              queueDepth: 105,
              threshold: 100,
            }),
          }),
          sentAt: expect.any(String),
          source: 'whatsapp-service',
        }),
        expect.objectContaining({
          headers: expect.any(Object),
          timeout: expect.any(Number),
        })
      );
    });

    it('should filter webhook by severity', async () => {
      // Set severity filter to only send critical alerts
      alertConfig.webhook.severityFilter = ['critical'];

      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };

      await eventRouter.checkQueueBackup(queueStats);

      // Verify webhook was NOT called (queue_backup has warning severity)
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should filter webhook by type', async () => {
      // Set type filter to only send session_disconnect alerts
      alertConfig.webhook.typeFilter = ['session_disconnect'];

      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };

      await eventRouter.checkQueueBackup(queueStats);

      // Verify webhook was NOT called (queue_backup type not in filter)
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should not send webhook when disabled', async () => {
      // Disable webhook
      alertConfig.webhook.enabled = false;

      const queueStats = {
        waiting: 70,
        active: 25,
        delayed: 10,
      };

      await eventRouter.checkQueueBackup(queueStats);

      // Verify webhook was NOT called
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple queue backup alerts with different depths', async () => {
      const queueStats1 = {
        waiting: 70,
        active: 25,
        delayed: 10,
      }; // 105 total

      const queueStats2 = {
        waiting: 120,
        active: 50,
        delayed: 30,
      }; // 200 total

      // Create first alert
      await eventRouter.checkQueueBackup(queueStats1);

      let alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metadata?.queueDepth).toBe(105);

      // Acknowledge first alert
      await alertService.acknowledgeAlert(alerts[0]._id.toString());

      // Create second alert with higher depth
      await eventRouter.checkQueueBackup(queueStats2);

      alerts = await AlertModel.find({ type: 'queue_backup' }).sort({ createdAt: 1 });
      expect(alerts).toHaveLength(2);
      expect(alerts[0].metadata?.queueDepth).toBe(105);
      expect(alerts[0].acknowledged).toBe(true);
      expect(alerts[1].metadata?.queueDepth).toBe(200);
      expect(alerts[1].acknowledged).toBe(false);
    });

    it('should handle queue stats at exact threshold', async () => {
      const queueStats = {
        waiting: 50,
        active: 30,
        delayed: 20,
      }; // 100 total (exactly at threshold)

      await eventRouter.checkQueueBackup(queueStats);

      // Should create alert at threshold
      const alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metadata?.queueDepth).toBe(100);
    });

    it('should handle queue stats with zero delayed jobs', async () => {
      const queueStats = {
        waiting: 90,
        active: 15,
        delayed: 0,
      }; // 105 total

      await eventRouter.checkQueueBackup(queueStats);

      const alerts = await AlertModel.find({ type: 'queue_backup' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metadata?.delayed).toBe(0);
    });

    it('should handle pagination in alert listing', async () => {
      // Create multiple alerts
      for (let i = 0; i < 5; i++) {
        const queueStats = {
          waiting: 70 + i * 10,
          active: 25,
          delayed: 10,
        };
        await eventRouter.checkQueueBackup(queueStats);

        // Acknowledge to allow next alert to be created
        const alerts = await AlertModel.find({ type: 'queue_backup', acknowledged: false });
        if (alerts.length > 0) {
          await alertService.acknowledgeAlert(alerts[0]._id.toString());
        }
      }

      // Test pagination
      const response = await request(app)
        .get('/alerts?limit=2&offset=0')
        .set('x-api-key', API_KEY)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toHaveLength(2);
      expect(response.body.total).toBe(5);
    });
  });
});
