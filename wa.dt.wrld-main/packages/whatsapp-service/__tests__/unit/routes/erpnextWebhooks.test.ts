/**
 * Tests for ERPNext webhook receiver routes.
 *
 * Verifies:
 * - Signature validation (dev mode, valid, invalid)
 * - Contact webhook handler
 * - Campaign webhook handler
 * - Health check endpoint
 */

// Set env before imports
process.env.ENABLE_ERPNEXT_SYNC = 'false';
process.env.ERPNEXT_URL = '';
process.env.ERPNEXT_API_KEY = '';
process.env.ERPNEXT_API_SECRET = '';
process.env.ERPNEXT_WEBHOOK_SECRET = '';

import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

// Create test app
function createTestApp(webhookSecret = '') {
  // Set secret before importing (module reads at load time)
  process.env.ERPNEXT_WEBHOOK_SECRET = webhookSecret;

  // Clear module cache to pick up new env
  jest.resetModules();

  const app = express();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const router = require('../../../src/routes/erpnextWebhooks').default;
  app.use('/webhooks/erpnext', router);
  return app;
}

describe('ERPNext Webhook Routes', () => {
  describe('health check', () => {
    it('returns ok status', async () => {
      const app = createTestApp();
      const res = await request(app).get('/webhooks/erpnext/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('contact webhook (dev mode - no secret)', () => {
    it('accepts contact with phone', async () => {
      const app = createTestApp('');
      const payload = {
        doc: {
          name: 'CT-001',
          mobile_no: '+254712345678',
          first_name: 'Test',
        },
      };

      const res = await request(app)
        .post('/webhooks/erpnext/contact')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.phone).toBe('+254712345678');
    });

    it('skips contact without phone', async () => {
      const app = createTestApp('');
      const payload = {
        doc: {
          name: 'CT-002',
          first_name: 'No Phone',
        },
      };

      const res = await request(app)
        .post('/webhooks/erpnext/contact')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('skipped');
      expect(res.body.reason).toBe('no_phone');
    });
  });

  describe('campaign webhook (dev mode - no secret)', () => {
    it('accepts campaign with tag', async () => {
      const app = createTestApp('');
      const payload = {
        doc: {
          name: 'CAMP-001',
          campaign_name: 'Test Campaign',
          custom_wa_tag: 'SOMO',
        },
      };

      const res = await request(app)
        .post('/webhooks/erpnext/campaign')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.tag).toBe('SOMO');
    });

    it('skips campaign without tag', async () => {
      const app = createTestApp('');
      const payload = {
        doc: {
          name: 'CAMP-002',
          campaign_name: 'No Tag Campaign',
        },
      };

      const res = await request(app)
        .post('/webhooks/erpnext/campaign')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('skipped');
      expect(res.body.reason).toBe('no_tag');
    });
  });

  describe('signature validation', () => {
    it('rejects invalid signature when secret is set', async () => {
      const app = createTestApp('my-secret');
      const payload = JSON.stringify({ doc: { name: 'test' } });

      const res = await request(app)
        .post('/webhooks/erpnext/contact')
        .set('Content-Type', 'application/json')
        .set('X-Frappe-Webhook-Signature', 'wrong-signature')
        .send(payload);

      expect(res.status).toBe(403);
    });

    it('rejects missing signature when secret is set', async () => {
      const app = createTestApp('my-secret');

      const res = await request(app)
        .post('/webhooks/erpnext/contact')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ doc: { name: 'test' } }));

      expect(res.status).toBe(403);
    });

    it('accepts valid HMAC-SHA256 signature', async () => {
      const secret = 'my-secret';
      const app = createTestApp(secret);
      const payload = JSON.stringify({
        doc: { name: 'CT-003', mobile_no: '+254700000000' },
      });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const res = await request(app)
        .post('/webhooks/erpnext/contact')
        .set('Content-Type', 'application/json')
        .set('X-Frappe-Webhook-Signature', signature)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
    });
  });
});
