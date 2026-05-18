import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TakeoverButton } from '../TakeoverButton'
import { useChatStore } from '@/stores/chatStore'
import { useAuth } from '@/stores/authStore'
import type { Chat } from '@/types'

// Mock the stores
vi.mock('@/stores/chatStore')
vi.mock('@/stores/authStore', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('@/stores/authStore')>()),
    useAuth: vi.fn(),
  }
})

describe('TakeoverButton', () => {
  const mockClaimChat = vi.fn()
  const mockReleaseChat = vi.fn()
  const testChatId = '123:c.us' // composite key (identifier:platform)
  const testUserId = 'agent-1'

  const mockChat: Chat = {
    id: '1',
    identifier: '123',
    platform: 'c.us',
    contactName: 'Test User',
    contactPhone: '+123',
    lastMessage: 'Hello',
    lastMessageTime: new Date(),
    unreadCount: 0,
    status: 'open',
    isGroup: false,
    tags: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup auth selector mock
    vi.mocked(useAuth).mockReturnValue({
      user: { id: testUserId, email: 'agent@test.com', name: 'Test Agent' },
      roles: ['agent'],
      authenticated: true,
      organizationId: 'org-1',
      organizationName: 'Test Org',
    })

    // Setup chat store mock
    vi.mocked(useChatStore).mockReturnValue({
      chats: [mockChat],
      messages: {},
      conversationContext: {},
      selectedChatId: null,
      filter: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
      typingChats: new Set(),
      fetchChats: vi.fn(),
      fetchMessages: vi.fn(),
      selectChat: vi.fn(),
      setFilter: vi.fn(),
      setSearchQuery: vi.fn(),
      sendMessage: vi.fn(),
      updateChatStatus: vi.fn(),
      claimChat: mockClaimChat,
      releaseChat: mockReleaseChat,
      loadContext: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      updateChat: vi.fn(),
      setTyping: vi.fn(),
    })
  })

  describe('rendering', () => {
    it('renders "Claim Conversation" button for unclaimed chat', () => {
      render(<TakeoverButton chatId={testChatId} />)
      expect(screen.getByRole('button')).toHaveTextContent('Claim Conversation')
    })

    it('renders "Release to Bot" button for claimed chat (by current user)', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: testUserId }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      expect(screen.getByRole('button')).toHaveTextContent('Release to Bot')
    })

    it('renders with UserCheck icon for unclaimed chat', () => {
      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })

    it('renders with BotMessageSquare icon for claimed chat', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: testUserId }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('uses primary variant for unclaimed chat', () => {
      render(<TakeoverButton chatId={testChatId} />)
      expect(screen.getByRole('button')).toHaveClass('bg-primary')
    })

    it('uses secondary variant for claimed chat', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: testUserId }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      expect(screen.getByRole('button')).toHaveClass('bg-secondary')
    })
  })

  describe('claim action', () => {
    it('calls claimChat when clicking on unclaimed chat', async () => {
      mockClaimChat.mockResolvedValue(undefined)

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockClaimChat).toHaveBeenCalledWith('123', 'c.us', testUserId)
      })
    })

    it('shows loading state during claim', async () => {
      mockClaimChat.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(button).toBeDisabled()
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()

      await waitFor(() => {
        expect(mockClaimChat).toHaveBeenCalled()
      })
    })
  })

  describe('release action', () => {
    beforeEach(() => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: testUserId }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })
    })

    it('calls releaseChat when clicking on claimed chat (by current user)', async () => {
      mockReleaseChat.mockResolvedValue(undefined)

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockReleaseChat).toHaveBeenCalledWith('123', 'c.us')
      })
    })

    it('shows loading state during release', async () => {
      mockReleaseChat.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(button).toBeDisabled()
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()

      await waitFor(() => {
        expect(mockReleaseChat).toHaveBeenCalled()
      })
    })
  })

  describe('disabled state', () => {
    it('is disabled when claimed by another agent', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: 'other-agent' }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Claimed by other-agent')
    })

    it('is disabled when store is loading', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [mockChat],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: true,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('does not call actions when disabled', async () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [{ ...mockChat, assignedTo: 'other-agent' }],
        messages: {},
        conversationContext: {},
        selectedChatId: null,
        filter: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
        typingChats: new Set(),
        fetchChats: vi.fn(),
        fetchMessages: vi.fn(),
        selectChat: vi.fn(),
        setFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        sendMessage: vi.fn(),
        updateChatStatus: vi.fn(),
        claimChat: mockClaimChat,
        releaseChat: mockReleaseChat,
        loadContext: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockClaimChat).not.toHaveBeenCalled()
      expect(mockReleaseChat).not.toHaveBeenCalled()
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<TakeoverButton chatId={testChatId} className="custom-class" />)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('missing user', () => {
    it('does not call actions when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        roles: [],
        authenticated: false,
        organizationId: null,
        organizationName: null,
      })

      render(<TakeoverButton chatId={testChatId} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockClaimChat).not.toHaveBeenCalled()
    })
  })
})
