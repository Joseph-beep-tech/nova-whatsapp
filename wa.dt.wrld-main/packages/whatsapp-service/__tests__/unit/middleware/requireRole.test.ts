/**
 * Role-Based Access Control Middleware Tests
 */

// Set up env before imports
process.env.API_KEY = 'test-api-key';

import { Request, Response } from 'express';
import {
  requireAnyRole,
  requireAllRoles,
  requireSuperAdmin,
  requireTenantAdmin,
  requireAgent,
  requireTenantAccess,
} from '../../../src/middleware/requireRole';
import { UserRole, AuthContext } from '../../../src/types/auth';

describe('RBAC Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  const createAuthContext = (roles: UserRole[], organizationId: string | null = 'org-123'): AuthContext => ({
    sub: 'user-123',
    email: 'test@example.com',
    roles,
    organizationId,
    sessionId: 'session-123',
    expiresAt: Date.now() + 3600000,
  });

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe('requireAnyRole', () => {
    it('should return 401 when auth context is missing', () => {
      const middleware = requireAnyRole('agent', 'tenant_admin');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks required roles', () => {
      mockRequest.auth = createAuthContext(['read_only']);
      const middleware = requireAnyRole('agent', 'tenant_admin');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: ['agent', 'tenant_admin'],
        userRoles: ['read_only'],
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of the required roles', () => {
      mockRequest.auth = createAuthContext(['agent']);
      const middleware = requireAnyRole('agent', 'tenant_admin');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should call next() when user has multiple matching roles', () => {
      mockRequest.auth = createAuthContext(['agent', 'tenant_admin']);
      const middleware = requireAnyRole('agent', 'tenant_admin');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireAllRoles', () => {
    it('should return 403 when user has only some required roles', () => {
      mockRequest.auth = createAuthContext(['agent']);
      const middleware = requireAllRoles('agent', 'automation_engineer');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() when user has all required roles', () => {
      mockRequest.auth = createAuthContext(['agent', 'automation_engineer']);
      const middleware = requireAllRoles('agent', 'automation_engineer');

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('should return 403 for non-super-admin', () => {
      mockRequest.auth = createAuthContext(['tenant_admin']);

      requireSuperAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Super admin access required',
        code: 'FORBIDDEN',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() for creator_admin', () => {
      mockRequest.auth = createAuthContext(['creator_admin']);

      requireSuperAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireTenantAdmin', () => {
    it('should allow tenant_admin', () => {
      mockRequest.auth = createAuthContext(['tenant_admin']);

      requireTenantAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow creator_admin', () => {
      mockRequest.auth = createAuthContext(['creator_admin']);

      requireTenantAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject agent', () => {
      mockRequest.auth = createAuthContext(['agent']);

      requireTenantAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireAgent', () => {
    it('should allow agent', () => {
      mockRequest.auth = createAuthContext(['agent']);

      requireAgent(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow tenant_admin', () => {
      mockRequest.auth = createAuthContext(['tenant_admin']);

      requireAgent(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject read_only', () => {
      mockRequest.auth = createAuthContext(['read_only']);

      requireAgent(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireTenantAccess', () => {
    const getTenantIdFromParams = (req: Request): string | null => {
      return (req.params as { tenantId?: string })?.tenantId || null;
    };

    it('should allow super admin to access any tenant', () => {
      mockRequest.auth = createAuthContext(['creator_admin'], 'org-123');
      mockRequest.params = { tenantId: 'different-org' };
      const middleware = requireTenantAccess(getTenantIdFromParams);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow user to access their own tenant', () => {
      mockRequest.auth = createAuthContext(['tenant_admin'], 'org-123');
      mockRequest.params = { tenantId: 'org-123' };
      const middleware = requireTenantAccess(getTenantIdFromParams);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject user accessing different tenant', () => {
      mockRequest.auth = createAuthContext(['tenant_admin'], 'org-123');
      mockRequest.params = { tenantId: 'different-org' };
      const middleware = requireTenantAccess(getTenantIdFromParams);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied to this tenant',
        code: 'FORBIDDEN',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow access when no tenant specified', () => {
      mockRequest.auth = createAuthContext(['agent'], 'org-123');
      mockRequest.params = {};
      const middleware = requireTenantAccess(getTenantIdFromParams);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
