/**
 * Events Controller
 *
 * Main event processing pipeline for WhatsApp events from wwebjs-api.
 * Implements tag-based routing and legacy webhook forwarding.
 */

import {
  Controller,
  Post,
  Route,
  Tags,
  Security,
  Body,
  Path,
  Response,
} from 'tsoa';
import { queueConfig } from '../shared/config';
import { eventQueue, QueuedEvent } from '../services/eventQueue';
import { eventRouter } from '../services/eventRouter';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { fromChatId } from '../utils/phoneNumber';
import { EventRequest, EventResponse, BaseResponse } from '../types/api';

/**
 * Extract chatId from event data
 * Tries common locations where chatId might be found in WhatsApp events
 */
function extractChatIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  // Handle undefined/null data (e.g., authenticated event has no data)
  if (!data) {
    return null;
  }

  const candidates = [
    data.from,
    data.chatId,
    (data.message as Record<string, unknown>)?.from,
    (data.msg as Record<string, unknown>)?.from,
    (data.data as Record<string, unknown>)?.from,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes('@')) {
      return candidate;
    }
  }

  return null;
}

@Route('events')
@Tags('Events')
@Security('api_key')
export class EventsController extends Controller {
  /**
   * Process WhatsApp event
   *
   * Main event receiver from wwebjs-api. Processes events through
   * the tag-based routing system or legacy webhook forwarding.
   *
   * If ENABLE_EVENT_QUEUE=true, events are queued for async processing.
   * Otherwise, events are processed synchronously.
   *
   * @summary Process WhatsApp event from wwebjs-api
   * @param sessionId WhatsApp session ID (optional, can also be in body)
   * @param body Event data from wwebjs-api
   *
   * @example body {
   *   "dataType": "message_create",
   *   "data": {
   *     "from": "254722833440@c.us",
   *     "body": "Hello bot!",
   *     "fromMe": false
   *   },
   *   "sessionId": "mysession"
   * }
   */
  @Post('{sessionId}')
  @Response<BaseResponse>(500, 'Internal server error')
  public async processEvent(
    @Path() sessionId: string,
    @Body() body: EventRequest
  ): Promise<EventResponse> {
    try {
      // wwebjs-api sends sessionId in body, but URL param takes precedence if provided
      const effectiveSessionId = sessionId || body.sessionId || 'default';
      const { dataType, data } = body;

      // Extract chatId from event data for tag lookup
      const chatId = extractChatIdFromEvent(data);

      // If queue is enabled, use async processing with smart routing
      if (queueConfig.enabled && eventQueue.isEnabled()) {
        // Lookup user tags if chatId is available
        let tags: string[] = [];
        if (chatId) {
          const { identifier } = fromChatId(chatId);
          const user = await stateManager.getUser(identifier);
          if (user) {
            tags = user.tags;
          }
        }

        // Enqueue event for async processing
        const queuedEvent: QueuedEvent = {
          sessionId: effectiveSessionId,
          dataType,
          data: data || {},
          receivedAt: new Date().toISOString(),
          chatId: chatId || undefined,
          tags,
          priority: tags.includes('VIP') ? 1 : 10, // VIP gets higher priority
        };

        const jobId = await eventQueue.enqueue(queuedEvent);

        return {
          success: true,
          message: 'Event queued for processing',
          jobId,
          mode: 'async',
        };
      }

      // Sync mode: Use event router for tag-based routing
      if (chatId) {
        const result = await eventRouter.routeEventSync(
          effectiveSessionId,
          dataType,
          data || {}
        );

        // If any tag routing was configured, we're done
        if (result.results.length > 0) {
          return {
            success: result.success,
            message: `Event routed to ${result.results.length} target(s)`,
            mode: 'sync_routed',
            durationMs: result.totalDurationMs,
          };
        }
      }

      // Fallback: Legacy webhook forwarding (no tag routing configured)
      const webhooks = await stateManager.getWebhooks(effectiveSessionId);
      const targetWebhooks = webhooks.filter((w) => w.events.includes(dataType));

      const axios = require('axios');
      const promises = targetWebhooks.map((webhook) =>
        axios
          .post(webhook.url, {
            dataType,
            data,
            sessionId: effectiveSessionId,
          })
          .catch((error: unknown) => {
            console.error(`Failed to forward event to ${webhook.url}:`, getErrorMessage(error));
          })
      );

      await Promise.allSettled(promises);

      return {
        success: true,
        message: `Event forwarded to ${targetWebhooks.length} webhook(s)`,
        mode: 'legacy',
      };
    } catch (error: unknown) {
      console.error('Event processing error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Process WhatsApp event (default session)
   *
   * Same as the sessionId variant but uses 'default' session.
   *
   * @summary Process WhatsApp event (default session)
   * @param body Event data from wwebjs-api
   */
  @Post('')
  @Response<BaseResponse>(500, 'Internal server error')
  public async processEventDefault(@Body() body: EventRequest): Promise<EventResponse> {
    return this.processEvent(body.sessionId || 'default', body);
  }
}
