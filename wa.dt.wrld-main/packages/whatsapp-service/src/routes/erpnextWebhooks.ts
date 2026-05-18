/**
 * ERPNext Webhook Receiver
 *
 * Handles incoming webhooks from ERPNext for Contact and Campaign updates.
 * Validates the X-Frappe-Webhook-Signature header using HMAC-SHA256.
 *
 * Frappe sends a base64-encoded HMAC-SHA256 hash. We also accept hex-encoded
 * signatures for dev/test convenience.
 *
 * Routes:
 * - POST /service/webhooks/erpnext/contact  — Contact on_update
 * - POST /service/webhooks/erpnext/campaign — Campaign on_update
 * - GET  /service/webhooks/erpnext/health   — Health check
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { erpnextConfig } from '../shared/config';
import {
  FrappeWebhookPayload,
  FrappeContactDoc,
  FrappeCampaignDoc,
} from '../types/erpnext';

const router = Router();

// ---------------------------------------------------------------------------
// HMAC-SHA256 validation
// ---------------------------------------------------------------------------

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!erpnextConfig.webhookSecret) {
    return true; // dev mode — no secret configured
  }
  if (!signature) {
    return false;
  }
  const mac = crypto
    .createHmac('sha256', erpnextConfig.webhookSecret)
    .update(rawBody);

  // Frappe sends base64-encoded signature in X-Frappe-Webhook-Signature
  const expectedB64 = mac.digest('base64');

  // Check base64 first (Frappe's native format)
  try {
    if (crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(signature))) {
      return true;
    }
  } catch {
    // length mismatch — try hex format
  }

  // Also accept hex for dev/test convenience
  const expectedHex = crypto
    .createHmac('sha256', erpnextConfig.webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(signature));
  } catch {
    return false; // length mismatch
  }
}

// ---------------------------------------------------------------------------
// Raw body capture middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware to capture raw body for HMAC validation.
 * Must run BEFORE json() body parser.
 */
function captureRawBody(req: Request, _res: Response, next: () => void): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    // Parse JSON manually since we consumed the stream
    try {
      req.body = JSON.parse((req as Request & { rawBody: Buffer }).rawBody.toString());
    } catch {
      req.body = {};
    }
    next();
  });
}

// Apply raw body capture to all routes in this router
router.use(captureRawBody);

// ---------------------------------------------------------------------------
// Signature validation middleware
// ---------------------------------------------------------------------------

function validateSignature(req: Request, res: Response, next: () => void): void {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody || Buffer.from('');
  const signature = (req.headers['x-frappe-webhook-signature'] || req.headers['x-frappe-webhook-secret']) as string | undefined;

  if (!verifySignature(rawBody, signature)) {
    res.status(403).json({ error: 'Invalid webhook signature' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Contact webhook
// ---------------------------------------------------------------------------

router.post('/contact', validateSignature, (req: Request, res: Response): void => {
  try {
    const payload = req.body as FrappeWebhookPayload<FrappeContactDoc>;
    const doc = payload.doc || req.body;
    const phone = doc.mobile_no || doc.phone;
    const erpName = doc.name;

    if (!phone) {
      console.warn('[ERPNext Webhook] Contact missing phone:', erpName);
      res.json({ status: 'skipped', reason: 'no_phone' });
      return;
    }

    console.log(`[ERPNext Webhook] Contact updated: ${erpName} (phone=${phone})`);

    // TODO: E3-S4 — Update stateManager user with ERPNext data
    // e.g., stateManager.updateUserMetadata(phone, { erpContactName: erpName })

    res.json({ status: 'received', phone, erp_name: erpName });
  } catch (error: unknown) {
    console.error('[ERPNext Webhook] Contact error:', error);
    res.status(500).json({ status: 'error' });
  }
});

// ---------------------------------------------------------------------------
// Campaign webhook
// ---------------------------------------------------------------------------

router.post('/campaign', validateSignature, (req: Request, res: Response): void => {
  try {
    const payload = req.body as FrappeWebhookPayload<FrappeCampaignDoc>;
    const doc = payload.doc || req.body;
    const tag = doc.custom_wa_tag;
    const erpName = doc.name;

    if (!tag) {
      console.warn('[ERPNext Webhook] Campaign missing custom_wa_tag:', erpName);
      res.json({ status: 'skipped', reason: 'no_tag' });
      return;
    }

    console.log(`[ERPNext Webhook] Campaign updated: ${erpName} (tag=${tag})`);

    // TODO: E3-S4 — Update eventRouter tag configuration from Campaign data
    // e.g., eventRouter.setTagConfiguration(tag, { ... })

    res.json({ status: 'received', tag, erp_name: erpName });
  } catch (error: unknown) {
    console.error('[ERPNext Webhook] Campaign error:', error);
    res.status(500).json({ status: 'error' });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

router.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    enabled: erpnextConfig.enabled,
    secret_configured: Boolean(erpnextConfig.webhookSecret),
  });
});

export default router;
