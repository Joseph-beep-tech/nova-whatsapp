/**
 * User Management Routes
 *
 * Provides user registration, tag management, and listing endpoints.
 */

import { Router, Request, Response } from 'express';
import { stateManager } from '../utils/stateManager';
import { WelcomeService } from '../services/welcomeService';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform, toChatId } from '../utils/phoneNumber';

const router = Router();

// Welcome service (injected at setup time)
let welcomeService: WelcomeService | null = null;

/**
 * Initialize user routes with welcome service
 */
export function initUserRoutes(service: WelcomeService): void {
  welcomeService = service;
}

/**
 * Register or update a user with tags
 * POST /users/register
 * Body: { identifier: string, platform?: string, name?: string, pushname?: string, tags?: string[], sessionId?: string }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { identifier, platform, name, pushname, tags, sessionId } = req.body as {
      identifier?: string;
      platform?: string;
      name?: string;
      pushname?: string;
      tags?: string[];
      sessionId?: string;
    };

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required',
      });
    }

    const resolvedPlatform: WhatsAppPlatform = (platform && isValidPlatform(platform))
      ? platform
      : DEFAULT_PLATFORM;

    const result = await stateManager.registerUser(identifier, resolvedPlatform, {
      name,
      pushname,
      tags: tags?.map((t) => t.trim()).filter((t) => t.length > 0),
    });

    // Send welcome messages for newly added tags (if sessionId provided)
    let welcomeResult = null;
    if (result.newTags.length > 0 && sessionId && welcomeService) {
      welcomeResult = await welcomeService.sendWelcomeForNewTags(
        identifier,
        resolvedPlatform,
        result.newTags,
        sessionId
      );
    }

    res.json({
      success: true,
      user: result.user,
      isNew: result.isNew,
      newTags: result.newTags,
      welcomeResult,
    });
  } catch (error: unknown) {
    console.error('User registration error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * List all users or filter by tag
 * GET /users/list
 * Query: ?tag=SOMO (optional)
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const tag = req.query.tag as string | undefined;

    const users = tag ? await stateManager.getUsersByTag(tag) : await stateManager.getUsers();

    res.json({
      success: true,
      users,
      total: users.length,
      ...(tag && { filteredByTag: tag }),
    });
  } catch (error: unknown) {
    console.error('User list error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get all unique tags in the system
 * GET /users/tags
 */
router.get('/tags', async (_req: Request, res: Response) => {
  try {
    const tags = await stateManager.getAllTags();

    res.json({
      success: true,
      tags,
      total: tags.length,
    });
  } catch (error: unknown) {
    console.error('Get tags error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get a single user by identifier
 * GET /users?identifier=254722833440
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const identifier = req.query.identifier as string | undefined;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    const user = await stateManager.getUser(identifier);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    console.error('Get user error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Add tags to a user
 * POST /users/tags
 * Body: { identifier: string, tags: string[] }
 */
router.post('/tags', async (req: Request, res: Response) => {
  try {
    const { identifier, tags } = req.body as { identifier?: string; tags?: string[] };

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required',
      });
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tags array is required and must not be empty',
      });
    }

    const normalizedTags = tags.map((t) => t.trim()).filter((t) => t.length > 0);

    if (normalizedTags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tags array must contain at least one non-empty tag',
      });
    }

    const user = await stateManager.addTags(identifier, normalizedTags);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
      addedTags: normalizedTags,
    });
  } catch (error: unknown) {
    console.error('Add tags error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Remove tags from a user
 * DELETE /users/tags
 * Body: { identifier: string, tags: string[] }
 */
router.delete('/tags', async (req: Request, res: Response) => {
  try {
    const { identifier, tags } = req.body as { identifier?: string; tags?: string[] };

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required',
      });
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tags array is required and must not be empty',
      });
    }

    const normalizedTags = tags.map((t) => t.trim()).filter((t) => t.length > 0);

    if (normalizedTags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tags array must contain at least one non-empty tag',
      });
    }

    const user = await stateManager.removeTags(identifier, normalizedTags);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
      removedTags: normalizedTags,
    });
  } catch (error: unknown) {
    console.error('Remove tags error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as usersRouter };
