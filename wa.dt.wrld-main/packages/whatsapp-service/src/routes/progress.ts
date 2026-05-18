/**
 * Progress Routes
 *
 * Multi-tenant learning progress API.
 * All endpoints require `tag` parameter to identify the business client.
 */

import { Router, Request, Response } from 'express';
import { progressService } from '../services/learning';
import { ProgressUpdateRequest } from '../types/learning/api';
import { getErrorMessage } from '../types/webhook';

const router = Router();

/**
 * Get module structure for a tag
 * GET /progress/modules?tag=SOMO
 *
 * Returns the module structure from the LMS content collection.
 */
router.get('/modules', async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'tag query parameter is required',
      });
    }

    const result = await progressService.getModuleStructure(tag);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Get module structure error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get all learners for a tag
 * GET /progress/learners?tag=SOMO
 *
 * Returns list of learners with their progress summaries.
 * Useful for admin dashboards.
 */
router.get('/learners', async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'tag query parameter is required',
      });
    }

    const result = await progressService.getLearnersForTag(tag);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Get learners error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get learner progress
 * GET /progress?identifier=254722833440&tag=SOMO&includeModuleStructure=true&includeHistory=true
 *
 * Query parameters:
 * - identifier (required): Phone number or group ID
 * - tag (required): Business client tag (e.g., 'SOMO', 'CompanyX')
 * - includeModuleStructure (optional): Include full module structure from content collection
 * - includeHistory (optional): Include recent interaction history from conversation memory
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { identifier, tag, includeModuleStructure, includeHistory } = req.query;

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'tag query parameter is required',
      });
    }

    const result = await progressService.getProgress({
      chatId: identifier,
      tag,
      includeModuleStructure: includeModuleStructure === 'true',
      includeHistory: includeHistory === 'true',
    });

    const status = result.success ? 200 : result.error?.includes('not found') ? 404 : 400;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Get progress error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Update learner progress
 * POST /progress
 *
 * Body:
 * {
 *   identifier: string;         // Required: Phone number or group ID
 *   tag: string;                // Required: Business client tag
 *   moduleId?: string|number;   // Module to update
 *   sectionCompleted?: string;  // Section to mark as completed
 *   moduleCompleted?: boolean;  // Mark entire module as completed
 *   setCurrentModule?: string|number; // Update current module
 *   metadata?: Record<string, unknown>; // Additional metadata to merge
 *   context?: Record<string, unknown>;  // Additional context to merge
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { identifier, ...updateFields } = req.body as { identifier?: string } & ProgressUpdateRequest;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required in request body',
      });
    }

    if (!updateFields.tag) {
      return res.status(400).json({
        success: false,
        error: 'tag is required in request body',
      });
    }

    const result = await progressService.updateProgress(identifier, updateFields);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error: unknown) {
    console.error('Update progress error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as progressRouter };
