import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'

// Note: The authStore has USE_MOCK_AUTH = true by default
// For these tests, we need to test both mock mode and real API mode
// We'll test the state management directly and use MSW for API testing

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      authenticated: false,
      user: null,
      roles: [],
      organizationId: null,
      organizationName: null,
      isLoading: true,
      error: null,
    })
  })

  describe('initial state', () => {
    it('starts with unauthenticated state', () => {
      const state = useAuthStore.getState()
      expect(state.authenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.roles).toEqual([])
      expect(state.isLoading).toBe(true)
    })
  })

  describe('setUser', () => {
    it('sets user and marks as authenticated', () => {
      const { setUser } = useAuthStore.getState()
      const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' }

      setUser(user)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.authenticated).toBe(true)
    })

    it('clears user and marks as unauthenticated when null', () => {
      const { setUser } = useAuthStore.getState()

      // First set a user
      setUser({ id: 'user-1', email: 'test@example.com', name: 'Test User' })
      expect(useAuthStore.getState().authenticated).toBe(true)

      // Then clear
      setUser(null)

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.authenticated).toBe(false)
    })
  })

  describe('setRoles', () => {
    it('sets roles correctly', () => {
      const { setRoles } = useAuthStore.getState()

      setRoles(['agent', 'automation_engineer'])

      expect(useAuthStore.getState().roles).toEqual(['agent', 'automation_engineer'])
    })

    it('can set empty roles array', () => {
      const { setRoles } = useAuthStore.getState()

      setRoles(['agent'])
      setRoles([])

      expect(useAuthStore.getState().roles).toEqual([])
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      // Set an error
      useAuthStore.setState({ error: 'Test error' })
      expect(useAuthStore.getState().error).toBe('Test error')

      // Clear it
      const { clearError } = useAuthStore.getState()
      clearError()

      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('selector hooks', () => {
    it('useAuth selector returns auth data', () => {
      useAuthStore.setState({
        authenticated: true,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        roles: ['agent'],
        organizationId: 'org-1',
        organizationName: 'Test Org',
      })

      // Get state to simulate the selector
      const state = useAuthStore.getState()
      const authData = {
        user: state.user,
        roles: state.roles,
        authenticated: state.authenticated,
        organizationId: state.organizationId,
        organizationName: state.organizationName,
      }

      expect(authData.authenticated).toBe(true)
      expect(authData.user?.email).toBe('test@example.com')
      expect(authData.roles).toEqual(['agent'])
      expect(authData.organizationId).toBe('org-1')
    })

    it('useAuthLoading selector returns loading state', () => {
      useAuthStore.setState({ isLoading: true })
      expect(useAuthStore.getState().isLoading).toBe(true)

      useAuthStore.setState({ isLoading: false })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('useAuthError selector returns error state', () => {
      useAuthStore.setState({ error: 'Auth failed' })
      expect(useAuthStore.getState().error).toBe('Auth failed')

      useAuthStore.setState({ error: null })
      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('checkAuth (with mock mode)', () => {
    // Note: The actual checkAuth uses USE_MOCK_AUTH = true
    // So it will always return the mock state after a delay
    // These tests verify the store behavior works correctly

    it('sets loading state while checking', async () => {
      const { checkAuth } = useAuthStore.getState()

      // Start auth check
      const promise = checkAuth()

      // Should be loading
      expect(useAuthStore.getState().isLoading).toBe(true)

      // Wait for completion
      await promise

      // Should not be loading anymore
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('sets authenticated state after successful check', async () => {
      const { checkAuth } = useAuthStore.getState()

      await checkAuth()

      const state = useAuthStore.getState()
      expect(state.authenticated).toBe(true)
      expect(state.user).not.toBeNull()
      expect(state.roles.length).toBeGreaterThan(0)
    })
  })

  describe('login (with mock mode)', () => {
    it('sets authenticated state in mock mode', () => {
      const { login } = useAuthStore.getState()

      login()

      const state = useAuthStore.getState()
      expect(state.authenticated).toBe(true)
      expect(state.user).not.toBeNull()
    })
  })

  describe('logout (with mock mode)', () => {
    it('clears auth state in mock mode', async () => {
      // First authenticate
      useAuthStore.setState({
        authenticated: true,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        roles: ['agent'],
        organizationId: 'org-1',
        organizationName: 'Test Org',
      })

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.authenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.roles).toEqual([])
      expect(state.organizationId).toBeNull()
    })
  })

  describe('API integration (simulated real mode)', () => {
    // These tests simulate what would happen in real mode
    // by testing the API handlers directly through MSW

    it('handles 401 response for unauthenticated user', async () => {
      // Override the auth/me handler to return 401
      server.use(
        http.get('/auth/me', () => {
          return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 })
        })
      )

      // Simulate what the store would do in real mode
      const response = await fetch('/auth/me', { credentials: 'include' })
      expect(response.status).toBe(401)
    })

    it('returns user data for authenticated user', async () => {
      // Use default handler which returns authenticated state
      const response = await fetch('/auth/me', { credentials: 'include' })
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.authenticated).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('agent@example.com')
    })

    it('handles logout endpoint', async () => {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('handles auth status check', async () => {
      const response = await fetch('/auth/status')
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.keycloakEnabled).toBe(true)
      expect(data.authenticated).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('stores error message on auth failure', () => {
      // Simulate error state
      useAuthStore.setState({
        authenticated: false,
        user: null,
        roles: [],
        isLoading: false,
        error: 'Authentication check failed',
      })

      const state = useAuthStore.getState()
      expect(state.error).toBe('Authentication check failed')
      expect(state.authenticated).toBe(false)
    })

    it('clears error on new auth attempt', () => {
      // Set error state
      useAuthStore.setState({
        error: 'Previous error',
        isLoading: false,
      })

      // Clear error (simulating start of new auth check)
      useAuthStore.setState({
        error: null,
        isLoading: true,
      })

      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('organization data', () => {
    it('stores organization info after auth', () => {
      useAuthStore.setState({
        authenticated: true,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        roles: ['agent'],
        organizationId: 'org-123',
        organizationName: 'My Organization',
      })

      const state = useAuthStore.getState()
      expect(state.organizationId).toBe('org-123')
      expect(state.organizationName).toBe('My Organization')
    })

    it('clears organization on logout', async () => {
      // First set organization data
      useAuthStore.setState({
        authenticated: true,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        roles: ['agent'],
        organizationId: 'org-123',
        organizationName: 'My Organization',
      })

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.organizationId).toBeNull()
      expect(state.organizationName).toBeNull()
    })
  })
})
