import { useEffect, createContext, useContext, type ReactNode } from 'react'
import { useAuthStore, useAuth, useAuthLoading, useAuthError } from '@/stores/authStore'
import type { AuthUser, Role } from '@/types'
import { Loader2 } from 'lucide-react'

// Auth context value type
interface AuthContextValue {
  user: AuthUser | null
  roles: Role[]
  authenticated: boolean
  organizationId: string | null
  organizationName: string | null
  isLoading: boolean
  error: string | null
  login: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const checkAuth = useAuthStore((state) => state.checkAuth)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const auth = useAuth()
  const isLoading = useAuthLoading()
  const error = useAuthError()

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-whatsapp-teal animate-spin mx-auto" />
          <p className="mt-3 text-sm text-surface-500">Loading...</p>
        </div>
      </div>
    )
  }

  const value: AuthContextValue = {
    ...auth,
    isLoading,
    error,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
