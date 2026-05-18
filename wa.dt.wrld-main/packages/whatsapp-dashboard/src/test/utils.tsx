import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth'

// Re-export mock data and state setters from MSW
export {
  setMockAuthState,
  resetMockAuthState,
  setMockChats,
  setMockMessages,
  resetMockChatState,
  setMockContacts,
  resetMockContactState,
  setMockSession,
  setMockSessions,
  resetMockSessionState,
  setMockHealthy,
  resetMockHealthState,
  resetAllMockStates,
} from '@/mocks/server'

// Re-export mock data
export {
  mockAuthStates,
  mockUsers,
  emptyChats,
  singleChat,
  multipleChats,
  pendingChats,
  myChats,
  groupChats,
  mockMessages,
  emptyMessages,
  messagesWithMedia,
  mockContacts,
  connectedSession,
  disconnectedSession,
  qrRequiredSession,
  loadingSession,
  multipleSessions,
} from '@/mocks/data'

// Wrapper with all providers
interface AllProvidersProps {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  )
}

// Custom render that wraps with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Wrapper without auth (for testing auth components themselves)
function RouterOnlyWrapper({ children }: AllProvidersProps) {
  return <BrowserRouter>{children}</BrowserRouter>
}

function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: RouterOnlyWrapper, ...options })
}

// Wrapper with MemoryRouter for specific route testing
function createMemoryRouterWrapper(initialEntries: string[] = ['/']) {
  return function MemoryRouterWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    )
  }
}

function renderWithMemoryRouter(
  ui: ReactElement,
  initialEntries: string[] = ['/'],
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: createMemoryRouterWrapper(initialEntries),
    ...options,
  })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render, renderWithRouter, renderWithMemoryRouter }

// Mock data helpers (legacy support)
export const mockChat = (overrides = {}) => ({
  id: '1',
  identifier: '254712345678',
  platform: 'c.us' as const,
  contactName: 'Test User',
  contactPhone: '+254712345678',
  lastMessage: 'Hello world',
  lastMessageTime: new Date(),
  unreadCount: 0,
  status: 'open' as const,
  isGroup: false,
  tags: ['SOMO'],
  ...overrides,
})

export const mockMessage = (overrides = {}) => ({
  id: 'm1',
  identifier: '254712345678',
  platform: 'c.us' as const,
  content: 'Test message',
  contentType: 'text' as const,
  timestamp: new Date(),
  sender: { type: 'customer' as const, name: 'Test User' },
  status: 'read' as const,
  isFromMe: false,
  ...overrides,
})

export const mockContact = (overrides = {}) => ({
  id: '1',
  identifier: '254712345678',
  platform: 'c.us' as const,
  name: 'Test Contact',
  phone: '+254712345678',
  email: 'test@example.com',
  accountType: 'personal' as const,
  status: 'active' as const,
  tags: ['SOMO'],
  labels: [],
  metadata: {},
  notes: [],
  firstSeen: new Date(),
  lastSeen: new Date(),
  ...overrides,
})

export const mockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
})

export const mockAuthState = (overrides = {}) => ({
  authenticated: true,
  user: mockUser(),
  roles: ['agent' as const],
  organizationId: 'org-1',
  organizationName: 'Test Org',
  ...overrides,
})

// Helper to wait for async state updates
export const waitForStateUpdate = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

// Helper to wait for MSW response
export const waitForMswResponse = (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms))
