/**
 * tsoa Authentication Module
 *
 * Provides authentication middleware for tsoa-generated routes.
 * Used by @Security('api_key') decorator in controllers.
 */

import { Request } from 'express';

/**
 * Authentication function for tsoa.
 * Called when a controller method uses @Security('api_key')
 *
 * @param request Express request
 * @param securityName Name of the security scheme (e.g., 'api_key')
 * @param scopes Required scopes (not used for API key auth)
 */
export async function expressAuthentication(
  request: Request,
  securityName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _scopes?: string[]
): Promise<Record<string, unknown>> {
  if (securityName === 'api_key') {
    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
    const expectedKey = process.env.API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      const error = new Error('Invalid or missing API key');
      (error as Error & { status: number }).status = 403;
      throw error;
    }

    // Return authenticated context (can be accessed via request.user in controllers)
    return { authenticated: true };
  }

  throw new Error(`Unknown security scheme: ${securityName}`);
}
