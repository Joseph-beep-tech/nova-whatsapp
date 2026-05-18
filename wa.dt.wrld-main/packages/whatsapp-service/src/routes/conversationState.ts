/**
 * Conversation State Routes
 *
 * Provides endpoints for managing conversation state including handoff status,
 * agent assignments, and automation control.
 */

import { Router, Request, Response } from 'express';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';

const router = Router();

/**
 * Validate sessionId format (must be non-empty string)
 */
function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

/**
 * Get conversation state for a chat and session
 * GET /conversation-state/:sessionId?identifier=254722833440
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const identifier = req.query.identifier as string | undefined;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sessionId (must be non-empty string)',
      });
    }

    const state = await stateManager.getConversationState(identifier, sessionId);

    if (!state) {
      return res.status(404).json({
        success: false,
        error: 'Conversation state not found',
      });
    }

    res.json({
      success: true,
      state,
    });
  } catch (error: unknown) {
    console.error('Get conversation state error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Set or update conversation state
 * POST /conversation-state/:sessionId
 * Body: { identifier: string, platform?: string, handoffStatus?, assignedAgent?, lastAgentActivity?, automationPaused?, metadata? }
 */
router.post('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const {
      identifier,
      platform: platformParam,
      handoffStatus,
      assignedAgent,
      lastAgentActivity,
      automationPaused,
      metadata,
    } = req.body as {
      identifier?: string;
      platform?: string;
      handoffStatus?: 'automated' | 'requested' | 'active' | 'resolved';
      assignedAgent?: string;
      lastAgentActivity?: string;
      automationPaused?: boolean;
      metadata?: Record<string, unknown>;
    };

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required in request body',
      });
    }

    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sessionId (must be non-empty string)',
      });
    }

    // Validate handoffStatus if provided
    if (handoffStatus && !['automated', 'requested', 'active', 'resolved'].includes(handoffStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid handoffStatus (must be one of: automated, requested, active, resolved)',
      });
    }

    const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
      ? platformParam
      : DEFAULT_PLATFORM;

    // Build update object with only provided fields
    const stateUpdate: {
      handoffStatus?: 'automated' | 'requested' | 'active' | 'resolved';
      assignedAgent?: string;
      lastAgentActivity?: Date;
      automationPaused?: boolean;
      metadata?: Record<string, unknown>;
    } = {};

    if (handoffStatus !== undefined) {
      stateUpdate.handoffStatus = handoffStatus;
    }
    if (assignedAgent !== undefined) {
      stateUpdate.assignedAgent = assignedAgent;
    }
    if (lastAgentActivity !== undefined) {
      stateUpdate.lastAgentActivity = new Date(lastAgentActivity);
    }
    if (automationPaused !== undefined) {
      stateUpdate.automationPaused = automationPaused;
    }
    if (metadata !== undefined) {
      stateUpdate.metadata = metadata;
    }

    // Ensure at least one field is being updated
    if (Object.keys(stateUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided for update',
      });
    }

    const state = await stateManager.setConversationState(identifier, platform, sessionId, stateUpdate);

    res.json({
      success: true,
      state,
    });
  } catch (error: unknown) {
    console.error('Set conversation state error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export default router;
