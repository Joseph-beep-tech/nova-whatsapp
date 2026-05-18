/**
 * Chats Routes
 *
 * Provides conversation management endpoints for agent takeover (HITL).
 * Allows agents to claim/release conversations and retrieve context.
 */

import { Router, Request, Response } from 'express';
import { ChatsController } from '../controllers/ChatsController';
import { getErrorMessage } from '../types/webhook';
import type { ClaimChatRequest } from '../types/api';

const router = Router();

/**
 * Claim a conversation for an agent
 * POST /chats/claim
 * Body: { identifier: string, platform?: string, agentId: string }
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const body = req.body as ClaimChatRequest;

    const controller = new ChatsController();
    const result = await controller.claimChat(body);

    const status = controller.getStatus() || 200;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Chat claim error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Release a conversation back to automation
 * POST /chats/release
 * Body: { identifier: string }
 */
router.post('/release', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body as { identifier?: string };

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required',
      });
    }

    const controller = new ChatsController();
    const result = await controller.releaseChat({ identifier });

    const status = controller.getStatus() || 200;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Chat release error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get conversation context
 * GET /chats/context?identifier=254722833440&limit=20
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const identifier = req.query.identifier as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    const controller = new ChatsController();
    const result = await controller.getContext(identifier, limit);

    const status = controller.getStatus() || 200;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Get context error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export const chatsRouter = router;
