/**
 * Welcome Message Routes
 *
 * Handles welcome message configuration for tags.
 */

import { Router, Request, Response } from 'express';
import { WelcomeService, WelcomeMessageItem } from '../services/welcomeService';
import { getErrorMessage } from '../types/webhook';

const router = Router();

let welcomeService: WelcomeService;

/**
 * Initialize welcome routes with service
 */
export function initWelcomeRoutes(service: WelcomeService): void {
  welcomeService = service;
}

/**
 * List all configured welcome messages
 * GET /welcome-messages
 */
router.get('/welcome-messages', async (_req: Request, res: Response) => {
  try {
    const messages = await welcomeService.listWelcomeMessages();

    res.json({
      success: true,
      welcomeMessages: messages,
    });
  } catch (error: unknown) {
    console.error('Error listing welcome messages:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Configure welcome messages for a tag
 * POST /welcome-messages/:tag
 * Body: { messages: WelcomeMessageItem[], enabled?: boolean }
 *
 * Each message in the array mirrors wwebjs-api sendMessage schema:
 * { contentType: 'string' | 'MessageMedia' | 'MessageMediaFromURL' | 'Location' | etc.,
 *   content: string | MediaContent | LocationContent | etc.,
 *   options?: { caption?: string, ... } }
 */
router.post('/welcome-messages/:tag', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const { messages, enabled = true } = req.body as {
      messages: WelcomeMessageItem[];
      enabled?: boolean;
    };

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required and must not be empty',
      });
    }

    // Validate each message has required fields
    for (const msg of messages) {
      if (!msg.contentType || msg.content === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Each message must have contentType and content fields',
        });
      }
    }

    await welcomeService.setWelcomeMessage(tag, messages, enabled);

    res.json({
      success: true,
      tag,
      messages,
      enabled,
    });
  } catch (error: unknown) {
    console.error('Error setting welcome messages:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Disable welcome message for a tag
 * DELETE /welcome-messages/:tag
 */
router.delete('/welcome-messages/:tag', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    await welcomeService.disableWelcomeMessage(tag);

    res.json({
      success: true,
      tag,
      enabled: false,
    });
  } catch (error: unknown) {
    console.error('Error disabling welcome message:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as welcomeRouter };
