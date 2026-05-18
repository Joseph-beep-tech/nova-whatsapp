/**
 * Webhook Controller
 *
 * Handles n8n webhook actions and webhook registration/unregistration.
 * Used for sending messages and managing webhook subscriptions.
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Tags,
  Security,
  Body,
  Path,
  Response,
  SuccessResponse,
} from 'tsoa';
import { WebhookDispatcher } from '../dispatcher/webhookDispatcher';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import {
  WebhookActionRequest,
  WebhookActionResponse,
  RegisterWebhookRequest,
  RegisterWebhookResponse,
  UnregisterWebhookRequest,
  ListWebhooksResponse,
  BaseResponse,
} from '../types/api';

// Dispatcher (set at initialization time)
let dispatcher: WebhookDispatcher;

/**
 * Initialize webhook controller with dispatcher
 */
export function initWebhookController(webhookDispatcher: WebhookDispatcher): void {
  dispatcher = webhookDispatcher;
}

@Route('webhook')
@Tags('Webhook')
@Security('api_key')
export class WebhookController extends Controller {
  /**
   * Dispatch n8n webhook action
   *
   * Executes a webhook action (e.g., send_message, create_group).
   * This is the main endpoint for n8n to control WhatsApp.
   *
   * @summary Execute n8n webhook action
   * @param body Action to execute
   *
   * @example body {
   *   "action": "send_message",
   *   "data": {
   *     "chatId": "254722833440@c.us",
   *     "content": "Hello from n8n!"
   *   },
   *   "sessionId": "mysession"
   * }
   */
  @Post('')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async dispatchAction(@Body() body: WebhookActionRequest): Promise<WebhookActionResponse> {
    try {
      const { action, data } = body;
      const sessionId = body.sessionId || 'default';

      if (!action) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Action is required',
        };
      }

