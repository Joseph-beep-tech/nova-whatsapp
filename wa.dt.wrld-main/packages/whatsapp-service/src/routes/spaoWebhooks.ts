/**
 * SPAO Voice AI Webhook Receiver
 *
 * Receives lifecycle events from SPAO voice sessions:
 * - voice.call.started — Call initiated
 * - voice.call.ended — Call completed (with summary)
 * - voice.transcript.summary — Post-call summary generated
 * - voice.module.completed — Learning module completed
 * - voice.mcp.tool_call — MCP tool invoked during call
 * - voice.transcript.chunk — Real-time transcript segment
 *
 * Auth: API key in x-api-key header (same key as other service endpoints).
 *
 * Route: POST /service/webhooks/spao
 */

import { Router, Request, Response } from 'express';
import { config, spaoConfig } from '../shared/config';
import { SpaoEvent, SpaoEventType } from '../types/spao';
import { getErrorMessage } from '../types/webhook';
import { spaoEventHandler } from '../services/spaoEventHandler';

const router = Router();

// ---------------------------------------------------------------------------
// API key validation middleware
// ---------------------------------------------------------------------------

function validateApiKey(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Event validation
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES: SpaoEventType[] = [
  'voice.call.started',
  'voice.call.ended',
  'voice.transcript.summary',
  'voice.module.completed',
  'voice.mcp.tool_call',
  'voice.transcript.chunk',
];

function isValidSpaoEvent(body: unknown): body is SpaoEvent {
  if (!body || typeof body !== 'object') return false;
  const event = body as Record<string, unknown>;

  return (
    typeof event.event_type === 'string' &&
    VALID_EVENT_TYPES.includes(event.event_type as SpaoEventType) &&
    typeof event.event_id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.phone === 'string' &&
    typeof event.data === 'object' &&
    event.data !== null
  );
}

// ---------------------------------------------------------------------------
// Main event receiver
// ---------------------------------------------------------------------------

router.post('/', validateApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    if (!isValidSpaoEvent(body)) {
      res.status(400).json({
        error: 'Invalid SPAO event',
        required: ['event_type', 'event_id', 'timestamp', 'phone', 'data'],
        valid_types: VALID_EVENT_TYPES,
      });
      return;
    }

    const event: SpaoEvent = body;

    console.log(`[SPAO Webhook] Received ${event.event_type} for ${event.phone} (call_sid=${event.call_sid || 'none'})`);

    // Process asynchronously — respond immediately to SPAO
    spaoEventHandler.processEvent(event).catch((error: unknown) => {
      console.error(`[SPAO Webhook] Error processing ${event.event_type}:`, getErrorMessage(error));
    });

    res.json({
      status: 'accepted',
      event_id: event.event_id,
      event_type: event.event_type,
    });
  } catch (error: unknown) {
    console.error('[SPAO Webhook] Request error:', getErrorMessage(error));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

router.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    enabled: spaoConfig.enabled,
    api_url: spaoConfig.apiUrl ? '***configured***' : 'not_configured',
  });
});

export default router;
