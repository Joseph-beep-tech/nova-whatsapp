/**
 * Tag Configuration Routes
 *
 * Handles tag configuration for smart routing.
 */

import { Router, Request, Response } from 'express';
import { eventRouter } from '../services/eventRouter';
import { messageRouter } from '../handlers/messageRouter';
import { stateManager } from '../utils/stateManager';
import { SetTagConfigRequest } from '../types/routing';
import { getErrorMessage } from '../types/webhook';

const router = Router();

/**
 * Get all tag configurations
 * GET /tags/configs
 */
router.get('/tags/configs', async (_req: Request, res: Response) => {
  try {
    const configs = await eventRouter.getAllTagConfigurations();

    res.json({
      success: true,
      configs,
      total: configs.length,
    });
  } catch (error: unknown) {
    console.error('Error getting tag configs:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get tag configuration
 * GET /tags/:tag/config
 */
router.get('/tags/:tag/config', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    const configs = await eventRouter.getTagConfigurations([tag.toUpperCase()]);
    const config = configs[0];

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `No configuration found for tag: ${tag}`,
      });
    }

    res.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    console.error('Error getting tag config:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Set tag configuration
 * POST /tags/:tag/config
 * Body: SetTagConfigRequest
 */
router.post('/tags/:tag/config', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const configData = req.body as SetTagConfigRequest;

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    // Validate routing target if provided
    if (configData.routing?.target) {
      const target = configData.routing.target;
      if (!target.type) {
        return res.status(400).json({
          success: false,
          error: 'Routing target must have a type',
        });
      }

      const validTypes = ['n8n_webhook', 'qdrant_rag', 'local_handler', 'passthrough'];
      if (!validTypes.includes(target.type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid routing target type. Must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    const savedConfig = await eventRouter.setTagConfiguration(tag.toUpperCase(), {
      enabled: configData.enabled ?? true,
      displayName: configData.displayName,
      welcomeMessage: configData.welcomeMessage,
      routing: configData.routing,
      memory: configData.memory,
      lms: configData.lms,
      kb: configData.kb,
    });

    res.json({
      success: true,
      config: savedConfig,
    });
  } catch (error: unknown) {
    console.error('Error setting tag config:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Delete tag configuration
 * DELETE /tags/:tag/config
 */
router.delete('/tags/:tag/config', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    const deleted = await eventRouter.deleteTagConfiguration(tag.toUpperCase());

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `No configuration found for tag: ${tag}`,
      });
    }

    res.json({
      success: true,
      tag: tag.toUpperCase(),
      deleted: true,
    });
  } catch (error: unknown) {
    console.error('Error deleting tag config:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get all keyword patterns (Group Keyword Filtering)
 * GET /tags/keywords
 */
router.get('/tags/keywords', async (_req: Request, res: Response) => {
  try {
    const config = messageRouter.getConfig();
    const patterns = Array.from(config.tagPatterns.entries()).map(([tag, regex]) => ({
      tag,
      pattern: regex.source,
      flags: regex.flags
    }));

    res.json({
      success: true,
      patterns,
    });
  } catch (error: unknown) {
    console.error('Error getting keyword patterns:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Set all keyword patterns
 * POST /tags/keywords
 * Body: { patterns: { tag: string, pattern: string, flags?: string }[] }
 */
router.post('/tags/keywords', async (req: Request, res: Response) => {
  try {
    const { patterns } = req.body as { patterns?: { tag: string; pattern: string; flags?: string }[] };

    if (!patterns || !Array.isArray(patterns)) {
      return res.status(400).json({
        success: false,
        error: 'patterns array is required',
      });
    }

    // Persist to stateManager
    await stateManager.setConfig('tag_patterns_config', { patterns });

    // Update messageRouter in memory
    const newMap = new Map<string, RegExp>();
    for (const p of patterns) {
      if (!p.tag || !p.pattern) continue;
      newMap.set(p.tag, new RegExp(p.pattern, p.flags || 'i'));
    }

    const config = messageRouter.getConfig();
    config.tagPatterns = newMap;
    // HACK: the real messageRouter class does not have a public setter for tagPatterns
    // but the `detectTags` method uses `this.config.tagPatterns`.
    // We can just add/remove one by one

    // Clear existing
    for (const [tag] of messageRouter.getConfig().tagPatterns) {
      messageRouter.removeTagPattern(tag);
    }
    // Add new ones
    for (const [tag, regex] of newMap) {
      messageRouter.addTagPattern(tag, regex);
    }

    res.json({
      success: true,
      patterns,
    });
  } catch (error: unknown) {
    console.error('Error setting keyword patterns:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as tagsRouter };
