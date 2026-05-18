/**
 * Authentication Routes
 *
 * Handles Keycloak OIDC authentication flow:
 * - /auth/login - Initiate login (redirect to Keycloak)
 * - /auth/callback - Handle Keycloak callback
 * - /auth/logout - Logout (destroy session, redirect to Keycloak logout)
 * - /auth/me - Get current user info (for SPA bootstrap)
 */

import { Router, Request, Response } from 'express';
import { authConfig } from '../shared/config';
import {
  generateState,
  generateNonce,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getEndSessionUrl,
  storeOidcFlowState,
  getOidcFlowState,
  createSessionFromTokens,
  destroySession,
  getAuthMeData,
  getIdToken,
  isSessionAuthenticated,
} from '../services/auth';

const router = Router();

const ADMIN_USER = process.env.WHATSAPP_SERVICE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.WHATSAPP_SERVICE_ADMIN_PASSWORD || '';

/** Simple HTML login form rendered when Keycloak is disabled */
function renderLoginForm(error?: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign In</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:2rem;width:100%;max-width:380px}h1{font-size:1.25rem;font-weight:700;color:#111;margin-bottom:.5rem}p{color:#6b7280;font-size:.875rem;margin-bottom:1.5rem}.field{margin-bottom:1rem}label{display:block;font-size:.875rem;font-weight:500;color:#374151;margin-bottom:.375rem}input{width:100%;padding:.625rem .75rem;border:1px solid #d1d5db;border-radius:8px;font-size:.875rem;outline:none}input:focus{border-color:#10b981;box-shadow:0 0 0 2px rgba(16,185,129,.2)}button{width:100%;padding:.75rem;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;margin-top:.5rem}button:hover{background:#059669}.error{background:#fef2f2;color:#dc2626;font-size:.875rem;padding:.625rem .75rem;border-radius:8px;margin-bottom:1rem}</style></head><body><div class="card"><h1>WhatsApp Dashboard</h1><p>Sign in with your admin credentials</p>${error ? `<div class="error">${error}</div>` : ''}<form method="POST" action="/auth/login"><div class="field"><label for="username">Username</label><input id="username" name="username" type="text" autocomplete="username" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button type="submit">Sign In</button></form></div></body></html>`;
}

/**
 * GET /auth/login
 * Initiate OIDC login flow — or show admin form when Keycloak is disabled
 */
router.get('/login', (req: Request, res: Response) => {
  // If already authenticated, redirect to returnTo or dashboard root
  if (isSessionAuthenticated(req)) {
    const returnTo = req.query.returnTo as string || '/';
    res.redirect(returnTo);
    return;
  }

  // When Keycloak is disabled, show a simple admin login form
  if (!authConfig.enabled) {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderLoginForm());
    return;
  }

  // Generate OIDC state and nonce
  const state = generateState();
  const nonce = generateNonce();

  // Get return URL from query or default to root
  const returnTo = req.query.returnTo as string || '/';

  // Store in session
  storeOidcFlowState(req, state, nonce, returnTo);

  // Redirect to Keycloak
  const authUrl = getAuthorizationUrl(state, nonce);

  console.log(`🔐 Redirecting to Keycloak login: ${authUrl}`);
  res.redirect(authUrl);
});

/**
 * POST /auth/login
 * Handle admin form submission when Keycloak is disabled
 */
router.post('/login', (req: Request, res: Response) => {
  if (authConfig.enabled) {
    res.status(405).json({ success: false, error: 'Use OIDC flow' });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password || username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderLoginForm('Invalid username or password'));
    return;
  }

  // Create admin session directly
  if (!req.session) {
    res.status(500).json({ success: false, error: 'Session middleware not configured. Set ENABLE_KEYCLOAK_AUTH=true or configure session store.' });
    return;
  }
  req.session.user = { sub: 'admin', email: `${ADMIN_USER}@local`, name: ADMIN_USER, username: ADMIN_USER };
  req.session.roles = ['tenant_admin', 'agent', 'automation_engineer'];
  req.session.organizationId = null;
  req.session.organizationName = undefined;

  req.session.save(() => {
    res.redirect('/');
  });
});

