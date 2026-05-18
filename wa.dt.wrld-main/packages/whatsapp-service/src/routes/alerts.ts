/**
 * Alerts Routes
 *
 * Handles operator alert management including creation, retrieval, acknowledgment, and deletion.
 */

import { Router, Request, Response } from 'express';
import { alertService } from '../services/alertService';
import { getErrorMessage } from '../types/webhook';
import { CreateAlertRequest, ListAlertsQuery } from '../types/alert';

const router = Router();

/**
 * Get alert statistics
 * GET /alerts/stats
 */
router.get('/alerts/stats', async (_req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.json({
        success: true,
        enabled: false,
        message: 'Alert service is disabled',
      });
    }

    const stats = await alertService.getStats();
    res.json(stats);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * List alerts with optional filtering
 * GET /alerts
 * Query params: ?severity=critical&type=session_disconnect&acknowledged=false&limit=50&offset=0&sort=desc
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.json({
        success: true,
        enabled: false,
        alerts: [],
        total: 0,
        count: 0,
      });
    }

    const query: ListAlertsQuery = {
      severity: req.query.severity as ListAlertsQuery['severity'],
      type: req.query.type as ListAlertsQuery['type'],
      acknowledged: req.query.acknowledged === 'true' ? true : req.query.acknowledged === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      sort: req.query.sort as ListAlertsQuery['sort'],
    };

    const result = await alertService.listAlerts(query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get a specific alert by ID
 * GET /alerts/:id
 */
router.get('/alerts/:id', async (req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Alert service is disabled',
      });
    }

    const { id } = req.params;
    const result = await alertService.getAlert(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Create a new alert
 * POST /alerts
 * Body: { type: string, severity: string, message: string, metadata?: object }
 */
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Alert service is disabled',
      });
    }

    const requestData = req.body as CreateAlertRequest;

    if (!requestData.type || !requestData.severity || !requestData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, severity, message',
      });
    }

    const result = await alertService.createAlert(requestData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(201).json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Acknowledge an alert
 * POST /alerts/:id/acknowledge
 * Body: { acknowledgedBy?: string }
 */
router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Alert service is disabled',
      });
    }

    const { id } = req.params;
    const { acknowledgedBy } = req.body as { acknowledgedBy?: string };

    const result = await alertService.acknowledgeAlert(id, acknowledgedBy);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Delete an alert
 * DELETE /alerts/:id
 */
router.delete('/alerts/:id', async (req: Request, res: Response) => {
  try {
    if (!alertService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Alert service is disabled',
      });
    }

    const { id } = req.params;
    const result = await alertService.deleteAlert(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as alertsRouter };
