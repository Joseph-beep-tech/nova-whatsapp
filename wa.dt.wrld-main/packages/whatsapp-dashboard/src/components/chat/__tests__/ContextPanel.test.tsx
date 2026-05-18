import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ContextPanel } from '../ContextPanel'
import { useChatStore } from '@/stores/chatStore'
import type { ConversationContext } from '@/types'

// Mock the store
vi.mock('@/stores/chatStore')

describe('ContextPanel', () => {
  const mockLoadContext = vi.fn()
  const testChatId = '123:c.us' // composite key (identifier:platform)

  const mockContext: ConversationContext = {
    messages: [
      {
        id: 'msg1',
        identifier: '123',
        platform: 'c.us',
        body: 'Hello, I need help',
        fromUser: true,
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        id: 'msg2',
        identifier: '123',
        platform: 'c.us',
        body: 'How can I help you?',
        fromUser: false,
        timestamp: '2024-01-01T10:01:00Z',
      },
      {
        id: 'msg3',
        identifier: '123',
        platform: 'c.us',
        body: 'I need information about SOMO',
        fromUser: true,
        timestamp: '2024-01-01T10:02:00Z',
        hasMedia: true,
        mediaType: 'image',
      },
    ],
    ragSummary: 'User is interested in SOMO program. Previously asked about registration.',
    userTags: ['SOMO', 'VIP'],
    claimedBy: 'Agent 1',
    claimedAt: '2024-01-01T10:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock - no chat selected
    vi.mocked(useChatStore).mockReturnValue({
      chats: [],
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
      claimChat: vi.fn(),
      releaseChat: vi.fn(),
      loadContext: mockLoadContext,
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      updateChat: vi.fn(),
      setTyping: vi.fn(),
    })
  })

  describe('empty states', () => {
    it('shows "Select a chat" message when no chat is selected', () => {
      render(<ContextPanel />)
      expect(screen.getByText('Select a chat to view context')).toBeInTheDocument()
    })

    it('shows "No context available" when chat is selected but has no context', () => {
      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: {},
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext.mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      // Wait for loading to finish
      waitFor(() => {
        expect(screen.getByText('No context available')).toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when loading context', async () => {
      mockLoadContext.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: {},
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      // Loading spinner should be visible (Loader2 icon renders with animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('calls loadContext when chat is selected', () => {
      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: {},
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      waitFor(() => {
        expect(mockLoadContext).toHaveBeenCalledWith('123', 'c.us', 20)
      })
    })
  })

  describe('content display', () => {
    beforeEach(() => {
      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: { [testChatId]: mockContext },
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })
    })

    it('displays header with title', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('Conversation Context')).toBeInTheDocument()
        expect(screen.getByText('Agent handoff information')).toBeInTheDocument()
      })
    })

    it('displays user tags', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('User Tags')).toBeInTheDocument()
        expect(screen.getByText('SOMO')).toBeInTheDocument()
        expect(screen.getByText('VIP')).toBeInTheDocument()
      })
    })

    it('displays RAG summary', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('AI Summary')).toBeInTheDocument()
        expect(
          screen.getByText('User is interested in SOMO program. Previously asked about registration.')
        ).toBeInTheDocument()
      })
    })

    it('displays recent messages with count', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('Recent Messages (3)')).toBeInTheDocument()
        expect(screen.getByText('Hello, I need help')).toBeInTheDocument()
        expect(screen.getByText('How can I help you?')).toBeInTheDocument()
        expect(screen.getByText('I need information about SOMO')).toBeInTheDocument()
      })
    })

    it('displays message sender labels correctly', () => {
      render(<ContextPanel />)

      waitFor(() => {
        const customerLabels = screen.getAllByText('Customer')
        const botLabels = screen.getAllByText('Bot')
        expect(customerLabels).toHaveLength(2) // Two customer messages
        expect(botLabels).toHaveLength(1) // One bot message
      })
    })

    it('displays media badge for messages with media', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('image')).toBeInTheDocument()
      })
    })

    it('displays claimed by information in footer', () => {
      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText(/Claimed by/)).toBeInTheDocument()
        expect(screen.getByText(/Agent 1/)).toBeInTheDocument()
      })
    })
  })

  describe('partial context', () => {
    it('displays only tags when only tags are available', () => {
      const partialContext: ConversationContext = {
        messages: [],
        userTags: ['SOMO'],
      }

      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: { [testChatId]: partialContext },
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('User Tags')).toBeInTheDocument()
        expect(screen.getByText('SOMO')).toBeInTheDocument()
        expect(screen.queryByText('AI Summary')).not.toBeInTheDocument()
        expect(screen.queryByText(/Recent Messages/)).not.toBeInTheDocument()
      })
    })

    it('displays only RAG summary when only summary is available', () => {
      const partialContext: ConversationContext = {
        messages: [],
        userTags: [],
        ragSummary: 'Test summary',
      }

      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: { [testChatId]: partialContext },
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.getByText('AI Summary')).toBeInTheDocument()
        expect(screen.getByText('Test summary')).toBeInTheDocument()
        expect(screen.queryByText('User Tags')).not.toBeInTheDocument()
        expect(screen.queryByText(/Recent Messages/)).not.toBeInTheDocument()
      })
    })
  })

  describe('close button', () => {
    it('renders close button when onClose is provided', () => {
      const mockOnClose = vi.fn()

      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: { [testChatId]: mockContext },
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel onClose={mockOnClose} />)

      waitFor(() => {
        const closeButton = screen.getByTitle('Close')
        expect(closeButton).toBeInTheDocument()
      })
    })

    it('does not render close button when onClose is not provided', () => {
      mockLoadContext.mockResolvedValue(undefined)

      vi.mocked(useChatStore).mockReturnValue({
        chats: [],
        messages: {},
        conversationContext: { [testChatId]: mockContext },
        selectedChatId: testChatId,
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
        claimChat: vi.fn(),
        releaseChat: vi.fn(),
        loadContext: mockLoadContext,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        updateChat: vi.fn(),
        setTyping: vi.fn(),
      })

      render(<ContextPanel />)

      waitFor(() => {
        expect(screen.queryByTitle('Close')).not.toBeInTheDocument()
      })
    })
  })
})
