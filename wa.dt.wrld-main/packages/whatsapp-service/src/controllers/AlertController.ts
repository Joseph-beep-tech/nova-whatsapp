/**
 * Alert Controller
 *
 * Provides endpoints for operator alert management.
 * Supports alert creation, listing, acknowledgment, and statistics.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Route,
  Tags,
  Security,
  Body,
  Path,
  Query,
  Response,
  SuccessResponse,
} from 'tsoa';
import { alertService } from '../services/alertService';
import { getErrorMessage } from '../types/webhook';
import {
  CreateAlertRequest,
  CreateAlertResponse,
  ListAlertsQuery,
  ListAlertsResponse,
  GetAlertResponse,
  AcknowledgeAlertRequest,
  AcknowledgeAlertResponse,
  DeleteAlertResponse,
  AlertStatsResponse,
  AlertBaseResponse,
  AlertSeverity,
  AlertType,
} from '../types/alert';

@Route('alerts')
@Tags('Alerts')
@Security('api_key')
export class AlertController extends Controller {
  /**
   * List alerts
   *
   * Returns alerts with optional filtering by severity, type, and acknowledgment status.
   * Supports pagination via limit/offset parameters.
   *
   * @summary List alerts with filtering and pagination
   * @param severity Filter by severity level
   * @param type Filter by alert type
   * @param acknowledged Filter by acknowledged status
   * @param limit Number of alerts to return (default: 50)
   * @param offset Number of alerts to skip (for pagination)
   * @param sort Sort order: 'asc' or 'desc' (default: 'desc' - newest first)
   */
  @Get()
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async listAlerts(
    @Query() severity?: AlertSeverity,
    @Query() type?: AlertType,
    @Query() acknowledged?: boolean,
    @Query() limit?: number,
    @Query() offset?: number,
    @Query() sort?: 'asc' | 'desc'
  ): Promise<ListAlertsResponse> {
    try {
      if (!alertService.isEnabled()) {
        return {
          success: true,
          alerts: [],
          total: 0,
          count: 0,
          query: {
            severity,
            type,
            acknowledged,
            limit,
            offset,
            sort,
          },
        };
      }

      const query: ListAlertsQuery = {
        severity,
        type,
        acknowledged,
        limit,
        offset,
        sort,
      };

      const result = await alertService.listAlerts(query);

      if (!result.success) {
        this.setStatus(500);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        alerts: result.alerts,
        total: result.total,
        count: result.count,
        query,
      };
    } catch (error: unknown) {
      console.error('Error listing alerts:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get alert statistics
   *
   * Returns statistics about alerts in the system, including counts
   * by severity, type, and acknowledgment status.
   *
   * @summary Get alert statistics
   */
  @Get('stats')
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async getStats(): Promise<AlertStatsResponse> {
    try {
      if (!alertService.isEnabled()) {
        return {
          success: true,
          total: 0,
          unacknowledged: 0,
          acknowledged: 0,
          bySeverity: {
            info: 0,
            warning: 0,
            critical: 0,
          },
          byType: {
            session_disconnect: 0,
            failed_message: 0,
            queue_backup: 0,
            escalation_needed: 0,
          },
        };
      }

      const result = await alertService.getStats();

      if (!result.success) {
        this.setStatus(500);
        return {
          success: false,
          error: result.error,
        };
      }

      return result;
    } catch (error: unknown) {
      console.error('Error getting alert stats:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get alert by ID
   *
   * Returns a specific alert by its ID.
   *
   * @summary Get specific alert
   * @param alertId Alert ID
   */
  @Get('{alertId}')
  @Response<AlertBaseResponse>(404, 'Alert not found')
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async getAlert(@Path() alertId: string): Promise<GetAlertResponse> {
    try {
      if (!alertService.isEnabled()) {
        this.setStatus(404);
        return {
          success: false,
          error: 'Alert service is disabled',
        };
      }

      const result = await alertService.getAlert(alertId);

      if (!result.success) {
        this.setStatus(404);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        alert: result.alert,
      };
    } catch (error: unknown) {
      console.error('Error getting alert:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Create alert
   *
   * Creates a new alert. If webhook delivery is configured, the alert
   * will be sent to the configured webhook URL.
   *
   * @summary Create a new alert
   * @param body Alert creation request
   */
  @Post()
  @SuccessResponse(200, 'Alert created successfully')
  @Response<AlertBaseResponse>(400, 'Invalid request')
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async createAlert(@Body() body: CreateAlertRequest): Promise<CreateAlertResponse> {
    try {
      if (!alertService.isEnabled()) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Alert service is disabled',
        };
      }

      // Validate required fields
      if (!body.type || !body.severity || !body.message) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Missing required fields: type, severity, message',
        };
      }

      const result = await alertService.createAlert(body);

      if (!result.success) {
        this.setStatus(500);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        alert: result.alert,
      };
    } catch (error: unknown) {
      console.error('Error creating alert:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Acknowledge alert
   *
   * Marks an alert as acknowledged. Optionally records the user
   * who acknowledged the alert.
   *
   * @summary Acknowledge an alert
   * @param alertId Alert ID
   * @param body Acknowledgment request (optional acknowledgedBy)
   */
  @Patch('{alertId}/acknowledge')
  @Response<AlertBaseResponse>(404, 'Alert not found')
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async acknowledgeAlert(
    @Path() alertId: string,
    @Body() body: AcknowledgeAlertRequest
  ): Promise<AcknowledgeAlertResponse> {
    try {
      if (!alertService.isEnabled()) {
        this.setStatus(404);
        return {
          success: false,
          error: 'Alert service is disabled',
        };
      }

      const result = await alertService.acknowledgeAlert(alertId, body.acknowledgedBy);

      if (!result.success) {
        this.setStatus(404);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        alert: result.alert,
      };
    } catch (error: unknown) {
      console.error('Error acknowledging alert:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Delete alert
   *
   * Permanently deletes an alert from the database.
   *
   * @summary Delete an alert
   * @param alertId Alert ID
   */
  @Delete('{alertId}')
  @Response<AlertBaseResponse>(404, 'Alert not found')
  @Response<AlertBaseResponse>(500, 'Internal server error')
  public async deleteAlert(@Path() alertId: string): Promise<DeleteAlertResponse> {
    try {
      if (!alertService.isEnabled()) {
        this.setStatus(404);
        return {
          success: false,
          error: 'Alert service is disabled',
        };
      }

      const result = await alertService.deleteAlert(alertId);

      if (!result.success) {
        this.setStatus(404);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        deletedId: result.deletedId,
      };
    } catch (error: unknown) {
      console.error('Error deleting alert:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
