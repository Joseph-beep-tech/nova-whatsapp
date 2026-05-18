/**
 * Queue Status Routes
 *
 * Handles queue statistics and failed job retrieval.
 */

import { Router, Request, Response } from 'express';
import { queueConfig } from '../shared/config';
import { eventQueue } from '../services/eventQueue';
import { getErrorMessage } from '../types/webhook';

const router = Router();

/**
 * Get queue statistics
 * GET /queue/stats
 */
router.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    if (!queueConfig.enabled) {
      return res.json({
        success: true,
        enabled: false,
        message: 'Event queue is disabled',
      });
    }

    const stats = await eventQueue.getStats();

    res.json({
      success: true,
      enabled: true,
      stats,
    });
  } catch (error: unknown) {
    console.error('Error getting queue stats:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get recent failed jobs
 * GET /queue/failed
 */
router.get('/queue/failed', async (req: Request, res: Response) => {
  try {
    if (!queueConfig.enabled) {
      return res.json({
        success: true,
        enabled: false,
        jobs: [],
      });
    }

    const count = parseInt(req.query.count as string) || 10;
    const jobs = await eventQueue.getFailedJobs(count);

    res.json({
      success: true,
      enabled: true,
      jobs,
    });
  } catch (error: unknown) {
    console.error('Error getting failed jobs:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as queueRouter };