/**
 * GET /auth/callback
 * Handle Keycloak callback - exchange code for tokens
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, iss, error, error_description } = req.query;

    // Handle Keycloak error responses
    if (error) {
      console.error(`Keycloak error: ${error} - ${error_description}`);
      res.status(400).json({
        success: false,
        error: 'Authentication failed',
        details: error_description || error,
      });
      return;
    }

    // Validate required parameters
    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing authorization code',
      });
      return;
    }

    if (!state || typeof state !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing state parameter',
      });
      return;
    }

    // Get stored OIDC flow state
    const storedState = getOidcFlowState(req);

    if (!storedState.state || !storedState.nonce) {
      res.status(400).json({
        success: false,
        error: 'Session state not found. Please try logging in again.',
      });
      return;
    }

    // Exchange code for tokens (validates state, nonce, and iss)
    const tokenSet = await exchangeCodeForTokens(
      code,
      state,
      storedState.state,
      storedState.nonce,
      typeof iss === 'string' ? iss : undefined
    );

    // Create session from tokens
    createSessionFromTokens(req, tokenSet);

    console.log(`✅ User authenticated: ${req.session.user?.email || req.session.user?.sub}`);

    // Redirect to original URL or admin
    const returnTo = storedState.returnTo || '/service/admin';
    res.redirect(returnTo);
  } catch (error) {
    console.error('OIDC callback error:', error);

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('State mismatch')) {
      res.status(400).json({
        success: false,
        error: 'State validation failed. Please try logging in again.',
        code: 'STATE_MISMATCH',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: errorMessage,
    });
  }
});

/**
 * POST /auth/logout
 * Logout - destroy session and optionally redirect to Keycloak logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Get ID token before destroying session (needed for Keycloak logout)
    const idToken = getIdToken(req);

    // Destroy session
    await destroySession(req);

    // Clear session cookie
    res.clearCookie('sid', { path: '/' });

    // Check if client wants Keycloak logout (full logout)
    const fullLogout = req.query.fullLogout !== 'false';

    if (fullLogout && idToken) {
      // Redirect to Keycloak logout
      const logoutUrl = getEndSessionUrl(idToken);
      res.json({
        success: true,
        message: 'Session destroyed',
        logoutUrl, // Client can redirect to this URL for full logout
      });
    } else {
      res.json({
        success: true,
        message: 'Session destroyed',
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

/**
 * GET /auth/logout
 * Logout with redirect - for simple link-based logout
 */
router.get('/logout', async (req: Request, res: Response) => {
  try {
    // Get ID token before destroying session
    const idToken = getIdToken(req);

    // Destroy session
    await destroySession(req);

    // Clear session cookie
    res.clearCookie('sid', { path: '/' });

    // Redirect to Keycloak logout
    if (idToken) {
      const logoutUrl = getEndSessionUrl(idToken);
      res.redirect(logoutUrl);
    } else {
      // No ID token, just redirect to login
      res.redirect('/auth/login');
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/auth/login');
  }
});

/**
 * GET /auth/logout/callback
 * Post-logout redirect from Keycloak
 */
router.get('/logout/callback', (_req: Request, res: Response) => {
  // Redirect to login or home page
  res.redirect('/auth/login');
});

/**
 * GET /auth/me
 * Get current user info (for SPA bootstrap)
 * Returns authenticated: false if not logged in (no redirect)
 */
router.get('/me', (req: Request, res: Response) => {
  const authData = getAuthMeData(req);
  res.json(authData);
});

/**
 * GET /auth/status
 * Simple auth status check (alias for /auth/me)
 */
router.get('/status', (req: Request, res: Response) => {
  const authData = getAuthMeData(req);
  res.json(authData);
});

export { router as authRouter };

/**
 * Initialize auth routes (no-op for now, but maintains consistency with other route modules)
 */
export function initAuthRoutes(): void {
  if (!authConfig.enabled) {
    console.log('ℹ️  Auth routes disabled (ENABLE_KEYCLOAK_AUTH not set)');
    return;
  }
  console.log('✅ Auth routes initialized');
  console.log(`   Callback URL: ${authConfig.baseUrl}/auth/callback`);
}
