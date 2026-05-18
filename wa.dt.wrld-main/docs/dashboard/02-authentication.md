# Dashboard Authentication

## Overview

The dashboard uses a cookie-based authentication system with role-based access control (RBAC). Authentication state is managed via Zustand and persisted across page reloads.

---

## Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  AuthProvider │────▶│  GET /auth/me │
│  (mount)    │     │  (useEffect)  │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           │                    ▼
                           │            ┌─────────────┐
                           │            │   401?      │──▶ Redirect to /login
                           │            └─────────────┘
                           │                    │
                           │                    ▼ 200
                           │            ┌─────────────┐
                           └◀───────────│  Set user   │
                                        │  in store   │
                                        └─────────────┘
```

### Startup Sequence

1. App mounts `AuthProvider` wrapper
2. `AuthProvider` calls `GET /auth/me` on mount
3. If 401 Unauthorized → Redirect to `/login`
4. If 200 OK → Store user data, render children
5. User is now authenticated for the session

---

## Role Types

```typescript
type Role = 'agent' | 'automation_engineer' | 'tenant_admin' | 'creator_admin'
```

### Role Hierarchy

| Role | Description | Access Level |
|------|-------------|--------------|
| `agent` | Customer support agent | Basic: chats, contacts |
| `automation_engineer` | Bot/workflow developer | Agent + automation settings |
| `tenant_admin` | Organization admin | Engineer + user management, sessions |
| `creator_admin` | Platform super admin | Full access to all features |

### Role Permissions

| Feature | agent | automation_engineer | tenant_admin | creator_admin |
|---------|-------|---------------------|--------------|---------------|
| View chats | ✅ | ✅ | ✅ | ✅ |
| Send messages | ✅ | ✅ | ✅ | ✅ |
| View contacts | ✅ | ✅ | ✅ | ✅ |
| Manage tags | ❌ | ✅ | ✅ | ✅ |
| View analytics | ❌ | ✅ | ✅ | ✅ |
| Manage sessions | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ | ✅ |
| Platform settings | ❌ | ❌ | ❌ | ✅ |

---

## Auth Components

### AuthProvider

Wraps the entire application to provide authentication context.

```tsx
// src/providers/AuthProvider.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const { fetchUser, isLoading, error } = useAuth()

  useEffect(() => {
    fetchUser()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <Navigate to="/login" />

  return <>{children}</>
}
```

**Usage in App.tsx:**

```tsx
<AuthProvider>
  <RouterProvider router={router} />
</AuthProvider>
```

### ProtectedRoute

Route guard that checks authentication and optional role requirements.

```tsx
// src/components/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: ReactNode
  requiredRoles?: Role[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
```

**Usage in routes:**

```tsx
// Admin-only route
<Route
  path="/sessions"
  element={
    <ProtectedRoute requiredRoles={['tenant_admin', 'creator_admin']}>
      <SessionsPage />
    </ProtectedRoute>
  }
/>
```

### RoleGate

Conditionally renders content based on user role.

```tsx
// src/components/auth/RoleGate.tsx
interface RoleGateProps {
  roles: Role[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
```

**Usage in components:**

```tsx
// Only show admin button for admins
<RoleGate roles={['tenant_admin', 'creator_admin']}>
  <Button onClick={handleManageUsers}>Manage Users</Button>
</RoleGate>

// With fallback
<RoleGate roles={['tenant_admin']} fallback={<span>Contact admin for access</span>}>
  <SettingsPanel />
</RoleGate>
```

---

## Auth Store

```typescript
// src/stores/authStore.ts
interface User {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  fetchUser: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  fetchUser: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get('/auth/me')
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false
      })
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Authentication failed'
      })
    }
  },

  logout: async () => {
    await api.post('/auth/logout')
    set({ user: null, isAuthenticated: false })
  },

  clearError: () => set({ error: null })
}))
```

### useAuth Hook

Convenience hook for accessing auth state:

```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  return useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    fetchUser: state.fetchUser,
    logout: state.logout,
    clearError: state.clearError,
  }))
}
```

---

## Mock Authentication (Development)

For local development without a backend, enable mock authentication:

```typescript
// src/stores/authStore.ts
const USE_MOCK_AUTH = import.meta.env.DEV && true  // Toggle here

const MOCK_USER: User = {
  id: 'dev-user-1',
  email: 'dev@example.com',
  name: 'Dev User',
  role: 'tenant_admin',  // Change to test different roles
  avatarUrl: undefined,
}

// In fetchUser:
if (USE_MOCK_AUTH) {
  set({ user: MOCK_USER, isAuthenticated: true, isLoading: false })
  return
}
```

### Testing Different Roles

To test role-based features during development:

1. Edit `MOCK_USER.role` in `authStore.ts`
2. Refresh the page
3. Observe which features are available

```typescript
// Test as agent
role: 'agent',

// Test as admin
role: 'tenant_admin',
```

---

## Login Page

The login page redirects to SSO:

```tsx
// src/pages/LoginPage.tsx
export function LoginPage() {
  const handleLogin = () => {
    // Redirect to SSO provider
    window.location.href = '/auth/login?redirect=/chats'
  }

  return (
    <div className="login-container">
      <h1>WhatsApp Dashboard</h1>
      <Button onClick={handleLogin}>
        Sign in with SSO
      </Button>
    </div>
  )
}
```

---

## Security Considerations

### Cookie Configuration

The backend should set secure cookie flags:

```typescript
// Backend cookie settings
res.cookie('session', token, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 86400000,    // 24 hours
})
```

### CORS Configuration

Backend CORS must allow credentials:

```typescript
// Backend CORS config
app.use(cors({
  origin: 'https://dashboard.example.com',
  credentials: true,
}))
```

### Protected API Calls

All API calls include credentials:

```typescript
// src/lib/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,  // Send cookies
})
```

---

## Related Documentation

- [01-dashboard-overview.md](01-dashboard-overview.md) - Dashboard architecture
- [03-testing.md](03-testing.md) - Testing auth components
- [Service API](../whatsapp/03-service-api-reference.md) - Backend auth endpoints
