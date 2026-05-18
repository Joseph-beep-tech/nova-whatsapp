/**
 * Role-Based Access Control Middleware
 *
 * Provides middleware for enforcing role requirements on routes.
 * Must be used after requireSession or requireSessionApi middleware.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/auth';
import { hasAnyRole, hasAllRoles, isSuperAdmin } from '../services/auth/tokenService';

/**
 * Middleware that requires the user to have at least one of the specified roles
 */
export function requireAnyRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if auth context exists
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    // Check if user has any of the required roles
    if (!hasAnyRole(req.auth.roles, roles)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        userRoles: req.auth.roles,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires the user to have all of the specified roles
 */
export function requireAllRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if auth context exists
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    // Check if user has all of the required roles
    if (!hasAllRoles(req.auth.roles, roles)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        userRoles: req.auth.roles,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires creator_admin role (super admin)
 */
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  if (!isSuperAdmin(req.auth.roles)) {
    res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
};

/**
 * Middleware that requires tenant admin or higher (tenant_admin or creator_admin)
 */
export const requireTenantAdmin = requireAnyRole('creator_admin', 'tenant_admin');

/**
 * Middleware that requires agent or higher access
 */
export const requireAgent = requireAnyRole('creator_admin', 'tenant_admin', 'agent');

/**
 * Middleware that requires automation engineer or higher access
 */
export const requireAutomationEngineer = requireAnyRole(
  'creator_admin',
  'tenant_admin',
  'automation_engineer'
);

/**
 * Middleware that requires any authenticated role (not read_only)
 */
export const requireWriteAccess = requireAnyRole(
  'creator_admin',
  'tenant_admin',
  'agent',
  'automation_engineer'
);

/**
 * Middleware that validates tenant access
 * User must either be a super admin or belong to the specified tenant
 */
export function requireTenantAccess(getTenantId: (req: Request) => string | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const targetTenantId = getTenantId(req);

    // Super admins can access any tenant
    if (isSuperAdmin(req.auth.roles)) {
      return next();
    }

    // Other users can only access their own tenant
    if (targetTenantId && req.auth.organizationId !== targetTenantId) {
      res.status(403).json({
        success: false,
        error: 'Access denied to this tenant',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
