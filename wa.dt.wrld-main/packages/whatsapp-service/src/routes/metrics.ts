/**
 * Metrics Routes
 *
 * Exposes deduplication and other service metrics for monitoring.
 */

import { Router, Request, Response } from 'express';
import { deduplicationConfig } from '../shared/config';
import { deduplicationService } from '../services/deduplicationService';
import { getErrorMessage } from '../types/webhook';

const router = Router();

/**
 * Get deduplication metrics
 * GET /metrics/deduplication
 *
 * Returns statistics about event deduplication:
 * - Total events processed
 * - Duplicates detected
 * - Duplicate rate percentage
 * - Breakdown by event type
 * - Service uptime
 * - Redis connection status
 */
router.get('/deduplication', async (_req: Request, res: Response) => {
  try {
    if (!deduplicationConfig.enabled) {
      return res.json({
        success: true,
        enabled: false,
        message: 'Deduplication service is disabled',
      });
    }

    const metrics = await deduplicationService.getMetrics();

    res.json({
      success: true,
      enabled: true,
      metrics,
    });
  } catch (error: unknown) {
    console.error('Error getting deduplication metrics:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as metricsRouter };
