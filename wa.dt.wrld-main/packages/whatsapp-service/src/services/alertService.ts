/**
 * Alert Service
 *
 * Handles creation, retrieval, acknowledgment, and deletion of operator alerts.
 * Alerts are stored in MongoDB and can be delivered via webhooks (e.g., Slack).
 *
 * Alert Types:
 * - session_disconnect: WhatsApp session lost connection
 * - failed_message: Message sending failed
 * - queue_backup: Event queue depth exceeded threshold
 * - escalation_needed: Conversation requires human intervention
 */

import axios, { AxiosError } from 'axios';
import { Alert as AlertModel, IAlert } from '../models/Alert';
import { alertConfig } from '../shared/config';
import {
  Alert,
  AlertType,
  AlertSeverity,
  AlertMetadata,
  CreateAlertRequest,
  ListAlertsQuery,
  AlertStatsResponse,
  AlertWebhookPayload,
} from '../types/alert';
import { getErrorMessage } from '../types/webhook';

/**
 * Result of creating an alert
 */
export interface CreateAlertResult {
  success: boolean;
  alert?: Alert;
  error?: string;
}

/**
 * Result of listing alerts
 */
export interface ListAlertsResult {
  success: boolean;
  alerts?: Alert[];
  total?: number;
  count?: number;
  error?: string;
}

/**
 * Result of getting a single alert
 */
export interface GetAlertResult {
  success: boolean;
  alert?: Alert;
  error?: string;
}

/**
 * Result of acknowledging an alert
 */
export interface AcknowledgeAlertResult {
  success: boolean;
  alert?: Alert;
  error?: string;
}

/**
 * Result of deleting an alert
 */
export interface DeleteAlertResult {
  success: boolean;
  deletedId?: string;
  error?: string;
}

/**
 * Alert Service
 *
 * Manages operator alerts with CRUD operations and optional webhook delivery.
 */
export class AlertService {
  private isInitialized = false;

  /**
   * Check if alert service is enabled
   */
  isEnabled(): boolean {
    return alertConfig.enabled;
  }

