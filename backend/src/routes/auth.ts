import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

// Demo login - creates a real DB user so all routes work
router.post('/demo-login', async (req: AuthRequest, res: Response) => {
  try {
    const email = req.body?.email || 'demo@azizi.local';
    console.log('[Demo Login] Request received for:', email);

    try {
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        const hashed = await bcrypt.hash('demo-password-' + Date.now(), 10);
        user = await prisma.user.create({
          data: {
            email,
            password: hashed,
            firstName: 'Demo',
            lastName: 'User',
            role: 'admin',
          },
        });
        console.log('[Demo Login] Created new demo user in DB');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      console.log('[Demo Login] Token generated with DB userId:', user.id);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (dbError: any) {
      // Fallback: no database — use stable string ID
      const stableId = 'demo-' + email.replace(/[^a-zA-Z0-9]/g, '_');
      const token = jwt.sign(
        { userId: stableId, email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      console.log('[Demo Login] Token generated (no DB) with stableId:', stableId);

      return res.json({
        token,
        user: {
          id: stableId,
          email,
          firstName: 'Demo',
          lastName: 'User',
        },
      });
    }
  } catch (error: any) {
    console.error('[Demo Login] Error:', error);
    res.status(500).json({ error: 'Demo login failed: ' + error.message });
  }
});

// Register
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          firstName,
          lastName,
        },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (dbError: any) {
      if (dbError.message?.includes('ECONNREFUSED')) {
        return res.status(503).json({ error: 'Database connection failed. Please try again later.' });
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (dbError: any) {
      if (dbError.message?.includes('ECONNREFUSED')) {
        return res.status(503).json({ error: 'Database connection failed. Please try again later.' });
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Keycloak token exchange
router.post('/keycloak', async (req: AuthRequest, res: Response) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Authorization code and redirect URI are required' });
    }

    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'azizi';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'azizi-voice-portal';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';

    const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const err: any = await tokenResponse.json().catch(() => ({}));
      console.error('[Keycloak] Token exchange failed:', err);
      return res.status(401).json({ error: err.error_description || 'Keycloak authentication failed' });
    }

    const tokens: any = await tokenResponse.json();

    const userInfoUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/userinfo`;
    const userInfoResponse = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return res.status(401).json({ error: 'Failed to get user info from Keycloak' });
    }

    const kcUser: any = await userInfoResponse.json();
    const email = kcUser.email || kcUser.preferred_username;
    const firstName = kcUser.given_name || kcUser.preferred_username || 'User';
    const lastName = kcUser.family_name || '';

    if (!email) {
      return res.status(400).json({ error: 'No email found in Keycloak user info' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const hashed = await bcrypt.hash('keycloak-' + Date.now(), 10);
      user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          firstName,
          lastName,
          role: 'user',
        },
      });
      console.log('[Keycloak] Created new user:', email);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: any) {
    console.error('[Keycloak] Error:', error);
    res.status(500).json({ error: 'Keycloak login failed: ' + error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: user.organization,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
