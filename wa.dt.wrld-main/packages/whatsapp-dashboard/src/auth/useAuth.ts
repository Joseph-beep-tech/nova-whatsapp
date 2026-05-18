import { useAuthContext } from './AuthProvider'
import type { Role } from '@/types'
import { hasAnyRole, hasRole } from '@/types'

/**
 * Hook to access auth state and helpers.
 *
 * Usage:
 * ```tsx
 * const { user, roles, isAdmin, canAccess } = useAuth()
 *
 * // Check specific roles
 * if (canAccess(['tenant_admin'])) {
 *   // show admin UI
 * }
 *
 * // Check minimum role
 * if (isAtLeast('automation_engineer')) {
 *   // show engineer features
 * }
 * ```
 */
export function useAuth() {
  const context = useAuthContext()

  return {
    // Auth state
    user: context.user,
    roles: context.roles,
    authenticated: context.authenticated,
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    isLoading: context.isLoading,
    error: context.error,

    // Actions
    login: context.login,
    logout: context.logout,

    // Role helpers
    /** Check if user has any of the specified roles */
    canAccess: (requiredRoles: Role[]) => hasAnyRole(context.roles, requiredRoles),

    /** Check if user has at least the specified role (hierarchy-based) */
    isAtLeast: (minRole: Role) => hasRole(context.roles, minRole),

    // Convenience role checks
    isAgent: context.roles?.includes('agent') ?? false,
    isAutomationEngineer: context.roles?.includes('automation_engineer') ?? false,
    isTenantAdmin: context.roles?.includes('tenant_admin') ?? false,
    isCreatorAdmin: context.roles?.includes('creator_admin') ?? false,

    /** Check if user has any admin role */
    isAdmin: (context.roles?.includes('tenant_admin') || context.roles?.includes('creator_admin')) ?? false,
  }
}
