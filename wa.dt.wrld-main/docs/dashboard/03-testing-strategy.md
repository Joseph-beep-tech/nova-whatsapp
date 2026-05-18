# Dashboard Testing Strategy

This document describes the comprehensive testing approach for the WhatsApp Dashboard, including MSW (Mock Service Worker) setup, test data design, and E2E testing.

## Overview

The dashboard uses a layered testing approach:

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | Vitest + Testing Library | Component isolation, store logic |
| Integration Tests | Vitest + MSW | Store + API interactions |
| E2E Tests | Playwright | Full user flows |

## MSW (Mock Service Worker)

### Why MSW?

MSW intercepts HTTP requests at the network level, providing several advantages:

1. **Framework agnostic** - Works with any HTTP client (fetch, axios, etc.)
2. **No code changes** - Components use real API calls, MSW intercepts them
3. **Realistic testing** - Tests behave like real network requests
4. **Shared handlers** - Same mocks work in tests and development mode

### Architecture

```
src/mocks/
├── data/               # Mock datasets
│   ├── users.ts        # Auth users and states
│   ├── chats.ts        # Chat and message data
│   ├── sessions.ts     # WhatsApp session states
│   └── index.ts        # Re-exports
├── handlers/           # API endpoint handlers
│   ├── auth.ts         # /auth/* endpoints
│   ├── chat.ts         # /api/chats/* endpoints
│   ├── contact.ts      # /api/contacts/* endpoints
│   ├── session.ts      # /api/session/* endpoints
│   ├── health.ts       # Health check endpoints
│   └── index.ts        # Aggregates + state setters
├── server.ts           # MSW server for Node.js (Vitest)
├── browser.ts          # MSW worker for browser (dev mode)
└── index.ts            # Main entry point
```

### Handler Design

Each handler file exports:
1. **Handlers array** - Request handlers for MSW
2. **State setters** - Functions to modify mock state during tests
3. **Reset function** - Restore default state between tests

Example from `auth.ts`:
```typescript
// Handlers
export const authHandlers = [
  http.get('/auth/me', async () => { ... }),
  http.post('/auth/logout', async () => { ... }),
]

// State control
export function setMockAuthState(state: AuthState) { ... }
export function resetMockAuthState() { ... }
```

### Mock Data Design

Mock data is organized by domain with multiple scenarios:

**Users (`data/users.ts`)**:
- `mockUsers` - Individual user objects
- `mockAuthStates` - Pre-configured auth states (authenticated, admin, unauthenticated)

**Chats (`data/chats.ts`)**:
- `emptyChats` - Empty state testing
- `singleChat` - Single item rendering
- `multipleChats` - List with variety (groups, assigned, pending)
- `pendingChats` / `myChats` / `groupChats` - Filtered subsets
- `mockMessages` - Message history by chat ID
- `mockContacts` - Contact details with labels and notes

**Sessions (`data/sessions.ts`)**:
- `connectedSession` - Active WhatsApp connection
- `disconnectedSession` - Offline state
- `qrRequiredSession` - QR code scanning needed
- `loadingSession` - Initialization state

## Environment Configuration

### Mock Mode Flag

The `VITE_USE_MOCK_API` environment variable controls whether MSW is active:

| Value | Behavior |
|-------|----------|
| `true` | MSW intercepts all API calls, returns mock data |
| `false` | Real API calls to backend |

Set in `.env.local`:
```bash
# Enable mock API for local development
VITE_USE_MOCK_API=true
```

### When to Use Mock Mode

| Scenario | Mock Mode | Rationale |
|----------|-----------|-----------|
| Unit tests | Always ON | Isolation, speed, determinism |
| Local dev (no backend) | ON | Work without running services |
| Local dev (with backend) | OFF | Test real integration |
| E2E tests (CI) | ON | Reproducible, no infrastructure |
| E2E tests (staging) | OFF | Real integration validation |

## Test Organization

### Unit Tests

Located in `__tests__/` directories adjacent to source:

```
src/
├── stores/
│   ├── authStore.ts
│   └── __tests__/
│       └── authStore.test.ts
├── components/
│   └── chat/
│       ├── ChatList.tsx
│       └── __tests__/
│           └── ChatList.test.tsx
```

### E2E Tests

Located in `e2e/` directory at package root:

```
e2e/
├── auth.spec.ts        # Authentication flows
├── chat-list.spec.ts   # Chat interactions
├── sessions.spec.ts    # Session management
└── test-results/       # Artifacts (gitignored)
```

## Test Utilities

### Custom Render

`src/test/utils.tsx` provides wrapped render functions:

```typescript
import { render, renderWithRouter } from '@/test/utils'

// Full providers (Router + Auth)
render(<MyComponent />)

// Router only (for auth component testing)
renderWithRouter(<AuthComponent />)

// With specific route
renderWithMemoryRouter(<App />, ['/settings'])
```

### Mock Data Helpers

Quick mock object creation:

```typescript
import { mockChat, mockMessage, mockContact } from '@/test/utils'

const chat = mockChat({ unreadCount: 5 })
const message = mockMessage({ isFromMe: true })
```

### State Control

Override mock API state in tests:

```typescript
import { setMockAuthState, setMockChats } from '@/test/utils'

// Set unauthenticated state
setMockAuthState('unauthenticated')

// Set specific chat list
setMockChats([customChat1, customChat2])
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all tests once
npm test

# Watch mode (TDD)
npm run test:watch

# Coverage report
npm run test:coverage

# Single file
npm test -- ChatList.test.tsx
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Headed browser (visible)
npm run test:e2e:headed

# View HTML report
npm run test:e2e:report
```

## Writing New Tests

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, setMockChats } from '@/test/utils'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup is automatically reset by test/setup.ts
  })

  it('renders expected content', async () => {
    setMockChats([...testChats])
    render(<MyComponent />)

    await waitFor(() => {
      expect(screen.getByText('Expected')).toBeInTheDocument()
    })
  })
})
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/endpoint', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: 'mock' }),
      })
    })
  })

  test('user can perform action', async ({ page }) => {
    await page.goto('/')
    await page.click('button')
    await expect(page.getByText('Result')).toBeVisible()
  })
})
```

## Coverage Goals

| Category | Target | Rationale |
|----------|--------|-----------|
| Stores | 90% | Business logic, state management |
| Components | 80% | UI interactions, rendering |
| Pages | 70% | Integration of components |
| E2E Critical Paths | 100% | Core user journeys |

## Troubleshooting

### Common Issues

**"act(...)" warnings in tests**
- Usually benign when using `waitFor`
- Ensure all state updates complete before assertions

**MSW not intercepting requests**
- Check `VITE_USE_MOCK_API=true` is set
- Verify handler URL patterns match actual requests
- Check server is started in test setup

**E2E tests timing out**
- Increase timeout in playwright.config.ts
- Use `await expect(...).toBeVisible()` with explicit waits
- Check dev server is running on correct port

## Related Documentation

- [Dashboard Overview](./01-dashboard-overview.md) - Architecture
- [Component Patterns](./02-component-patterns.md) - UI guidelines
- [MSW Documentation](https://mswjs.io/) - Official MSW docs
- [Playwright Documentation](https://playwright.dev/) - E2E testing
