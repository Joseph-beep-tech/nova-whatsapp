/**
 * Authentication Types
 *
 * Types for Keycloak OIDC authentication and session management.
 * Uses BFF (Backend-for-Frontend) pattern where the service holds sessions
 * and the frontend never sees raw tokens.
 */

import 'express-session';

/**
 * User roles defined in Keycloak realm
 */
export type UserRole =
  | 'creator_admin'
  | 'tenant_admin'
  | 'agent'
  | 'automation_engineer'
  | 'read_only';

/**
 * Organization info from Keycloak organizations feature
 */
export interface OrganizationInfo {
  id: string;
  name?: string;
}

/**
 * User information extracted from Keycloak tokens
 */
export interface AuthUser {
  /** Keycloak user ID (sub claim) */
  sub: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** Given name */
  givenName?: string;
  /** Family name */
  familyName?: string;
  /** Username (preferred_username claim) */
  username?: string;
  /** Whether email is verified */
  emailVerified?: boolean;
}

/**
 * Authentication context attached to requests
 * Available on req.auth after session middleware
 */
export interface AuthContext {
  /** Keycloak user ID (sub claim) */
  sub: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** User's assigned roles */
  roles: UserRole[];
  /** Organization ID from Keycloak organizations (tenant scoping) */
  organizationId: string | null;
  /** Organization display name */
  organizationName?: string;
  /** Session ID */
  sessionId: string;
  /** Session expiration timestamp (Unix ms) */
  expiresAt: number;
}

/**
 * Token set stored in session
 * These are stored server-side only, never exposed to frontend
 */
export interface TokenSet {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** ID token containing user claims */
  idToken?: string;
  /** Access token expiration timestamp (Unix seconds) */
  expiresAt?: number;
  /** Token type (usually 'Bearer') */
  tokenType?: string;
}

/**
 * Custom session data fields stored in Redis
 * These fields are added to express-session's SessionData
 */
export interface AppSessionData {
  /** Token set from Keycloak (stored server-side only) */
  tokens?: TokenSet;
  /** User information extracted from ID token */
  user?: AuthUser;
  /** User's roles from token claims */
  roles?: UserRole[];
  /** Organization ID for tenant scoping */
  organizationId?: string | null;
  /** Organization display name */
  organizationName?: string;
  /** OIDC state for login flow */
  oidcState?: string;
  /** OIDC nonce for login flow */
  oidcNonce?: string;
  /** Original URL to redirect to after login */
  returnTo?: string;
}

/**
 * Response for /auth/me endpoint
 */
export interface AuthMeResponse {
  /** Whether user is authenticated */
  authenticated: boolean;
  /** User information (if authenticated) */
  user?: AuthUser;
  /** User's roles (if authenticated) */
  roles?: UserRole[];
  /** Organization ID for tenant scoping */
  organizationId?: string | null;
  /** Organization name */
  organizationName?: string;
}

/**
 * OIDC configuration for the service
 */
export interface OidcConfig {
  /** Keycloak issuer URL (e.g., https://auth.dater.world/realms/dater) */
  issuerUrl: string;
  /** Client ID registered in Keycloak */
  clientId: string;
  /** Client secret for confidential client */
  clientSecret: string;
  /** Callback URL for authorization code exchange */
  callbackUrl: string;
  /** Post-logout redirect URL */
  postLogoutUrl: string;
  /** Scopes to request (default: openid profile email roles) */
  scopes?: string[];
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session secret for signing cookies */
  secret: string;
  /** Session TTL in seconds (default: 86400 = 24 hours) */
  ttlSeconds: number;
  /** Cookie name (default: 'sid') */
  cookieName: string;
  /** Whether to use secure cookies (should be true in production) */
  secure: boolean;
  /** SameSite cookie attribute */
  sameSite: 'strict' | 'lax' | 'none';
}

// Extend Express Request to include auth context
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authentication context (set by requireSession middleware) */
      auth?: AuthContext;
    }
  }
}

// Extend express-session Session type with our custom fields
declare module 'express-session' {
  interface SessionData {
    /** Token set from Keycloak (stored server-side only) */
    tokens?: TokenSet;
    /** User information extracted from ID token */
    user?: AuthUser;
    /** User's roles from token claims */
    roles?: UserRole[];
    /** Organization ID for tenant scoping */
    organizationId?: string | null;
    /** Organization display name */
    organizationName?: string;
    /** OIDC state for login flow */
    oidcState?: string;
    /** OIDC nonce for login flow */
    oidcNonce?: string;
    /** Original URL to redirect to after login */
    returnTo?: string;
  }
}
