/**
 * OIDC Client Service
 *
 * Handles OpenID Connect operations with Keycloak using openid-client library.
 * Provides discovery, authorization URL generation, token exchange, and validation.
 */

import { Issuer, Client, generators, TokenSet as OidcTokenSet } from 'openid-client';
import { authConfig } from '../../shared/config';
import { TokenSet, UserRole, AuthUser, OrganizationInfo } from '../../types/auth';

/** Singleton OIDC client instance */
let oidcClient: Client | null = null;
let issuer: Issuer | null = null;

/**
 * Initialize the OIDC client by discovering the Keycloak configuration
 * Must be called before using other OIDC functions
 */
export async function initializeOidcClient(): Promise<void> {
  if (!authConfig.enabled) {
    console.log('ℹ️  Keycloak auth disabled (ENABLE_KEYCLOAK_AUTH not set)');
    return;
  }

  try {
    console.log(`🔐 Discovering OIDC configuration from ${authConfig.issuerUrl}`);

    // Discover the Keycloak OIDC configuration
    issuer = await Issuer.discover(authConfig.issuerUrl);

    console.log(`✅ OIDC issuer discovered: ${issuer.metadata.issuer}`);

    // Create the client
    oidcClient = new issuer.Client({
      client_id: authConfig.clientId,
      client_secret: authConfig.clientSecret,
      redirect_uris: [`${authConfig.baseUrl}/auth/callback`],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    });

    console.log('✅ OIDC client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize OIDC client:', error);
    throw error;
  }
}

/**
 * Get the initialized OIDC client
 * Throws if client is not initialized
 */
export function getOidcClient(): Client {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized. Call initializeOidcClient() first.');
  }
  return oidcClient;
}

/**
 * Check if OIDC client is initialized
 */
export function isOidcClientInitialized(): boolean {
  return oidcClient !== null;
}

/**
 * Generate a random state value for OIDC flow
 */
export function generateState(): string {
  return generators.state();
}

/**
 * Generate a random nonce value for OIDC flow
 */
export function generateNonce(): string {
  return generators.nonce();
}

/**
 * Generate the authorization URL for Keycloak login
 */
export function getAuthorizationUrl(state: string, nonce: string): string {
  const client = getOidcClient();

  return client.authorizationUrl({
    scope: authConfig.scopes.join(' '),
    state,
    nonce,
    response_type: 'code',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string,
  expectedState: string,
  nonce: string,
  iss?: string
): Promise<OidcTokenSet> {
  const client = getOidcClient();

  // Verify state matches
  if (state !== expectedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  // Build callback parameters — include iss if Keycloak sent it (RFC 9207)
  const callbackParams: Record<string, string> = { code, state };
  if (iss) {
    callbackParams.iss = iss;
  }

  // Exchange code for tokens
  const tokenSet = await client.callback(
    `${authConfig.baseUrl}/auth/callback`,
    callbackParams,
    { state: expectedState, nonce }
  );

  return tokenSet;
}

/**
 * Refresh tokens using refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<OidcTokenSet> {
  const client = getOidcClient();
  return await client.refresh(refreshToken);
}

/**
 * Convert openid-client TokenSet to our internal TokenSet format
 */
export function convertTokenSet(oidcTokenSet: OidcTokenSet): TokenSet {
  return {
    accessToken: oidcTokenSet.access_token!,
    refreshToken: oidcTokenSet.refresh_token,
    idToken: oidcTokenSet.id_token,
    expiresAt: oidcTokenSet.expires_at,
    tokenType: oidcTokenSet.token_type,
  };
}

/**
 * Extract user information from ID token claims
 */
export function extractUserFromClaims(claims: Record<string, unknown>): AuthUser {
  return {
    sub: claims.sub as string,
    email: claims.email as string | undefined,
    name: claims.name as string | undefined,
    givenName: claims.given_name as string | undefined,
    familyName: claims.family_name as string | undefined,
    username: claims.preferred_username as string | undefined,
    emailVerified: claims.email_verified as boolean | undefined,
  };
}

/**
 * Extract roles from ID token claims
 * Keycloak can put roles in different places depending on mapper configuration
 */
export function extractRolesFromClaims(claims: Record<string, unknown>): UserRole[] {
  const validRoles: UserRole[] = [
    'creator_admin',
    'tenant_admin',
    'agent',
    'automation_engineer',
    'read_only',
  ];

  // Try different claim locations
  let roles: string[] = [];

  // Direct roles claim (from our custom mapper)
  if (Array.isArray(claims.roles)) {
    roles = claims.roles as string[];
  }
  // Keycloak's default realm_access.roles
  else if (
    claims.realm_access &&
    typeof claims.realm_access === 'object' &&
    Array.isArray((claims.realm_access as Record<string, unknown>).roles)
  ) {
    roles = (claims.realm_access as Record<string, string[]>).roles;
  }
  // Fallback to resource_access.{clientId}.roles
  else if (
    claims.resource_access &&
    typeof claims.resource_access === 'object'
  ) {
    const resourceAccess = claims.resource_access as Record<string, { roles?: string[] }>;
    const clientAccess = resourceAccess[authConfig.clientId];
    if (clientAccess && Array.isArray(clientAccess.roles)) {
      roles = clientAccess.roles;
    }
  }

  // Filter to only valid roles
  return roles.filter((role): role is UserRole => validRoles.includes(role as UserRole));
}

/**
 * Extract organization info from ID token claims
 * Uses Keycloak 24+ organizations feature
 */
export function extractOrganizationFromClaims(claims: Record<string, unknown>): OrganizationInfo | null {
  // Keycloak 24+ organization claims
  // kc.org contains the organization ID
  // kc.org.name contains the organization name (if mapped)
  const orgId = claims['kc.org'] as string | undefined;

  if (!orgId) {
    // Also check 'organization' claim (from our custom mapper)
    const org = claims.organization as string | Record<string, unknown> | undefined;
    if (typeof org === 'string') {
      return { id: org };
    }
    if (typeof org === 'object' && org !== null) {
      return {
        id: (org as Record<string, string>).id || '',
        name: (org as Record<string, string>).name,
      };
    }
    return null;
  }

  return {
    id: orgId,
    name: claims['kc.org.name'] as string | undefined,
  };
}

/**
 * Get the end session (logout) URL for Keycloak
 */
export function getEndSessionUrl(idToken?: string): string {
  const client = getOidcClient();

  return client.endSessionUrl({
    id_token_hint: idToken,
    post_logout_redirect_uri: `${authConfig.baseUrl}/auth/logout/callback`,
  });
}

/**
 * Introspect a token to check if it's still valid
 */
export async function introspectToken(token: string): Promise<boolean> {
  try {
    const client = getOidcClient();
    const result = await client.introspect(token);
    return result.active === true;
  } catch {
    return false;
  }
}
