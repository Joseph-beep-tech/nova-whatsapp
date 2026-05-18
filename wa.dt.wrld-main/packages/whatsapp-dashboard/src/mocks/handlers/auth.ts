import { http, HttpResponse, delay } from 'msw'
import { mockAuthStates } from '../data/users'
import type { AuthState } from '@/types'

// Default auth state - can be overridden in tests
let currentAuthState: AuthState = mockAuthStates.authenticated

// Helper to set auth state for tests
export function setMockAuthState(state: AuthState | keyof typeof mockAuthStates) {
  if (typeof state === 'string') {
    currentAuthState = mockAuthStates[state]
  } else {
    currentAuthState = state
  }
}

// Reset to default state
export function resetMockAuthState() {
  currentAuthState = mockAuthStates.authenticated
}

export const authHandlers = [
  // GET /auth/me - Get current user info
  http.get('/auth/me', async () => {
    await delay(50)

    if (!currentAuthState.authenticated) {
      return HttpResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json(currentAuthState)
  }),

  // GET /auth/login - Redirect to Keycloak (in tests, just mock success)
  http.get('/auth/login', async () => {
    await delay(50)
    // In tests, simulate redirect by returning a 302
    return new HttpResponse(null, {
      status: 302,
      headers: {
        Location: '/auth/callback?code=mock-auth-code',
      },
    })
  }),

  // GET /auth/callback - Handle OIDC callback
  http.get('/auth/callback', async () => {
    await delay(50)
    // Simulate successful auth callback
    setMockAuthState('authenticated')
    return new HttpResponse(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    })
  }),

  // POST /auth/logout - Logout user
  http.post('/auth/logout', async () => {
    await delay(50)
    setMockAuthState('unauthenticated')
    return HttpResponse.json({ success: true })
  }),

  // GET /auth/logout - Logout user (also supports GET)
  http.get('/auth/logout', async () => {
    await delay(50)
    setMockAuthState('unauthenticated')
    return new HttpResponse(null, {
      status: 302,
      headers: {
        Location: '/login',
      },
    })
  }),

  // GET /auth/status - Auth system status
  http.get('/auth/status', async () => {
    await delay(50)
    return HttpResponse.json({
      keycloakEnabled: true,
      authenticated: currentAuthState.authenticated,
    })
  }),
]
