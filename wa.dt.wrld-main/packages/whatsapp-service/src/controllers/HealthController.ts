/**
 * Health Controller
 *
 * Provides health check, readiness, and session status endpoints.
 * These endpoints are used for monitoring and orchestration.
 */

import { Controller, Get, Route, Tags, Security, Query, Response } from 'tsoa';
import { config } from '../shared/config';
import {
  HealthResponse,
  PingResponse,
  ReadinessResponse,
  SessionsResponse,
} from '../types/api';

// Configuration (set at initialization time)
let WHATSAPP_API_URL: string;
let API_KEY: string;

/**
 * Initialize health controller with configuration
 */
export function initHealthController(whatsappApiUrl: string, apiKey: string): void {
  WHATSAPP_API_URL = whatsappApiUrl;
  API_KEY = apiKey;
}

@Route('health')
@Tags('Health')
export class HealthController extends Controller {
  /**
   * Basic health check
   *
   * Returns the service health status. This endpoint is public
   * and does not require authentication.
   *
   * @summary Service health check
   */
  @Get('')
  public async getHealth(): Promise<HealthResponse> {
    return {
      status: 'healthy',
      service: 'whatsapp-service',
      mode: 'thin-wrapper',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simple ping endpoint
   *
   * Returns a pong response for basic connectivity testing.
   * This endpoint is public and does not require authentication.
   *
   * @summary Ping-pong test
   */
  @Get('ping')
  public async ping(): Promise<PingResponse> {
    return {
      success: true,
      message: 'pong',
    };
  }

  /**
   * Readiness check
   *
   * Verifies that upstream services (wwebjs-api, optionally n8n)
   * are reachable. Used by orchestration systems to determine
   * if the service is ready to handle traffic.
   *
   * @summary Readiness check with upstream verification
   */
  @Get('ready')
  @Response<ReadinessResponse>(503, 'Service not ready')
  public async getReadiness(): Promise<ReadinessResponse> {
    const timeout = config.healthCheckTimeout;
    const results: ReadinessResponse = {
      service: 'whatsapp-service',
      timestamp: new Date().toISOString(),
      wwebjs: false,
      n8n: null,
    };

    // Check wwebjs-api
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${WHATSAPP_API_URL}/session/getSessions`, {
        headers: { 'x-api-key': API_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      results.wwebjs = response.ok;
    } catch {
      results.wwebjs = false;
    }

    // Check n8n (optional)
    if (config.n8nUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(`${config.n8nUrl}/healthz`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        results.n8n = response.ok;
      } catch {
        results.n8n = false;
      }
    }

    const allHealthy = results.wwebjs && (results.n8n === null || results.n8n);
    this.setStatus(allHealthy ? 200 : 503);

    return results;
  }

  /**
   * Session status aggregation
   *
   * Lists all WhatsApp sessions with their connection status.
   * Requires API key authentication via header or query string.
   *
   * @summary List all session statuses
   * @param apiKey API key (alternative to x-api-key header)
   */
  @Get('sessions')
  @Security('api_key')
  @Response<SessionsResponse>(403, 'Invalid or missing API key')
  @Response<SessionsResponse>(503, 'Failed to fetch session status')
  public async getSessions(
    @Query() apiKey?: string
  ): Promise<SessionsResponse> {
    // Note: Security decorator handles auth, but we support query string too
    // The actual auth check is in the route handler since tsoa doesn't support
    // query string auth natively

    try {
      // Get all sessions from wwebjs-api
      const sessionsResponse = await fetch(`${WHATSAPP_API_URL}/session/getSessions`, {
        headers: { 'x-api-key': API_KEY },
      });

      if (!sessionsResponse.ok) {
        this.setStatus(503);
        return {
          success: false,
          error: 'Failed to fetch sessions',
          timestamp: new Date().toISOString(),
        };
      }

      const sessionsData = (await sessionsResponse.json()) as { data?: string[] };
      const sessionIds = sessionsData.data || [];

      // Get status for each session
      const sessionStatuses = await Promise.all(
        sessionIds.map(async (sessionId: string) => {
          try {
            const statusResponse = await fetch(
              `${WHATSAPP_API_URL}/session/status/${sessionId}`,
              {
                headers: { 'x-api-key': API_KEY },
              }
            );
            const statusData = (await statusResponse.json()) as {
              data?: { state?: string };
            };
            const state = statusData.data?.state || 'unknown';
            return {
              sessionId,
              status: state,
              authenticated: state === 'CONNECTED',
            };
          } catch {
            return { sessionId, status: 'error', authenticated: false };
          }
        })
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        sessions: sessionStatuses,
        total: sessionStatuses.length,
        connected: sessionStatuses.filter((s) => s.authenticated).length,
      };
    } catch {
      this.setStatus(503);
      return {
        success: false,
        error: 'Failed to fetch session status',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Also export a standalone ping handler for the root /ping endpoint
@Route('')
@Tags('Health')
export class RootHealthController extends Controller {
  /**
   * Root ping endpoint
   *
   * Alias for /health/ping at the root level.
   *
   * @summary Ping-pong test (root level)
   */
  @Get('ping')
  public async ping(): Promise<PingResponse> {
    return {
      success: true,
      message: 'pong',
    };
  }
}
