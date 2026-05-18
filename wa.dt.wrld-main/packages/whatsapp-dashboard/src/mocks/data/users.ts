import type { AuthState, AuthUser, Role } from '@/types'

// Mock users for testing
export const mockUsers: Record<string, AuthUser> = {
  agent: {
    id: 'user-agent-1',
    email: 'agent@example.com',
    name: 'Test Agent',
  },
  admin: {
    id: 'user-admin-1',
    email: 'admin@example.com',
    name: 'Test Admin',
  },
  creator: {
    id: 'user-creator-1',
    email: 'creator@example.com',
    name: 'Creator Admin',
  },
}

// Mock auth states
export const mockAuthStates: Record<string, AuthState> = {
  authenticated: {
    authenticated: true,
    user: mockUsers.agent,
    roles: ['agent'] as Role[],
    organizationId: 'org-1',
    organizationName: 'Test Organization',
  },
  adminAuthenticated: {
    authenticated: true,
    user: mockUsers.admin,
    roles: ['tenant_admin', 'agent'] as Role[],
    organizationId: 'org-1',
    organizationName: 'Test Organization',
  },
  creatorAuthenticated: {
    authenticated: true,
    user: mockUsers.creator,
    roles: ['creator_admin', 'tenant_admin', 'agent'] as Role[],
    organizationId: 'org-1',
    organizationName: 'Test Organization',
  },
  unauthenticated: {
    authenticated: false,
    user: null,
    roles: [],
    organizationId: null,
    organizationName: null,
  },
}
