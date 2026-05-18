/**
 * Session Service
 *
 * Handles session creation, destruction, and management.
 * Sessions are stored in Redis using connect-redis.
 */

import { Request, Response } from 'express';
import { TokenSet as OidcTokenSet } from 'openid-client';
import { AppSessionData, TokenSet, AuthMeResponse } from '../../types/auth';
import {
  convertTokenSet,
  extractUserFromClaims,
  extractRolesFromClaims,
  extractOrganizationFromClaims,
} from './oidcClient';
import { shouldRefreshTokens, attemptTokenRefresh, areTokensExpired } from './tokenService';

/**
 * Create a new session from OIDC token set
 */
export function createSessionFromTokens(
  req: Request,
  tokenSet: OidcTokenSet
): void {
  const tokens = convertTokenSet(tokenSet);
  const claims = tokenSet.claims();

  const user = extractUserFromClaims(claims);
  const roles = extractRolesFromClaims(claims);
  const organization = extractOrganizationFromClaims(claims);

  if (!req.session) return;

  // Store in session
  req.session.tokens = tokens;
  req.session.user = user;
  req.session.roles = roles;
  req.session.organizationId = organization?.id || null;
  req.session.organizationName = organization?.name;

  // Clear OIDC flow state
  delete req.session.oidcState;
  delete req.session.oidcNonce;
  delete req.session.returnTo;
}

/**
 * Store OIDC flow state in session
 */
export function storeOidcFlowState(
  req: Request,
  state: string,
  nonce: string,
  returnTo?: string
): void {
  if (!req.session) return;
  req.session.oidcState = state;
  req.session.oidcNonce = nonce;
  if (returnTo) {
    req.session.returnTo = returnTo;
  }
}

/**
 * Get stored OIDC flow state from session
 */
export function getOidcFlowState(req: Request): {
  state?: string;
  nonce?: string;
  returnTo?: string;
} {
  if (!req.session) return {};
  return {
    state: req.session.oidcState,
    nonce: req.session.oidcNonce,
    returnTo: req.session.returnTo,
  };
}

/**
 * Destroy session (logout)
 */
export async function destroySession(req: Request): Promise<void> {
  if (!req.session) return;
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction failed:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Check if session is authenticated (has valid tokens)
 * Returns false gracefully when session middleware is not mounted
 */
export function isSessionAuthenticated(req: Request): boolean {
  if (!req.session) return false;
  return !!(req.session.tokens && req.session.user);
}

/**
 * Get session data for /auth/me endpoint
 */
export function getAuthMeData(req: Request): AuthMeResponse {
  if (!isSessionAuthenticated(req)) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: req.session?.user,
    roles: req.session?.roles,
    organizationId: req.session?.organizationId,
    organizationName: req.session?.organizationName,
  };
}

/**
 * Refresh session tokens if needed
 * Returns true if session is still valid, false if user needs to re-authenticate
 */
export async function refreshSessionIfNeeded(req: Request): Promise<boolean> {
  if (!req.session?.tokens) {
    return false;
  }

  const tokens = req.session.tokens;

  // Check if tokens are expired
  if (areTokensExpired(tokens)) {
    const newTokens = await attemptTokenRefresh(tokens);
    if (!newTokens) {
      // Refresh failed, session is invalid
      return false;
    }
    req.session.tokens = newTokens;
    return true;
  }

  // Check if tokens should be proactively refreshed
  if (shouldRefreshTokens(tokens)) {
    const newTokens = await attemptTokenRefresh(tokens);
    if (newTokens) {
      req.session.tokens = newTokens;
    }
    // Even if proactive refresh fails, session is still valid if not expired
    return true;
  }

  return true;
}

/**
 * Get the ID token from session (for logout)
 */
export function getIdToken(req: Request): string | undefined {
  return req.session.tokens?.idToken;
}

/**
 * Get the access token from session
 * Useful for making API calls on behalf of the user
 */
export function getAccessToken(req: Request): string | undefined {
  return req.session.tokens?.accessToken;
}

/**
 * Update session tokens (after refresh)
 */
export function updateSessionTokens(req: Request, tokens: TokenSet): void {
  if (!req.session) return;
  req.session.tokens = tokens;
}

/**
 * Clear session authentication data (keep session for flash messages etc)
 */
export function clearSessionAuth(req: Request): void {
  if (!req.session) return;
  delete req.session.tokens;
  delete req.session.user;
  delete req.session.roles;
  delete req.session.organizationId;
  delete req.session.organizationName;
}

/**
 * Get organization ID from session (for tenant scoping)
 */
export function getOrganizationId(req: Request): string | null {
  return req.session?.organizationId ?? null;
}

/**
 * Check if user has access to a specific tenant
 * Super admins (creator_admin) can access all tenants
 * Other users can only access their own organization
 */
export function canAccessTenant(req: Request, tenantId: string): boolean {
  const roles = req.session?.roles || [];

  // Super admins can access all tenants
  if (roles.includes('creator_admin')) {
    return true;
  }

  // Other users can only access their own organization
  const userTenantId = req.session?.organizationId;
  return userTenantId === tenantId;
}