  /**
   * Initialize the alert service
   */
  async initialize(): Promise<void> {
    if (!alertConfig.enabled) {
      console.log('[AlertService] Alert service disabled, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      console.log('[AlertService] Already initialized');
      return;
    }

    try {
      // Ensure MongoDB indexes are created
      await AlertModel.createIndexes();

      this.isInitialized = true;
      console.log('[AlertService] Initialized successfully');
    } catch (error) {
      console.error('[AlertService] Initialization failed:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Create a new alert
   *
   * @param request - Alert creation request
   * @returns Created alert or error
   */
  async createAlert(request: CreateAlertRequest): Promise<CreateAlertResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      // Create alert document
      const alertDoc = new AlertModel({
        type: request.type,
        severity: request.severity,
        message: request.message,
        metadata: request.metadata || {},
        acknowledged: false,
      });

      // Save to MongoDB
      const saved = await alertDoc.save();

      // Convert to plain object
      const alert = this.toAlertObject(saved);

      console.log(`[AlertService] Created ${request.severity} alert: ${request.type} - ${request.message}`);

      // Deliver webhook (fire-and-forget - don't block on webhook delivery)
      this.deliverWebhook(alert).catch((error) => {
        console.error('[AlertService] Webhook delivery failed:', getErrorMessage(error));
      });

      return {
        success: true,
        alert,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to create alert:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List alerts with filtering and pagination
   *
   * @param query - Query parameters for filtering and pagination
   * @returns List of alerts matching the query
   */
  async listAlerts(query: ListAlertsQuery = {}): Promise<ListAlertsResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      // Build MongoDB filter
      const filter: Record<string, unknown> = {};

      if (query.severity) {
        filter.severity = query.severity;
      }

      if (query.type) {
        filter.type = query.type;
      }

      if (query.acknowledged !== undefined) {
        filter.acknowledged = query.acknowledged;
      }

      // Apply pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      const sort = query.sort === 'asc' ? 1 : -1; // Default: newest first

      // Execute query
      const [alerts, total] = await Promise.all([
        AlertModel.find(filter)
          .sort({ createdAt: sort })
          .skip(offset)
          .limit(limit)
          .lean()
          .exec(),
        AlertModel.countDocuments(filter),
      ]);

      // Convert to plain objects
      const alertObjects = alerts.map(this.toAlertObject);

      return {
        success: true,
        alerts: alertObjects,
        total,
        count: alertObjects.length,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to list alerts:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get a specific alert by ID
   *
   * @param alertId - Alert ID
   * @returns Alert or error
   */
  async getAlert(alertId: string): Promise<GetAlertResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      const alertDoc = await AlertModel.findById(alertId).lean().exec();

      if (!alertDoc) {
        return {
          success: false,
          error: 'Alert not found',
        };
      }

      return {
        success: true,
        alert: this.toAlertObject(alertDoc),
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to get alert:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Acknowledge an alert
   *
   * @param alertId - Alert ID
   * @param acknowledgedBy - User who acknowledged the alert (optional)
   * @returns Updated alert or error
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<AcknowledgeAlertResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      const alertDoc = await AlertModel.findByIdAndUpdate(
        alertId,
        {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: acknowledgedBy || 'unknown',
        },
        { new: true } // Return updated document
      )
        .lean()
        .exec();

      if (!alertDoc) {
        return {
          success: false,
          error: 'Alert not found',
        };
      }

      const alert = this.toAlertObject(alertDoc);

      console.log(`[AlertService] Alert ${alertId} acknowledged by ${acknowledgedBy || 'unknown'}`);

      return {
        success: true,
        alert,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to acknowledge alert:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete an alert
   *
   * @param alertId - Alert ID
   * @returns Success or error
   */
  async deleteAlert(alertId: string): Promise<DeleteAlertResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      const result = await AlertModel.findByIdAndDelete(alertId).exec();

      if (!result) {
        return {
          success: false,
          error: 'Alert not found',
        };
      }

      console.log(`[AlertService] Alert ${alertId} deleted`);

      return {
        success: true,
        deletedId: alertId,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to delete alert:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get alert statistics
   *
   * @returns Statistics about alerts in the system
   */
  async getStats(): Promise<AlertStatsResponse> {
    try {
      if (!this.isInitialized) {
        throw new Error('Alert service not initialized');
      }

      // Run aggregation pipeline for stats
      const [total, unacknowledged, acknowledged, bySeverity, byType] = await Promise.all([
        AlertModel.countDocuments({}),
        AlertModel.countDocuments({ acknowledged: false }),
        AlertModel.countDocuments({ acknowledged: true }),
        AlertModel.aggregate([
          {
            $group: {
              _id: '$severity',
              count: { $sum: 1 },
            },
          },
        ]),
        AlertModel.aggregate([
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Convert aggregation results to objects
      const severityCounts = {
        info: 0,
        warning: 0,
        critical: 0,
      };

      bySeverity.forEach((item: { _id: AlertSeverity; count: number }) => {
        severityCounts[item._id] = item.count;
      });

      const typeCounts = {
        session_disconnect: 0,
        failed_message: 0,
        queue_backup: 0,
        escalation_needed: 0,
      };

      byType.forEach((item: { _id: AlertType; count: number }) => {
        typeCounts[item._id] = item.count;
      });

      return {
        success: true,
        total,
        unacknowledged,
        acknowledged,
        bySeverity: severityCounts,
        byType: typeCounts,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to get stats:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Auto-cleanup: Delete old alerts if maxRetention is exceeded
   *
   * This should be called periodically (e.g., via cron or on service start)
   */
  async cleanupOldAlerts(): Promise<void> {
    try {
      if (!this.isInitialized || alertConfig.maxRetention === 0) {
        return; // Skip cleanup if disabled or unlimited retention
      }

      const total = await AlertModel.countDocuments({});

      if (total <= alertConfig.maxRetention) {
        return; // Nothing to clean up
      }

      // Delete oldest alerts to stay within retention limit
      const toDelete = total - alertConfig.maxRetention;

      const oldestAlerts = await AlertModel.find({})
        .sort({ createdAt: 1 }) // Oldest first
        .limit(toDelete)
        .select('_id')
        .lean()
        .exec();

      const idsToDelete = oldestAlerts.map((alert) => alert._id);

      await AlertModel.deleteMany({ _id: { $in: idsToDelete } }).exec();

      console.log(`[AlertService] Cleaned up ${toDelete} old alerts (retention: ${alertConfig.maxRetention})`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to cleanup old alerts:', errorMessage);
    }
  }

  /**
   * Auto-acknowledge old unacknowledged alerts
   *
   * This should be called periodically if autoAcknowledgeAfterMinutes is set
   */
  async autoAcknowledgeOldAlerts(): Promise<void> {
    try {
      if (!this.isInitialized || alertConfig.autoAcknowledgeAfterMinutes === 0) {
        return; // Skip if disabled
      }

      const cutoffDate = new Date();
      cutoffDate.setMinutes(cutoffDate.getMinutes() - alertConfig.autoAcknowledgeAfterMinutes);

      const result = await AlertModel.updateMany(
        {
          acknowledged: false,
          createdAt: { $lt: cutoffDate },
        },
        {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: 'auto-acknowledged',
        }
      ).exec();

      if (result.modifiedCount > 0) {
        console.log(
          `[AlertService] Auto-acknowledged ${result.modifiedCount} alerts older than ${alertConfig.autoAcknowledgeAfterMinutes} minutes`
        );
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[AlertService] Failed to auto-acknowledge old alerts:', errorMessage);
    }
  }

  /**
   * Deliver alert to external webhook (e.g., Slack)
   *
   * This method is fire-and-forget - errors are logged but not thrown.
   * Filters alerts based on webhook configuration (severity, type).
   *
   * @param alert - Alert to deliver
   */
  private async deliverWebhook(alert: Alert): Promise<void> {
    // Check if webhook delivery is enabled
    if (!alertConfig.webhook?.enabled || !alertConfig.webhook.webhookUrl) {
      return;
    }

    const webhook = alertConfig.webhook;

    // Apply severity filter if configured
    if (webhook.severityFilter && webhook.severityFilter.length > 0) {
      if (!webhook.severityFilter.includes(alert.severity)) {
        return; // Alert severity not in filter
      }
    }

    // Apply type filter if configured
    if (webhook.typeFilter && webhook.typeFilter.length > 0) {
      if (!webhook.typeFilter.includes(alert.type)) {
        return; // Alert type not in filter
      }
    }

    try {
      // Construct webhook payload
      const payload: AlertWebhookPayload = {
        alert,
        sentAt: new Date().toISOString(),
        source: 'whatsapp-service',
      };

      // Send POST request to webhook URL
      const response = await axios.post(webhook.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers,
        },
        timeout: webhook.timeout || 10000,
      });

      console.log(`[AlertService] Webhook delivered successfully for alert ${alert._id} (status: ${response.status})`);
    } catch (error: unknown) {
      // Log error but don't throw - webhook delivery failures should not block alert creation
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status || 'unknown';
        const statusText = axiosError.response?.statusText || 'unknown';
        console.error(
          `[AlertService] Webhook delivery failed for alert ${alert._id}: HTTP ${status} ${statusText}`
        );
      } else {
        console.error(`[AlertService] Webhook delivery failed for alert ${alert._id}:`, getErrorMessage(error));
      }
    }
  }

  /**
   * Convert MongoDB document to Alert object
   */
  private toAlertObject(doc: IAlert | Record<string, unknown>): Alert {
    const alert = doc as Record<string, unknown>;

    return {
      _id: alert._id?.toString() || '',
      type: alert.type as AlertType,
      severity: alert.severity as AlertSeverity,
      message: alert.message as string,
      metadata: (alert.metadata as AlertMetadata) || {},
      acknowledged: alert.acknowledged as boolean,
      acknowledgedAt: alert.acknowledgedAt ? (alert.acknowledgedAt as Date).toISOString() : undefined,
      acknowledgedBy: alert.acknowledgedBy as string | undefined,
      createdAt: (alert.createdAt as Date).toISOString(),
      updatedAt: alert.updatedAt ? (alert.updatedAt as Date).toISOString() : undefined,
    };
  }
}

// Export singleton instance
export const alertService = new AlertService();
