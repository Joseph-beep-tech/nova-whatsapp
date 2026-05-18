# Dashboard Testing

## Overview

The dashboard uses Vitest for unit and component testing, with React Testing Library for rendering components. Tests are located in the `__tests__/` directory at the package root.

---

## Test Infrastructure

### Framework Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 2.0.x | Test runner and assertions |
| @testing-library/react | 16.x | Component testing |
| @testing-library/jest-dom | 6.x | DOM matchers |
| @testing-library/user-event | 14.x | User interaction simulation |
| jsdom | 25.x | Browser environment |

### Configuration

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/test/**'],
    },
  },
})
```

### Test Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

---

## Running Tests

### Command Reference

```bash
# Run all tests once
npm test

# Run tests in watch mode (TDD)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test Avatar.test.tsx

# Run tests matching pattern
npm test -- --grep "renders"

# Run tests with verbose output
npm test -- --reporter=verbose
```

### Watch Mode Commands

In watch mode, press:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename pattern
- `t` - Filter by test name pattern
- `q` - Quit watch mode

---

## Test Utilities

### Custom Render

The custom render wraps components with necessary providers:

```typescript
// src/test/utils.tsx
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ReactElement } from 'react'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { initialRoute = '/', ...renderOptions } = options

  window.history.pushState({}, 'Test page', initialRoute)

  return render(ui, {
    wrapper: ({ children }) => (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    ),
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { renderWithProviders as render }
```

### Usage in Tests

```typescript
import { render, screen } from '@/test/utils'
import { Avatar } from '@/components/ui/Avatar'

test('renders avatar with image', () => {
  render(<Avatar src="/photo.jpg" alt="User" />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/photo.jpg')
})
```

---

## Test Coverage Summary

| File | Tests | Description |
|------|-------|-------------|
| `Avatar.test.tsx` | 15 | Avatar component rendering |
| `Badge.test.tsx` | 18 | Badge variants and states |
| `Button.test.tsx` | 21 | Button variants, sizes, states |
| `RoleGate.test.tsx` | 11 | Role-based rendering |
| `chatStore.test.ts` | 13 | Chat state management |
| **Total** | **78** | All tests passing |

---

## Writing Tests

### Component Test Pattern

```typescript
// __tests__/components/Button.test.tsx
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Click</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows loading spinner when loading', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })
})
```

### Store Test Pattern

```typescript
// __tests__/stores/chatStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '@/stores/chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      contacts: [],
      messages: {},
      selectedChatId: null,
      filters: { search: '', status: 'all', tag: null },
    })
  })

  it('sets selected chat', () => {
    useChatStore.getState().setSelectedChat('chat-123')
    expect(useChatStore.getState().selectedChatId).toBe('chat-123')
  })

  it('adds message to conversation', () => {
    const message = {
      id: 'msg-1',
      identifier: '254712345678',
      platform: 'c.us' as const,
      content: 'Hello',
      contentType: 'text' as const,
      timestamp: new Date(),
      sender: { type: 'customer' as const, name: 'Test' },
      status: 'read' as const,
      isFromMe: false,
    }

    useChatStore.getState().addMessage(message)

    const key = chatKey('254712345678', 'c.us')
    expect(useChatStore.getState().messages[key]).toContainEqual(message)
  })

  it('filters contacts by search term', () => {
    useChatStore.setState({
      contacts: [
        { id: '1', name: 'Alice', phone: '+1234' },
        { id: '2', name: 'Bob', phone: '+5678' },
      ],
    })

    useChatStore.getState().setFilter('search', 'ali')

    const filtered = useChatStore.getState().filteredContacts
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Alice')
  })
})
```

### Auth Component Test Pattern

```typescript
// __tests__/components/RoleGate.test.tsx
import { render, screen } from '@/test/utils'
import { RoleGate } from '@/components/auth/RoleGate'
import { useAuthStore } from '@/stores/authStore'

describe('RoleGate', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('shows children when user has required role', () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Admin', role: 'tenant_admin' },
      isAuthenticated: true,
    })

    render(
      <RoleGate roles={['tenant_admin']}>
        <div>Admin Content</div>
      </RoleGate>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('hides children when user lacks required role', () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Agent', role: 'agent' },
      isAuthenticated: true,
    })

    render(
      <RoleGate roles={['tenant_admin']}>
        <div>Admin Content</div>
      </RoleGate>
    )

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('shows fallback when user lacks required role', () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Agent', role: 'agent' },
      isAuthenticated: true,
    })

    render(
      <RoleGate roles={['tenant_admin']} fallback={<div>No access</div>}>
        <div>Admin Content</div>
      </RoleGate>
    )

    expect(screen.getByText('No access')).toBeInTheDocument()
  })
})
```

---

## Mocking

### Mocking API Calls

```typescript
import { vi } from 'vitest'
import * as api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

test('fetches contacts on mount', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: [{ id: '1', name: 'Alice' }],
  })

  render(<ChatList />)

  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
```

### Mocking Zustand Store

```typescript
import { useAuthStore } from '@/stores/authStore'

// Set state directly in tests
beforeEach(() => {
  useAuthStore.setState({
    user: { id: '1', name: 'Test', role: 'agent' },
    isAuthenticated: true,
  })
})
```

### Mocking WebSocket

```typescript
import { vi } from 'vitest'

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

vi.mock('@/lib/socket', () => ({
  socket: mockSocket,
}))
```

---

## Best Practices

### Test Organization

```
__tests__/
├── components/
│   ├── ui/
│   │   ├── Avatar.test.tsx
│   │   ├── Badge.test.tsx
│   │   └── Button.test.tsx
│   └── auth/
│       └── RoleGate.test.tsx
└── stores/
    └── chatStore.test.ts
```

### Naming Conventions

- Test files: `{ComponentName}.test.tsx` or `{storeName}.test.ts`
- Describe blocks: Component/function name
- Test names: Start with action verb ("renders", "calls", "shows", "filters")

### What to Test

| Test | What to Assert |
|------|----------------|
| Rendering | Component appears, correct content |
| User interaction | Handlers called, state updated |
| Conditional rendering | Correct content for props/state |
| Error states | Error messages displayed |
| Loading states | Spinners/skeletons shown |

### What NOT to Test

- Implementation details (internal state, private methods)
- Third-party library internals
- Styling (visual regression tools are better)
- Exact DOM structure (test accessible queries instead)

---

## CI Integration

Tests run automatically in CI:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
        working-directory: packages/whatsapp-dashboard
```

---

## Related Documentation

- [01-dashboard-overview.md](01-dashboard-overview.md) - Dashboard architecture
- [02-authentication.md](02-authentication.md) - Auth system details
- [Vitest Documentation](https://vitest.dev/) - Test framework docs
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - Component testing
