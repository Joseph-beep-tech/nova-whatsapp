/**
 * Webhook Routes
 *
 * Handles n8n webhook actions and webhook registration/unregistration.
 */

import { Router, Request, Response } from 'express';
import { WebhookDispatcher } from '../dispatcher/webhookDispatcher';
import { stateManager } from '../utils/stateManager';

const router = Router();

let dispatcher: WebhookDispatcher;

/**
 * Initialize webhook routes with dispatcher
 */
export function initWebhookRoutes(webhookDispatcher: WebhookDispatcher): void {
  dispatcher = webhookDispatcher;
}

/**
 * Webhook endpoint for n8n actions (single session, backward compatibility)
 * POST /webhook
 * Body: { action: string, data: any }
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { action, data } = req.body;
    const sessionId = req.body.sessionId || 'default';

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required',
      });
    }

    const result = await dispatcher.dispatch(sessionId, { action, data });
    res.json(result);
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Webhook endpoint for n8n actions (multi-session)
 * POST /session/:sessionId/webhook
 * Body: { action: string, data: any }
 */
router.post('/session/:sessionId/webhook', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required',
      });
    }

    const result = await dispatcher.dispatch(sessionId, { action, data });
    res.json(result);
  } catch (error: any) {
    console.error(`Webhook error (session ${req.params.sessionId}):`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Register a webhook for session events
 * POST /webhook/register/:sessionId
 * Body: { webhookUrl: string, events: string[] }
 */
router.post('/webhook/register/:sessionId?', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId || 'default';
    const { webhookUrl, events } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'webhookUrl is required',
      });
    }

    const eventList = events || ['message', 'qr', 'status_change', 'group_join', 'group_leave'];
    await stateManager.registerWebhook(sessionId, webhookUrl, eventList);

    console.log(`Webhook registered for session ${sessionId}: ${webhookUrl}`);

    res.json({
      success: true,
      message: 'Webhook registered successfully',
      registration: {
        sessionId,
        webhookUrl,
        events: eventList,
      },
    });
  } catch (error: any) {
    console.error('Webhook registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Unregister a webhook
 * POST /webhook/unregister/:sessionId
 * Body: { webhookUrl: string }
 */
router.post('/webhook/unregister/:sessionId?', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId || 'default';
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'webhookUrl is required',
      });
    }

    await stateManager.unregisterWebhook(sessionId, webhookUrl);
    console.log(`Webhook unregistered for session ${sessionId}: ${webhookUrl}`);

    res.json({
      success: true,
      message: 'Webhook unregistered successfully',
    });
  } catch (error: any) {
    console.error('Webhook unregistration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * List registered webhooks for a session
 * GET /webhook/list/:sessionId
 */
router.get('/webhook/list/:sessionId?', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId || 'default';
    const webhooks = await stateManager.getWebhooks(sessionId);

    res.json({
      success: true,
      sessionId,
      webhooks: webhooks.map(w => ({
        url: w.url,
        events: w.events,
        registeredAt: w.registeredAt,
      })),
    });
  } catch (error: any) {
    console.error('Webhook list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export { router as webhookRouter };
