import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleGate } from '../RoleGate'
import * as AuthProviderModule from '../AuthProvider'
import type { Role } from '@/types'

// Mock the useAuthContext hook
vi.mock('../AuthProvider', () => ({
  useAuthContext: vi.fn(),
}))

const mockUseAuthContext = AuthProviderModule.useAuthContext as ReturnType<typeof vi.fn>

describe('RoleGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when unauthenticated', () => {
    it('renders fallback when not authenticated', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: false,
        roles: [],
      })

      render(
        <RoleGate roles={['agent']} fallback={<div>Please log in</div>}>
          <div>Protected Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Please log in')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('renders nothing when no fallback and not authenticated', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: false,
        roles: [],
      })

      const { container } = render(
        <RoleGate roles={['agent']}>
          <div>Protected Content</div>
        </RoleGate>
      )

      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('roles prop', () => {
    it('renders children when user has one of required roles', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['agent'] as Role[],
      })

      render(
        <RoleGate roles={['agent', 'tenant_admin']}>
          <div>Agent Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Agent Content')).toBeInTheDocument()
    })

    it('renders fallback when user lacks required roles', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['agent'] as Role[],
      })

      render(
        <RoleGate roles={['tenant_admin', 'creator_admin']} fallback={<div>Upgrade required</div>}>
          <div>Admin Only</div>
        </RoleGate>
      )

      expect(screen.getByText('Upgrade required')).toBeInTheDocument()
      expect(screen.queryByText('Admin Only')).not.toBeInTheDocument()
    })

    it('renders children when no roles specified (any authenticated user)', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['agent'] as Role[],
      })

      render(
        <RoleGate>
          <div>Any User Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Any User Content')).toBeInTheDocument()
    })

    it('renders children with empty roles array', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['agent'] as Role[],
      })

      render(
        <RoleGate roles={[]}>
          <div>No Roles Required</div>
        </RoleGate>
      )

      expect(screen.getByText('No Roles Required')).toBeInTheDocument()
    })
  })

  describe('minRole prop (hierarchy-based)', () => {
    it('renders children when user meets minimum role', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['automation_engineer'] as Role[],
      })

      render(
        <RoleGate minRole="automation_engineer">
          <div>Engineer Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Engineer Content')).toBeInTheDocument()
    })

    it('renders children when user exceeds minimum role', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['creator_admin'] as Role[],
      })

      render(
        <RoleGate minRole="agent">
          <div>Agent Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Agent Content')).toBeInTheDocument()
    })

    it('renders fallback when user is below minimum role', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['agent'] as Role[],
      })

      render(
        <RoleGate minRole="tenant_admin" fallback={<div>Admin only</div>}>
          <div>Admin Content</div>
        </RoleGate>
      )

      expect(screen.getByText('Admin only')).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })
  })

  describe('combined roles and minRole', () => {
    it('requires both conditions when both are specified', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['automation_engineer'] as Role[],
      })

      // User has automation_engineer, which meets minRole, but lacks specific tenant_admin role
      render(
        <RoleGate minRole="agent" roles={['tenant_admin']} fallback={<div>Access denied</div>}>
          <div>Admin Feature</div>
        </RoleGate>
      )

      expect(screen.getByText('Access denied')).toBeInTheDocument()
    })

    it('renders children when both conditions are met', () => {
      mockUseAuthContext.mockReturnValue({
        authenticated: true,
        roles: ['tenant_admin'] as Role[],
      })

      render(
        <RoleGate minRole="agent" roles={['tenant_admin', 'creator_admin']}>
          <div>Admin Feature</div>
        </RoleGate>
      )

      expect(screen.getByText('Admin Feature')).toBeInTheDocument()
    })
  })
})
