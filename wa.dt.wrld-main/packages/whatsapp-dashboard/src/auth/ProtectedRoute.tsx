import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
import type { Role } from '@/types'
import { hasAnyRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: Role[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { authenticated, roles } = useAuthContext()
  const location = useLocation()

  // If not authenticated, redirect to login
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If roles are required, check if user has any of them
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = hasAnyRole(roles, requiredRoles)

    if (!hasRequiredRole) {
      // Redirect to unauthorized page or show error
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <h1 className="text-2xl font-semibold text-surface-900 mb-2">Access Denied</h1>
            <p className="text-surface-500 mb-4">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-surface-400">
              Required roles: {requiredRoles.join(', ')}
            </p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
