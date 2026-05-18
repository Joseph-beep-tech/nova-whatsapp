import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { ChatList } from '../ChatList'
import { useChatStore } from '@/stores/chatStore'
import type { Chat } from '@/types'

// Mock data for tests
const mockChats: Chat[] = [
  {
    id: '1',
    identifier: '254712345678',
    platform: 'c.us',
    contactName: 'John Mwangi',
    contactPhone: '+254712345678',
    lastMessage: 'Hello, I need help with SOMO registration',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    unreadCount: 2,
    status: 'open',
    isGroup: false,
    tags: ['SOMO'],
  },
  {
    id: '2',
    identifier: '254798765432',
    platform: 'c.us',
    contactName: 'Mary Wanjiku',
    contactPhone: '+254798765432',
    lastMessage: 'Thank you for the assistance!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    unreadCount: 0,
    status: 'resolved',
    isGroup: false,
    tags: ['SOMO', 'VIP'],
    assignedTo: 'Agent 1',
  },
  {
    id: '3',
    identifier: '254755555555',
    platform: 'g.us',
    contactName: 'SOMO Kenya Group',
    contactPhone: '+254755555555',
    lastMessage: 'Welcome to the group!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unreadCount: 5,
    status: 'pending',
    isGroup: true,
    tags: ['SOMO'],
  },
  {
    id: '4',
    identifier: '254700111222',
    platform: 'c.us',
    contactName: 'Peter Kamau',
    contactPhone: '+254700111222',
    lastMessage: 'When is the next session?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    unreadCount: 1,
    status: 'pending',
    isGroup: false,
    tags: ['LMS'],
  },
]

