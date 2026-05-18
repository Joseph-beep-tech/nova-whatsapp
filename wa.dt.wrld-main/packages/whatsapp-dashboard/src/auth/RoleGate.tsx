import type { ReactNode } from 'react'
import { useAuthContext } from './AuthProvider'
import type { Role } from '@/types'
import { hasAnyRole, hasRole } from '@/types'

interface RoleGateProps {
  children: ReactNode
  /** Roles that can view this content (user needs ANY of these) */
  roles?: Role[]
  /** Minimum role required (user needs this role or higher in hierarchy) */
  minRole?: Role
  /** Content to show if user doesn't have required role (optional) */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on user roles.
 *
 * Usage:
 * ```tsx
 * // Show only to tenant_admin or creator_admin
 * <RoleGate roles={['tenant_admin', 'creator_admin']}>
 *   <AdminOnlyWidget />
 * </RoleGate>
 *
 * // Show only to users with at least automation_engineer role
 * <RoleGate minRole="automation_engineer">
 *   <EngineerFeature />
 * </RoleGate>
 *
 * // With fallback content
 * <RoleGate roles={['tenant_admin']} fallback={<p>Upgrade to access</p>}>
 *   <AdminFeature />
 * </RoleGate>
 * ```
 */
export function RoleGate({ children, roles, minRole, fallback = null }: RoleGateProps) {
  const { roles: userRoles, authenticated } = useAuthContext()

  // Must be authenticated
  if (!authenticated) {
    return <>{fallback}</>
  }

  // Check minimum role (hierarchy-based)
  if (minRole && !hasRole(userRoles, minRole)) {
    return <>{fallback}</>
  }

  // Check specific roles
  if (roles && roles.length > 0 && !hasAnyRole(userRoles, roles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
