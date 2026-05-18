/**
 * Health Check Routes
 *
 * Provides health, readiness, and session status endpoints.
 */

import { Router, Request, Response } from 'express';
import { config } from '../shared/config';

const router = Router();

// Configuration (injected at setup time)
let WHATSAPP_API_URL: string;
let API_KEY: string;

/**
 * Initialize health routes with configuration
 */
export function initHealthRoutes(whatsappApiUrl: string, apiKey: string): void {
  WHATSAPP_API_URL = whatsappApiUrl;
  API_KEY = apiKey;
}

/**
 * Health check endpoint
 * GET /health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-service',
    mode: 'thin-wrapper',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Ping endpoint
 * GET /ping
 */
router.get('/ping', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'pong',
  });
});

/**
 * Readiness check - verifies upstream services are reachable
 * GET /health/ready
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  const timeout = config.healthCheckTimeout;
  const results: {
    service: string;
    timestamp: string;
    wwebjs: boolean;
    n8n: boolean | null;
  } = {
    service: 'whatsapp-service',
    timestamp: new Date().toISOString(),
    wwebjs: false,
    n8n: null,
  };

  // Check wwebjs-api
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${WHATSAPP_API_URL}/session/getSessions`, {
      headers: { 'x-api-key': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    results.wwebjs = response.ok;
  } catch {
    results.wwebjs = false;
  }

  // Check n8n (optional)
  if (config.n8nUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${config.n8nUrl}/healthz`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      results.n8n = response.ok;
    } catch {
      results.n8n = false;
    }
  }

  const allHealthy = results.wwebjs && (results.n8n === null || results.n8n);
  res.status(allHealthy ? 200 : 503).json(results);
});

/**
 * Session status aggregation - lists all sessions with their connection status
 * GET /health/sessions
 * Auth: API key via header (x-api-key) or query string (?apiKey=XXX)
 */
router.get('/health/sessions', async (req: Request, res: Response) => {
  // Verify API key (from query string or header)
  const providedKey = (req.query.apiKey as string) || req.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing API key',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Get all sessions from wwebjs-api
    const sessionsResponse = await fetch(`${WHATSAPP_API_URL}/session/getSessions`, {
      headers: { 'x-api-key': API_KEY },
    });

    if (!sessionsResponse.ok) {
      throw new Error('Failed to fetch sessions');
    }

    const sessionsData = (await sessionsResponse.json()) as { data?: string[] };
    const sessionIds = sessionsData.data || [];

    // Get status for each session
    const sessionStatuses = await Promise.all(
      sessionIds.map(async (sessionId: string) => {
        try {
          const statusResponse = await fetch(`${WHATSAPP_API_URL}/session/status/${sessionId}`, {
            headers: { 'x-api-key': API_KEY },
          });
          const statusData = (await statusResponse.json()) as { data?: { state?: string } };
          const state = statusData.data?.state || 'unknown';
          return {
            sessionId,
            status: state,
            authenticated: state === 'CONNECTED',
          };
        } catch {
          return { sessionId, status: 'error', authenticated: false };
        }
      })
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sessions: sessionStatuses,
      total: sessionStatuses.length,
      connected: sessionStatuses.filter((s) => s.authenticated).length,
    });
  } catch {
    res.status(503).json({
      success: false,
      error: 'Failed to fetch session status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Single session status - proxies to wwebjs-api for dashboard compatibility
 * GET /session/status/:sessionId
 *
 * Returns: { success: boolean, data: SessionStatus }
 * SessionStatus: { state: string, authenticated: boolean, sessionId: string, phoneNumber?: string }
 */
router.get('/session/status/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const timeout = config.healthCheckTimeout;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const statusResponse = await fetch(`${WHATSAPP_API_URL}/session/status/${sessionId}`, {
      headers: { 'x-api-key': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!statusResponse.ok) {
      // Session doesn't exist or API error
      return res.json({
        success: true,
        data: {
          sessionId,
          state: 'DISCONNECTED',
          authenticated: false,
        },
      });
    }

    const statusData = (await statusResponse.json()) as { data?: { state?: string } };
    const state = statusData.data?.state || 'DISCONNECTED';

    res.json({
      success: true,
      data: {
        sessionId,
        state,
        authenticated: state === 'CONNECTED',
      },
    });
  } catch {
    // WhatsApp API unreachable or timeout
    res.json({
      success: true,
      data: {
        sessionId,
        state: 'DISCONNECTED',
        authenticated: false,
        error: 'WhatsApp API unreachable',
      },
    });
  }
});

/**
 * QR Code image proxy - proxies to wwebjs-api for dashboard compatibility
 * GET /session/qr/:sessionId/image
 */
router.get('/session/qr/:sessionId/image', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const timeout = config.healthCheckTimeout;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const qrResponse = await fetch(`${WHATSAPP_API_URL}/session/qr/${sessionId}/image`, {
      headers: { 'x-api-key': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!qrResponse.ok) {
      return res.status(qrResponse.status).json({
        success: false,
        error: 'QR code not available',
      });
    }

    // Proxy the image response
    const contentType = qrResponse.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    const buffer = await qrResponse.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(503).json({
      success: false,
      error: 'WhatsApp API unreachable',
    });
  }
});

export { router as healthRouter };
