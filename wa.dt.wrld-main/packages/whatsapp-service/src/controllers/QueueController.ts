/**
 * Queue Controller
 *
 * Provides queue statistics and failed job management.
 * Only available when ENABLE_EVENT_QUEUE=true.
 */

import {
  Controller,
  Get,
  Route,
  Tags,
  Security,
  Query,
  Response,
} from 'tsoa';
import { queueConfig } from '../shared/config';
import { eventQueue } from '../services/eventQueue';
import { getErrorMessage } from '../types/webhook';
import {
  QueueStatsResponse,
  QueueFailedResponse,
  BaseResponse,
} from '../types/api';

@Route('queue')
@Tags('Queue')
@Security('api_key')
export class QueueController extends Controller {
  /**
   * Get queue statistics
   *
   * Returns statistics about the event processing queue.
   * If the queue is disabled, returns enabled=false.
   *
   * @summary Get queue statistics
   */
  @Get('stats')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getStats(): Promise<QueueStatsResponse> {
    try {
      if (!queueConfig.enabled) {
        return {
          success: true,
          enabled: false,
          message: 'Event queue is disabled',
        };
      }

      const stats = await eventQueue.getStats();

      return {
        success: true,
        enabled: true,
        stats,
      };
    } catch (error: unknown) {
      console.error('Error getting queue stats:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        enabled: queueConfig.enabled,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get failed jobs
   *
   * Returns recent failed jobs from the queue.
   * If the queue is disabled, returns an empty list.
   *
   * @summary Get recent failed jobs
   * @param count Number of failed jobs to return (default: 10)
   */
  @Get('failed')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getFailedJobs(@Query() count?: number): Promise<QueueFailedResponse> {
    try {
      if (!queueConfig.enabled) {
        return {
          success: true,
          enabled: false,
          jobs: [],
        };
      }

      const limit = count || 10;
      const rawJobs = await eventQueue.getFailedJobs(limit);

      // Convert internal job format to API format
      const jobs = rawJobs.map((job) => ({
        id: job.id,
        name: 'event-processing',
        data: job.data as unknown as Record<string, unknown>,
        failedReason: job.error,
        failedAt: new Date().toISOString(), // BullMQ doesn't provide this directly
      }));

      return {
        success: true,
        enabled: true,
        jobs,
      };
    } catch (error: unknown) {
      console.error('Error getting failed jobs:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        enabled: queueConfig.enabled,
        error: getErrorMessage(error),
      };
    }
  }
}
