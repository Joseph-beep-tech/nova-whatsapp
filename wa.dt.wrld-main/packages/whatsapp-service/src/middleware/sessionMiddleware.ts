/**
 * Session Middleware
 *
 * Configures express-session with Redis store for session persistence.
 * Sessions are used for Keycloak OIDC authentication (BFF pattern).
 */

import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import { RequestHandler } from 'express';
import { authConfig, queueConfig, isProduction } from '../shared/config';

/** Redis client for session store */
let redisClient: Redis | null = null;

/**
 * Initialize Redis client for session store
 */
async function initializeRedisClient(): Promise<Redis> {
  const redisUrl = queueConfig.redisUrl;

  console.log(`🔌 Connecting to Redis for sessions: ${redisUrl}`);

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by connect-redis
    enableReadyCheck: false,
  });

  client.on('error', (err: Error) => {
    console.error('Session Redis client error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Session Redis client connected');
  });

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', (err: Error) => reject(err));
  });

  return client;
}

/**
 * Create session middleware with Redis store
 */
export async function createSessionMiddleware(): Promise<RequestHandler> {
  // Initialize Redis client
  redisClient = await initializeRedisClient();

  // Create Redis store
  const store = new RedisStore({
    client: redisClient,
    prefix: 'whatsapp-service:session:',
    ttl: authConfig.sessionTtlSeconds,
  });

  // Create session middleware
  return session({
    store,
    name: 'sid',
    secret: authConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on each request
    cookie: {
      secure: isProduction, // Require HTTPS in production
      httpOnly: true, // Prevent JavaScript access
      sameSite: 'lax', // CSRF protection
      maxAge: authConfig.sessionTtlSeconds * 1000,
      path: '/',
    },
  });
}

/**
 * Get the Redis client (for health checks)
 */
export function getSessionRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Check if session Redis is connected
 */
export function isSessionRedisConnected(): boolean {
  return redisClient?.status === 'ready';
}

/**
 * Close session Redis connection (for graceful shutdown)
 */
export async function closeSessionRedis(): Promise<void> {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.quit();
    console.log('✅ Session Redis client closed');
  }
}
