/**
 * OIDC Authentication Middleware
 *
 * Provides middleware for protecting routes with Keycloak OIDC authentication.
 * Uses server-side sessions (BFF pattern) - no tokens in browser.
 */

import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../shared/config';
import { buildAuthContext } from '../services/auth/tokenService';
import {
  isSessionAuthenticated,
  refreshSessionIfNeeded,
  getAuthorizationUrl,
  generateState,
  generateNonce,
  storeOidcFlowState,
} from '../services/auth';

/**
 * Middleware that requires an authenticated session
 * Redirects to login if not authenticated
 */
export const requireSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip auth check if Keycloak is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Check if session is authenticated
  if (!isSessionAuthenticated(req)) {
    // Store the original URL to redirect back after login
    const returnTo = req.originalUrl;

    // Generate OIDC state and nonce
    const state = generateState();
    const nonce = generateNonce();

    // Store in session
    storeOidcFlowState(req, state, nonce, returnTo);

    // Redirect to login
    const authUrl = getAuthorizationUrl(state, nonce);
    res.redirect(authUrl);
    return;
  }

  // Refresh tokens if needed
  const isValid = await refreshSessionIfNeeded(req);
  if (!isValid) {
    // Session expired and refresh failed, redirect to login
    const returnTo = req.originalUrl;
    const state = generateState();
    const nonce = generateNonce();

    storeOidcFlowState(req, state, nonce, returnTo);

    const authUrl = getAuthorizationUrl(state, nonce);
    res.redirect(authUrl);
    return;
  }

  // Build auth context and attach to request
  const authContext = buildAuthContext(req.session, req.sessionID);
  if (authContext) {
    req.auth = authContext;
  }

  next();
};

/**
 * Middleware that requires authentication but returns 401 instead of redirecting
 * Useful for API endpoints
 */
export const requireSessionApi = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip auth check if Keycloak is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Check if session is authenticated
  if (!isSessionAuthenticated(req)) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  // Refresh tokens if needed
  const isValid = await refreshSessionIfNeeded(req);
  if (!isValid) {
    res.status(401).json({
      success: false,
      error: 'Session expired',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  // Build auth context and attach to request
  const authContext = buildAuthContext(req.session, req.sessionID);
  if (authContext) {
    req.auth = authContext;
  }

  next();
};

/**
 * Middleware that optionally loads auth context but doesn't require authentication
 * Useful for routes that behave differently based on auth status
 */
export const loadAuthContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if Keycloak is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Try to load auth context if session is authenticated
  if (isSessionAuthenticated(req)) {
    // Silently try to refresh tokens
    await refreshSessionIfNeeded(req);

    // Build auth context
    const authContext = buildAuthContext(req.session, req.sessionID);
    if (authContext) {
      req.auth = authContext;
    }
  }

  next();
};

/**
 * Check if current request is authenticated
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.auth;
}

/**
 * Get the authenticated user's organization ID (for tenant scoping)
 */
export function getTenantId(req: Request): string | null {
  return req.auth?.organizationId ?? null;
}

/**
 * Get the authenticated user's subject (user ID)
 */
export function getUserId(req: Request): string | null {
  return req.auth?.sub ?? null;
}
