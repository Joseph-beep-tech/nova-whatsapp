/**
 * OIDC Authentication Middleware Tests
 */

import { Request, Response } from 'express';
import { requireSession, requireSessionApi, loadAuthContext, isAuthenticated, getTenantId, getUserId } from '../../../src/middleware/oidcAuth';
import { authConfig } from '../../../src/shared/config';

// Mock the auth services
jest.mock('../../../src/services/auth', () => ({
  isSessionAuthenticated: jest.fn(),
  refreshSessionIfNeeded: jest.fn(),
  generateState: jest.fn(() => 'mock-state'),
  generateNonce: jest.fn(() => 'mock-nonce'),
  getAuthorizationUrl: jest.fn(() => 'https://keycloak.example.com/auth'),
  storeOidcFlowState: jest.fn(),
}));

jest.mock('../../../src/services/auth/tokenService', () => ({
  buildAuthContext: jest.fn(),
}));

// Mock config
jest.mock('../../../src/shared/config', () => ({
  authConfig: {
    enabled: true,
    issuerUrl: 'https://keycloak.example.com/realms/test',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    baseUrl: 'http://localhost:3001',
    sessionSecret: 'test-secret',
    sessionTtlSeconds: 86400,
    tokenRefreshThreshold: 300,
    scopes: ['openid', 'profile', 'email'],
  },
  queueConfig: {
    redisUrl: 'redis://localhost:6379',
  },
  isProduction: false,
}));

describe('OIDC Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      originalUrl: '/service/admin/sessions',
      session: {} as Request['session'],
      sessionID: 'test-session-id',
    };
    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireSession', () => {
    const { isSessionAuthenticated, refreshSessionIfNeeded, storeOidcFlowState } = require('../../../src/services/auth');
    const { buildAuthContext } = require('../../../src/services/auth/tokenService');

    it('should call next() when auth is disabled', async () => {
      // Temporarily disable auth
      const originalEnabled = authConfig.enabled;
      (authConfig as { enabled: boolean }).enabled = false;

      await requireSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      (authConfig as { enabled: boolean }).enabled = originalEnabled;
    });

    it('should redirect to login when not authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(false);

      await requireSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(storeOidcFlowState).toHaveBeenCalledWith(
        mockRequest,
        'mock-state',
        'mock-nonce',
        '/service/admin/sessions'
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith('https://keycloak.example.com/auth');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should redirect to login when session refresh fails', async () => {
      isSessionAuthenticated.mockReturnValue(true);
      refreshSessionIfNeeded.mockResolvedValue(false);

      await requireSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith('https://keycloak.example.com/auth');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() and attach auth context when authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(true);
      refreshSessionIfNeeded.mockResolvedValue(true);
      buildAuthContext.mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['tenant_admin'],
        organizationId: 'org-123',
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      });

      await requireSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.auth).toBeDefined();
      expect(mockRequest.auth?.sub).toBe('user-123');
    });
  });

  describe('requireSessionApi', () => {
    const { isSessionAuthenticated, refreshSessionIfNeeded } = require('../../../src/services/auth');
    const { buildAuthContext } = require('../../../src/services/auth/tokenService');

    it('should return 401 when not authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(false);

      await requireSessionApi(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when session expired', async () => {
      isSessionAuthenticated.mockReturnValue(true);
      refreshSessionIfNeeded.mockResolvedValue(false);

      await requireSessionApi(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() when authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(true);
      refreshSessionIfNeeded.mockResolvedValue(true);
      buildAuthContext.mockReturnValue({
        sub: 'user-123',
        roles: ['agent'],
        organizationId: 'org-123',
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      });

      await requireSessionApi(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.auth).toBeDefined();
    });
  });

  describe('loadAuthContext', () => {
    const { isSessionAuthenticated, refreshSessionIfNeeded } = require('../../../src/services/auth');
    const { buildAuthContext } = require('../../../src/services/auth/tokenService');

    it('should call next() without auth when not authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(false);

      await loadAuthContext(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.auth).toBeUndefined();
    });

    it('should load auth context when authenticated', async () => {
      isSessionAuthenticated.mockReturnValue(true);
      refreshSessionIfNeeded.mockResolvedValue(true);
      buildAuthContext.mockReturnValue({
        sub: 'user-123',
        roles: ['read_only'],
        organizationId: 'org-123',
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      });

      await loadAuthContext(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.auth).toBeDefined();
      expect(mockRequest.auth?.roles).toContain('read_only');
    });
  });

  describe('Helper functions', () => {
    it('isAuthenticated should return true when auth context exists', () => {
      mockRequest.auth = {
        sub: 'user-123',
        roles: ['agent'],
        organizationId: 'org-123',
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      };

      expect(isAuthenticated(mockRequest as Request)).toBe(true);
    });

    it('isAuthenticated should return false when auth context missing', () => {
      expect(isAuthenticated(mockRequest as Request)).toBe(false);
    });

    it('getTenantId should return organization ID', () => {
      mockRequest.auth = {
        sub: 'user-123',
        roles: [],
        organizationId: 'org-123',
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      };

      expect(getTenantId(mockRequest as Request)).toBe('org-123');
    });

    it('getTenantId should return null when not authenticated', () => {
      expect(getTenantId(mockRequest as Request)).toBeNull();
    });

    it('getUserId should return sub', () => {
      mockRequest.auth = {
        sub: 'user-123',
        roles: [],
        organizationId: null,
        sessionId: 'test-session-id',
        expiresAt: Date.now() + 3600000,
      };

      expect(getUserId(mockRequest as Request)).toBe('user-123');
    });

    it('getUserId should return null when not authenticated', () => {
      expect(getUserId(mockRequest as Request)).toBeNull();
    });
  });
});
