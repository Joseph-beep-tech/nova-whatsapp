/**
 * Token Service
 *
 * Handles token lifecycle: validation, refresh, and expiry checking.
 * Tokens are stored server-side in Redis sessions (BFF pattern).
 */

import { authConfig } from '../../shared/config';
import { TokenSet, UserRole, AuthUser, AuthContext, AppSessionData } from '../../types/auth';
import {
  refreshTokens,
  convertTokenSet,
  extractUserFromClaims,
  extractRolesFromClaims,
  extractOrganizationFromClaims,
  getOidcClient,
} from './oidcClient';

/**
 * Check if tokens are about to expire (within refresh threshold)
 */
export function shouldRefreshTokens(tokens: TokenSet): boolean {
  if (!tokens.expiresAt) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const threshold = authConfig.tokenRefreshThreshold;

  return tokens.expiresAt - now < threshold;
}

/**
 * Check if tokens have expired
 */
export function areTokensExpired(tokens: TokenSet): boolean {
  if (!tokens.expiresAt) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return tokens.expiresAt < now;
}

/**
 * Attempt to refresh tokens
 * Returns new token set or null if refresh failed
 */
export async function attemptTokenRefresh(tokens: TokenSet): Promise<TokenSet | null> {
  if (!tokens.refreshToken) {
    console.log('No refresh token available');
    return null;
  }

  try {
    const newTokenSet = await refreshTokens(tokens.refreshToken);
    return convertTokenSet(newTokenSet);
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Get remaining time until token expiry in seconds
 */
export function getTokenTimeRemaining(tokens: TokenSet): number | null {
  if (!tokens.expiresAt) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, tokens.expiresAt - now);
}

/**
 * Build AuthContext from session data
 */
export function buildAuthContext(sessionData: AppSessionData, sessionId: string): AuthContext | null {
  if (!sessionData.tokens || !sessionData.user) {
    return null;
  }

  const expiresAt = sessionData.tokens.expiresAt
    ? sessionData.tokens.expiresAt * 1000 // Convert to Unix ms
    : Date.now() + authConfig.sessionTtlSeconds * 1000;

  return {
    sub: sessionData.user.sub,
    email: sessionData.user.email,
    name: sessionData.user.name,
    roles: sessionData.roles || [],
    organizationId: sessionData.organizationId || null,
    organizationName: sessionData.organizationName,
    sessionId,
    expiresAt,
  };
}

/**
 * Extract and validate claims from ID token
 * Returns user info, roles, and organization
 */
export async function processIdToken(idToken: string): Promise<{
  user: AuthUser;
  roles: UserRole[];
  organizationId: string | null;
  organizationName?: string;
}> {
  const client = getOidcClient();

  // Decode ID token claims (openid-client validates signature automatically during callback)
  // For additional validation, we can use client.userinfo() or decode the JWT
  const claims = decodeJwtClaims(idToken);

  const user = extractUserFromClaims(claims);
  const roles = extractRolesFromClaims(claims);
  const organization = extractOrganizationFromClaims(claims);

  return {
    user,
    roles,
    organizationId: organization?.id || null,
    organizationName: organization?.name,
  };
}

/**
 * Decode JWT claims without verification (for reading already-validated tokens)
 * Note: Token validation is done by openid-client during the callback flow
 */
function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split('.');
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT claims:', error);
    return {};
  }
}

/**
 * Validate that user has at least one of the required roles
 */
export function hasAnyRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Validate that user has all of the required roles
 */
export function hasAllRoles(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Check if user is a super admin (creator_admin role)
 */
export function isSuperAdmin(roles: UserRole[]): boolean {
  return roles.includes('creator_admin');
}

/**
 * Check if user can manage their tenant (tenant_admin or creator_admin)
 */
export function canManageTenant(roles: UserRole[]): boolean {
  return roles.includes('creator_admin') || roles.includes('tenant_admin');
}

/**
 * Check if user can perform HITL operations (agent or above)
 */
export function canPerformHitl(roles: UserRole[]): boolean {
  return roles.some(role =>
    ['creator_admin', 'tenant_admin', 'agent'].includes(role)
  );
}
