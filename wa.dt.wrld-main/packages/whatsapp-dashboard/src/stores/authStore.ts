import { create } from 'zustand'
import type { AuthState, AuthUser, Role } from '@/types'
import { USE_MOCK_API } from '@/lib/config'

// Use mock auth when mock API is enabled
const USE_MOCK_AUTH = USE_MOCK_API

const MOCK_AUTH_STATE: AuthState = {
  authenticated: true,
  user: {
    id: 'user-1',
    email: 'agent@example.com',
    name: 'Test Agent',
  },
  roles: ['agent', 'automation_engineer'],
  organizationId: 'org-1',
  organizationName: 'Test Organization',
}

interface AuthStore extends AuthState {
  // Loading state
  isLoading: boolean
  error: string | null

  // Actions
  checkAuth: () => Promise<void>
  login: () => void
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  setRoles: (roles: Role[]) => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  authenticated: false,
  user: null,
  roles: [],
  organizationId: null,
  organizationName: null,
  isLoading: true,
  error: null,

  // Check authentication status by calling /auth/me
  checkAuth: async () => {
    set({ isLoading: true, error: null })

    if (USE_MOCK_AUTH) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300))
      set({
        ...MOCK_AUTH_STATE,
        isLoading: false,
      })
      return
    }

    try {
      const response = await fetch('/auth/me', {
        credentials: 'include',
      })

      if (response.status === 401) {
        // Not authenticated
        set({
          authenticated: false,
          user: null,
          roles: [],
          organizationId: null,
          organizationName: null,
          isLoading: false,
        })
        return
      }

      if (!response.ok) {
        throw new Error(`Auth check failed: ${response.status}`)
      }

      const data: AuthState = await response.json()
      set({
        authenticated: data.authenticated,
        user: data.user ?? null,
        roles: data.roles ?? [],
        organizationId: data.organizationId ?? null,
        organizationName: data.organizationName ?? null,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication check failed'
      set({
        authenticated: false,
        user: null,
        roles: [],
        isLoading: false,
        error: message,
      })
    }
  },

  // Redirect to login page
  login: () => {
    if (USE_MOCK_AUTH) {
      // In mock mode, just set authenticated
      set({ ...MOCK_AUTH_STATE })
      return
    }
    // Redirect to Keycloak login
    window.location.href = '/auth/login'
  },

  // Logout and clear session
  logout: async () => {
    if (USE_MOCK_AUTH) {
      set({
        authenticated: false,
        user: null,
        roles: [],
        organizationId: null,
        organizationName: null,
      })
      return
    }

    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore logout errors
    }

    set({
      authenticated: false,
      user: null,
      roles: [],
      organizationId: null,
      organizationName: null,
    })

    // Redirect to login
    window.location.href = '/auth/login'
  },

  // Set user directly (for real-time updates)
  setUser: (user) => {
    set({ user, authenticated: user !== null })
  },

  // Set roles directly
  setRoles: (roles) => {
    set({ roles })
  },

  // Clear error
  clearError: () => {
    set({ error: null })
  },
}))

// Selector hooks for common use cases
export const useAuth = () => useAuthStore((state) => ({
  user: state.user,
  roles: state.roles,
  authenticated: state.authenticated,
  organizationId: state.organizationId,
  organizationName: state.organizationName,
}))

export const useAuthLoading = () => useAuthStore((state) => state.isLoading)

export const useAuthError = () => useAuthStore((state) => state.error)