// Helper to set store state before render
const setupStore = (overrides: Partial<ReturnType<typeof useChatStore.getState>> = {}) => {
  useChatStore.setState({
    chats: [],
    messages: {},
    selectedChatId: null,
    filter: 'all',
    searchQuery: '',
    isLoading: false,
    error: null,
    typingChats: new Set(),
    // Mock fetchChats to avoid triggering mock data loading
    fetchChats: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

describe('ChatList', () => {
  beforeEach(() => {
    setupStore()
  })

  describe('rendering', () => {
    it('renders empty state when no chats', async () => {
      setupStore({ chats: [], isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('No chats found')).toBeInTheDocument()
      })
    })

    it('renders loading state', async () => {
      setupStore({ isLoading: true })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // Check for loader (Loader2 icon has animate-spin)
        const loader = document.querySelector('.animate-spin')
        expect(loader).toBeInTheDocument()
      })
    })

    it('renders chat list with all chats', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.getByText('Mary Wanjiku')).toBeInTheDocument()
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        expect(screen.getByText('Peter Kamau')).toBeInTheDocument()
      })
    })

    it('renders header with title', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('Chats')).toBeInTheDocument()
      })
    })

    it('renders search input', async () => {
      setupStore()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search chats...')).toBeInTheDocument()
      })
    })

    it('renders all filter buttons', async () => {
      setupStore()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'My chats' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Unassigned' })).toBeInTheDocument()
      })
    })
  })

  describe('filtering', () => {
    beforeEach(() => {
      setupStore({ chats: mockChats, isLoading: false })
    })

    it('shows all chats with "All" filter (default)', async () => {
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.getByText('Mary Wanjiku')).toBeInTheDocument()
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        expect(screen.getByText('Peter Kamau')).toBeInTheDocument()
      })
    })

    it('filters by "Pending" status', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Pending' }))

      await waitFor(() => {
        // Only pending status chats should show
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        expect(screen.getByText('Peter Kamau')).toBeInTheDocument()
        expect(screen.queryByText('John Mwangi')).not.toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })
    })

    it('filters by "My chats" (assigned to Agent 1)', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'My chats' }))

      await waitFor(() => {
        // Only assigned chats should show
        expect(screen.getByText('Mary Wanjiku')).toBeInTheDocument()
        expect(screen.queryByText('John Mwangi')).not.toBeInTheDocument()
        expect(screen.queryByText('Peter Kamau')).not.toBeInTheDocument()
      })
    })

    it('filters by "Groups"', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Groups' }))

      await waitFor(() => {
        // Only groups should show
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        expect(screen.queryByText('John Mwangi')).not.toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })
    })

    it('filters by "Unassigned"', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Unassigned' }))

      await waitFor(() => {
        // Only unassigned chats should show
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        expect(screen.getByText('Peter Kamau')).toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when filter returns no results', async () => {
      // Set chats with no pending status
      setupStore({
        chats: [
          { ...mockChats[0], status: 'resolved' },
          { ...mockChats[1], status: 'resolved' },
        ],
        isLoading: false,
      })

      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Pending' }))

      await waitFor(() => {
        expect(screen.getByText('No chats found')).toBeInTheDocument()
      })
    })
  })

  describe('search', () => {
    beforeEach(() => {
      setupStore({ chats: mockChats, isLoading: false })
    })

    it('filters chats by name search', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'John')

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
        expect(screen.queryByText('SOMO Kenya Group')).not.toBeInTheDocument()
      })
    })

    it('filters chats by message content search', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'registration')

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })
    })

    it('filters chats by phone number search', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, '254712345678')

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })
    })

    it('search is case insensitive', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'JOHN')

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })
    })

    it('shows empty state when search returns no results', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'xyz123nonexistent')

      await waitFor(() => {
        expect(screen.getByText('No chats found')).toBeInTheDocument()
      })
    })

    it('clears search restores all chats', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'John')

      await waitFor(() => {
        expect(screen.queryByText('Mary Wanjiku')).not.toBeInTheDocument()
      })

      await user.clear(searchInput)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
        expect(screen.getByText('Mary Wanjiku')).toBeInTheDocument()
      })
    })
  })

  describe('selection', () => {
    beforeEach(() => {
      setupStore({ chats: mockChats, isLoading: false })
    })

    it('clicking chat calls selectChat', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      // Click on the chat button containing John Mwangi
      const johnChat = screen.getByText('John Mwangi').closest('button')
      await user.click(johnChat!)

      // Check store was updated (composite key format identifier:platform)
      await waitFor(() => {
        expect(useChatStore.getState().selectedChatId).toBe('254712345678:c.us')
      })
    })

    it('selected chat has visual indicator', async () => {
      setupStore({
        chats: mockChats,
        selectedChatId: '254712345678:c.us',
        isLoading: false,
      })

      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // Find the button containing John Mwangi (which should be selected)
        const johnChat = screen.getByText('John Mwangi').closest('button')
        expect(johnChat).toHaveClass('bg-secondary')
      })
    })
  })

  describe('sorting', () => {
    it('sorts chats by most recent first', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // Get all chat name elements - they should be in order
        const johnChat = screen.getByText('John Mwangi')
        const maryChat = screen.getByText('Mary Wanjiku')

        // Both should be in the document
        expect(johnChat).toBeInTheDocument()
        expect(maryChat).toBeInTheDocument()

        // John should appear before Mary in the DOM (newer message)
        // We can check this by comparing their positions
        const johnPosition = johnChat.compareDocumentPosition(maryChat)
        expect(johnPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      })
    })
  })

  describe('unread badge', () => {
    it('displays unread count badge', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // John has 2 unread
        expect(screen.getByText('2')).toBeInTheDocument()
        // SOMO Kenya has 5 unread
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })

    it('does not show badge for zero unread', async () => {
      setupStore({
        chats: [{ ...mockChats[1], unreadCount: 0 }],
        isLoading: false,
      })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('Mary Wanjiku')).toBeInTheDocument()
      })

      // Should not show "0" anywhere as a badge
      const zeros = screen.queryAllByText('0')
      expect(zeros).toHaveLength(0)
    })
  })

  describe('typing indicator', () => {
    it('shows typing indicator when chat is in typingChats', async () => {
      setupStore({
        chats: mockChats,
        isLoading: false,
        typingChats: new Set(['254712345678:c.us']),
      })

      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('Typing...')).toBeInTheDocument()
      })
    })

    it('does not show typing indicator for normal chats', async () => {
      setupStore({
        chats: mockChats,
        isLoading: false,
        typingChats: new Set(),
      })

      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      expect(screen.queryByText('Typing...')).not.toBeInTheDocument()
    })
  })

  describe('tags display', () => {
    it('displays chat tags', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // Multiple chats have SOMO tag
        const somoBadges = screen.getAllByText('SOMO')
        expect(somoBadges.length).toBeGreaterThan(0)
      })
    })

    it('shows +N for chats with more than 2 tags', async () => {
      const chatWith4Tags: Chat = {
        ...mockChats[0],
        tags: ['SOMO', 'VIP', 'Priority', 'Important'],
      }
      setupStore({
        chats: [chatWith4Tags],
        isLoading: false,
      })

      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('+2')).toBeInTheDocument()
      })
    })
  })

  describe('group indicator', () => {
    it('shows group icon for group chats', async () => {
      setupStore({
        chats: mockChats.filter((c) => c.isGroup),
        isLoading: false,
      })

      renderWithRouter(<ChatList />)

      await waitFor(() => {
        // The Users icon should be rendered for groups
        const groupChat = screen.getByText('SOMO Kenya Group').closest('button')
        expect(groupChat).toBeInTheDocument()
        // The span with the Users icon should exist (has bg-primary)
        const groupIcon = groupChat?.querySelector('.bg-primary')
        expect(groupIcon).toBeInTheDocument()
      })
    })
  })

  describe('filter button styling', () => {
    it('active filter has primary styling', async () => {
      setupStore({ chats: mockChats, isLoading: false })
      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      // "All" should be active by default
      const allButton = screen.getByRole('button', { name: 'All' })
      expect(allButton).toHaveClass('bg-primary', 'text-primary-foreground')

      // Click Pending
      await user.click(screen.getByRole('button', { name: 'Pending' }))

      await waitFor(() => {
        // Now Pending should be active
        const pendingButton = screen.getByRole('button', { name: 'Pending' })
        expect(pendingButton).toHaveClass('bg-primary', 'text-primary-foreground')

        // All should no longer be active
        expect(allButton).not.toHaveClass('bg-primary')
      })
    })
  })

  describe('combined filter and search', () => {
    it('applies both filter and search together', async () => {
      setupStore({ chats: mockChats, isLoading: false })

      const user = userEvent.setup()
      renderWithRouter(<ChatList />)

      await waitFor(() => {
        expect(screen.getByText('John Mwangi')).toBeInTheDocument()
      })

      // Filter by pending
      await user.click(screen.getByRole('button', { name: 'Pending' }))

      await waitFor(() => {
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
      })

      // Search for SOMO
      const searchInput = screen.getByPlaceholderText('Search chats...')
      await user.type(searchInput, 'SOMO')

      await waitFor(() => {
        // Should show SOMO Kenya Group (pending + has SOMO in name)
        expect(screen.getByText('SOMO Kenya Group')).toBeInTheDocument()
        // Should not show Peter (pending but no SOMO in name)
        expect(screen.queryByText('Peter Kamau')).not.toBeInTheDocument()
      })
    })
  })
})
