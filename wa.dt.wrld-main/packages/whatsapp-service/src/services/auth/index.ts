/**
 * Auth Services Index
 *
 * Exports all authentication-related services.
 */

export {
  initializeOidcClient,
  getOidcClient,
  isOidcClientInitialized,
  generateState,
  generateNonce,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  convertTokenSet,
  extractUserFromClaims,
  extractRolesFromClaims,
  extractOrganizationFromClaims,
  getEndSessionUrl,
  introspectToken,
} from './oidcClient';

export {
  shouldRefreshTokens,
  areTokensExpired,
  attemptTokenRefresh,
  getTokenTimeRemaining,
  buildAuthContext,
  processIdToken,
  hasAnyRole,
  hasAllRoles,
  isSuperAdmin,
  canManageTenant,
  canPerformHitl,
} from './tokenService';

export {
  createSessionFromTokens,
  storeOidcFlowState,
  getOidcFlowState,
  destroySession,
  isSessionAuthenticated,
  getAuthMeData,
  refreshSessionIfNeeded,
  getIdToken,
  getAccessToken,
  updateSessionTokens,
  clearSessionAuth,
  getOrganizationId,
  canAccessTenant,
} from './sessionService';
