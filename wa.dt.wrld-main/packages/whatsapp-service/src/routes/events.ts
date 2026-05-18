/**
 * Event Processing Routes
 *
 * Main event pipeline for processing WhatsApp events from wwebjs-api.
 * Implements the routing logic previously in n8n Router workflow.
 */

import { Router, Request, Response } from 'express';
import { queueConfig } from '../shared/config';
import { eventQueue, QueuedEvent } from '../services/eventQueue';
import { eventRouter } from '../services/eventRouter';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { fromChatId } from '../utils/phoneNumber';
import { extractChatIdFromEvent, extractMessageBody, extractFromMe } from '../utils/eventData';

// Re-export for backward compatibility (other modules may import from here)
export { extractChatIdFromEvent, extractMessageBody, extractFromMe };

const router = Router();

/**
 * Proxy endpoint to forward events from whatsapp-api to registered webhooks
 * POST /events/:sessionId
 * Body: { dataType: string, data: any, sessionId?: string }
 *
 * SessionId can come from:
 * 1. URL param (/events/mysession) - takes precedence
 * 2. Body field (wwebjs-api sends sessionId in body)
 * 3. Default to 'default' if neither provided
 *
 * If ENABLE_EVENT_QUEUE=true, events are queued and processed asynchronously
 * with tag-based routing. Otherwise, uses sync routing via eventRouter which
 * handles tag routing, socket emission, and legacy webhook forwarding.
 */
router.post('/:sessionId?', async (req: Request, res: Response) => {
  try {
    // wwebjs-api sends sessionId in body, but URL param takes precedence if provided
    const sessionId = req.params.sessionId || req.body.sessionId || 'default';
    const { dataType, data } = req.body;

    // Extract chatId from event data for tag lookup
    const chatId = extractChatIdFromEvent(data);

    // If queue is enabled, use async processing with smart routing
    if (queueConfig.enabled && eventQueue.isEnabled()) {
      // Lookup user tags if chatId is available
      let tags: string[] = [];
      if (chatId) {
        const identity = fromChatId(chatId);
        const user = await stateManager.getUser(identity.identifier);
        if (user) {
          tags = user.tags;
        }
      }

      // Enqueue event for async processing
      const queuedEvent: QueuedEvent = {
        sessionId,
        dataType,
        data,
        receivedAt: new Date().toISOString(),
        chatId: chatId || undefined,
        tags,
        priority: tags.includes('VIP') ? 1 : 10, // VIP gets higher priority
      };

      const jobId = await eventQueue.enqueue(queuedEvent);

      return res.json({
        success: true,
        message: 'Event queued for processing',
        jobId,
        mode: 'async',
      });
    }

    // Sync mode: routeEventSync handles tag routing, socket emission,
    // and legacy webhook forwarding (via setLegacyWebhookForwarder).
    // Always called — session lifecycle events (qr, ready, etc.) have no
    // chatId but still need to reach the EventHub for real-time dashboard.
    const result = await eventRouter.routeEventSync(sessionId, dataType, data ?? {});

    res.json({
      success: result.success,
      message: result.results.length > 0
        ? `Event routed to ${result.results.length} target(s)`
        : result.message || 'Event processed',
      mode: result.results.length > 0 ? 'sync_routed' : 'sync',
      durationMs: result.totalDurationMs,
    });
  } catch (error: unknown) {
    console.error('Event forwarding error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as eventsRouter };
