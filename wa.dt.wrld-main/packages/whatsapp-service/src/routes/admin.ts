/**
 * Admin UI Routes
 *
 * Serves admin UI pages for sessions and logs.
 * Protected by Keycloak OIDC auth (when enabled) or Basic Auth (fallback).
 */

import { Router, Request, Response, RequestHandler } from 'express';
import path from 'path';
import { authConfig } from '../shared/config';
import { requireBasicAuth } from '../middleware/basicAuth';
import { requireSession } from '../middleware/oidcAuth';

const router = Router();

/**
 * Get the appropriate auth middleware based on configuration
 * Uses Keycloak when enabled, falls back to Basic Auth
 */
function getAdminAuthMiddleware(): RequestHandler {
  if (authConfig.enabled) {
    return requireSession as RequestHandler;
  }
  return requireBasicAuth;
}

// Get the auth middleware once at module load
const adminAuth = getAdminAuthMiddleware();

/**
 * Sessions view
 * GET /admin/sessions
 */
router.get('/admin/sessions', adminAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/views/sessions.html'));
});

/**
 * Logs view
 * GET /admin/logs
 */
router.get('/admin/logs', adminAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/views/logs.html'));
});

/**
 * Admin redirect (default to sessions)
 * GET /admin
 */
router.get('/admin', adminAuth, (_req: Request, res: Response) => {
  res.redirect('/service/admin/sessions');
});

/**
 * Serve Tailwind CSS stylesheet
 * GET /admin/styles.css
 * Note: CSS is served without auth to allow styling on login redirect
 */
router.get('/admin/styles.css', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, '../../src/views/styles.css'));
});

export { router as adminRouter };
