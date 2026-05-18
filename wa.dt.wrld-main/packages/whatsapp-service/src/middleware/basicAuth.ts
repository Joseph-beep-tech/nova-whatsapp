/**
 * Basic Authentication Middleware
 *
 * Simple username/password authentication for admin UI routes.
 * Credentials are set via environment variables.
 */

import { Request, Response, NextFunction } from 'express';

const ADMIN_USERNAME = process.env.WHATSAPP_SERVICE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.WHATSAPP_SERVICE_ADMIN_PASSWORD || '';

// Warn if default credentials are being used
if (!process.env.WHATSAPP_SERVICE_ADMIN_PASSWORD) {
  console.warn('⚠️  WARNING: WHATSAPP_SERVICE_ADMIN_PASSWORD not set. Admin UI will be disabled.');
}

/**
 * Basic HTTP Authentication middleware
 */
export const requireBasicAuth = (req: Request, res: Response, next: NextFunction) => {
  // If no password is set, deny access
  if (!ADMIN_PASSWORD) {
    return res.status(401).send('Admin UI is disabled. Set WHATSAPP_SERVICE_ADMIN_PASSWORD to enable.');
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp n8n Service Admin"');
    return res.status(401).send('Authentication required');
  }

  try {
    // Decode base64 credentials
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Validate credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return next();
    }

    // Invalid credentials
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp n8n Service Admin"');
    return res.status(401).send('Invalid credentials');
  } catch (error) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp n8n Service Admin"');
    return res.status(401).send('Authentication failed');
  }
};

/**
 * Sanitize input string
 */
export const sanitizeInput = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 255);
};