      const result = await dispatcher.dispatch(sessionId, { action, data: data || {} });
      return result;
    } catch (error: unknown) {
      console.error('Webhook error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Dispatch n8n webhook action (multi-session)
   *
   * Same as the default endpoint but with explicit session ID in path.
   *
   * @summary Execute n8n webhook action for specific session
   * @param sessionId WhatsApp session ID
   * @param body Action to execute
   */
  @Post('session/{sessionId}')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async dispatchActionForSession(
    @Path() sessionId: string,
    @Body() body: WebhookActionRequest
  ): Promise<WebhookActionResponse> {
    try {
      const { action, data } = body;

      if (!action) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Action is required',
        };
      }

      const result = await dispatcher.dispatch(sessionId, { action, data: data || {} });
      return result;
    } catch (error: unknown) {
      console.error(`Webhook error (session ${sessionId}):`, getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Register a webhook
   *
   * Registers a webhook URL to receive events for a session.
   *
   * @summary Register a webhook for session events
   * @param sessionId WhatsApp session ID (default: 'default')
   * @param body Webhook registration data
   *
   * @example body {
   *   "webhookUrl": "https://n8n.example.com/webhook/abc123",
   *   "events": ["message", "qr", "status_change"]
   * }
   */
  @Post('register/{sessionId}')
  @SuccessResponse(200, 'Webhook registered')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async registerWebhook(
    @Path() sessionId: string,
    @Body() body: RegisterWebhookRequest
  ): Promise<RegisterWebhookResponse> {
    try {
      const effectiveSessionId = sessionId || 'default';
      const { webhookUrl, events } = body;

      if (!webhookUrl) {
        this.setStatus(400);
        return {
          success: false,
          error: 'webhookUrl is required',
        };
      }

      const eventList = events || [
        'message',
        'qr',
        'status_change',
        'group_join',
        'group_leave',
      ];
      await stateManager.registerWebhook(effectiveSessionId, webhookUrl, eventList);

      console.log(`Webhook registered for session ${effectiveSessionId}: ${webhookUrl}`);

      return {
        success: true,
        message: 'Webhook registered successfully',
        registration: {
          sessionId: effectiveSessionId,
          webhookUrl,
          events: eventList,
        },
      };
    } catch (error: unknown) {
      console.error('Webhook registration error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Register a webhook (default session)
   *
   * Same as the sessionId variant but uses 'default' session.
   *
   * @summary Register a webhook (default session)
   * @param body Webhook registration data
   */
  @Post('register')
  @SuccessResponse(200, 'Webhook registered')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async registerWebhookDefault(
    @Body() body: RegisterWebhookRequest
  ): Promise<RegisterWebhookResponse> {
    return this.registerWebhook('default', body);
  }

  /**
   * Unregister a webhook
   *
   * Removes a webhook URL from a session.
   *
   * @summary Unregister a webhook
   * @param sessionId WhatsApp session ID
   * @param body Webhook URL to unregister
   */
  @Post('unregister/{sessionId}')
  @SuccessResponse(200, 'Webhook unregistered')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async unregisterWebhook(
    @Path() sessionId: string,
    @Body() body: UnregisterWebhookRequest
  ): Promise<BaseResponse> {
    try {
      const effectiveSessionId = sessionId || 'default';
      const { webhookUrl } = body;

      if (!webhookUrl) {
        this.setStatus(400);
        return {
          success: false,
          error: 'webhookUrl is required',
        };
      }

      await stateManager.unregisterWebhook(effectiveSessionId, webhookUrl);
      console.log(`Webhook unregistered for session ${effectiveSessionId}: ${webhookUrl}`);

      return {
        success: true,
      };
    } catch (error: unknown) {
      console.error('Webhook unregistration error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Unregister a webhook (default session)
   *
   * Same as the sessionId variant but uses 'default' session.
   *
   * @summary Unregister a webhook (default session)
   * @param body Webhook URL to unregister
   */
  @Post('unregister')
  @SuccessResponse(200, 'Webhook unregistered')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async unregisterWebhookDefault(
    @Body() body: UnregisterWebhookRequest
  ): Promise<BaseResponse> {
    return this.unregisterWebhook('default', body);
  }

  /**
   * List registered webhooks
   *
   * Returns all webhooks registered for a session.
   *
   * @summary List registered webhooks
   * @param sessionId WhatsApp session ID
   */
  @Get('list/{sessionId}')
  @Response<BaseResponse>(500, 'Internal server error')
  public async listWebhooks(@Path() sessionId: string): Promise<ListWebhooksResponse> {
    try {
      const effectiveSessionId = sessionId || 'default';
      const webhooks = await stateManager.getWebhooks(effectiveSessionId);

      return {
        success: true,
        sessionId: effectiveSessionId,
        webhooks: webhooks.map((w) => ({
          url: w.url,
          events: w.events,
          registeredAt: w.registeredAt,
        })),
      };
    } catch (error: unknown) {
      console.error('Webhook list error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * List registered webhooks (default session)
   *
   * Same as the sessionId variant but uses 'default' session.
   *
   * @summary List registered webhooks (default session)
   */
  @Get('list')
  @Response<BaseResponse>(500, 'Internal server error')
  public async listWebhooksDefault(): Promise<ListWebhooksResponse> {
    return this.listWebhooks('default');
  }
}

// Alias for multi-session webhook endpoint
@Route('session')
@Tags('Webhook')
@Security('api_key')
export class SessionWebhookController extends Controller {
  /**
   * Dispatch n8n webhook action (session-prefixed path)
   *
   * Alternative path for multi-session webhook dispatch.
   *
   * @summary Execute n8n webhook action via session path
   * @param sessionId WhatsApp session ID
   * @param body Action to execute
   */
  @Post('{sessionId}/webhook')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async dispatchAction(
    @Path() sessionId: string,
    @Body() body: WebhookActionRequest
  ): Promise<WebhookActionResponse> {
    try {
      const { action, data } = body;

      if (!action) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Action is required',
        };
      }

      const result = await dispatcher.dispatch(sessionId, { action, data: data || {} });
      return result;
    } catch (error: unknown) {
      console.error(`Webhook error (session ${sessionId}):`, getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
