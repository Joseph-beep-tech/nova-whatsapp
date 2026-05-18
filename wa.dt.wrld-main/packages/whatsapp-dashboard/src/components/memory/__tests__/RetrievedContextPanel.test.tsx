import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RetrievedContextPanel } from '../RetrievedContextPanel'
import { useMemoryStore } from '@/stores/memoryStore'

// Mock the memory store
vi.mock('@/stores/memoryStore', () => ({
  useMemoryStore: vi.fn(),
}))

describe('RetrievedContextPanel', () => {
  const mockSearchMemories = vi.fn()
  const mockDeleteMemory = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementation
    vi.mocked(useMemoryStore).mockReturnValue({
      searchResults: null,
      isLoading: false,
      error: null,
      searchMemories: mockSearchMemories,
      deleteMemory: mockDeleteMemory,
      memoryStats: null,
      exportMemories: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
    })
  })

  describe('initial states', () => {
    it('shows message when no chat is selected', () => {
      render(<RetrievedContextPanel chatId={null} />)

      expect(screen.getByText('Select a chat to view retrieved context')).toBeInTheDocument()
    })

    it('shows initial state with search prompt', () => {
      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('Retrieved Context')).toBeInTheDocument()
      expect(screen.getByText('Search to view memories')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search memories...')).toBeInTheDocument()
    })
  })

  describe('search functionality', () => {
    it('triggers search on button click', async () => {
      const user = userEvent.setup()
      render(<RetrievedContextPanel chatId="test:c.us" />)

      const searchInput = screen.getByPlaceholderText('Search memories...')
      const searchButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, 'test query')
      await user.click(searchButton)

      expect(mockSearchMemories).toHaveBeenCalledWith({
        query: 'test query',
        identifier: 'test',
        platform: 'c.us',
        strategy: 'hybrid',
        limit: 10,
        offset: 0,
      })
    })

    it('triggers search on Enter key', async () => {
      const user = userEvent.setup()
      render(<RetrievedContextPanel chatId="test:c.us" />)

      const searchInput = screen.getByPlaceholderText('Search memories...')

      await user.type(searchInput, 'test query{Enter}')

      expect(mockSearchMemories).toHaveBeenCalledWith({
        query: 'test query',
        identifier: 'test',
        platform: 'c.us',
        strategy: 'hybrid',
        limit: 10,
        offset: 0,
      })
    })

    it('searches with wildcard when query is empty', async () => {
      const user = userEvent.setup()
      render(<RetrievedContextPanel chatId="test:c.us" />)

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      expect(mockSearchMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '*',
        })
      )
    })

    it('clears search input when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<RetrievedContextPanel chatId="test:c.us" />)

      const searchInput = screen.getByPlaceholderText('Search memories...')
      await user.type(searchInput, 'test query')

      // Clear button should appear
      const clearButton = screen.getByTitle('Clear search')
      await user.click(clearButton)

      expect(searchInput).toHaveValue('')
    })
  })

  describe('loading state', () => {
    it('shows loading spinner during search', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: null,
        isLoading: true,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('Searching...')).toBeInTheDocument()
    })

    it('disables search button during loading', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: null,
        isLoading: true,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      const searchButton = screen.getByRole('button', { name: /searching/i })
      expect(searchButton).toBeDisabled()
    })
  })

  describe('error state', () => {
    it('displays error message', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: null,
        isLoading: false,
        error: 'Failed to search memories',
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Failed to search memories')).toBeInTheDocument()
    })
  })

  describe('search results', () => {
    const mockResults = {
      success: true,
      results: [
        {
          id: 'msg-1',
          identifier: 'test',
          platform: 'c.us',
          sessionId: 'mysession',
          role: 'user' as const,
          content: 'What is the refund policy?',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          tags: ['SOMO'],
          score: 0.92,
          scores: {
            vector: 0.89,
            keyword: 0.95,
          },
          collection: 'whatsapp_conversations',
        },
        {
          id: 'msg-2',
          identifier: 'test',
          platform: 'c.us',
          sessionId: 'mysession',
          role: 'assistant' as const,
          content: 'Our refund policy allows returns within 30 days of purchase.',
          timestamp: new Date(Date.now() - 3500000).toISOString(),
          tags: ['SOMO', 'support'],
          score: 0.87,
          scores: {
            vector: 0.85,
            keyword: 0.89,
          },
          collection: 'whatsapp_conversations',
        },
      ],
      total: 2,
      count: 2,
      offset: 0,
      limit: 10,
      query: 'refund',
      strategy: 'hybrid' as const,
    }

    it('displays search results with all fields', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      // Check first result
      expect(screen.getByText('What is the refund policy?')).toBeInTheDocument()
      expect(screen.getByText('92%')).toBeInTheDocument() // Overall score
      // 89% appears twice: first result vector (0.89) and second result keyword (0.89)
      expect(screen.getAllByText('89%')).toHaveLength(2)
      expect(screen.getByText('95%')).toBeInTheDocument() // Keyword score

      // Check second result
      expect(screen.getByText(/Our refund policy allows returns/)).toBeInTheDocument()
      expect(screen.getByText('87%')).toBeInTheDocument()
    })

    it('displays role badges correctly', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('user')).toBeInTheDocument()
      expect(screen.getByText('assistant')).toBeInTheDocument()
    })

    it('displays tags for each result', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      const somoTags = screen.getAllByText('SOMO')
      expect(somoTags.length).toBeGreaterThan(0)
      expect(screen.getByText('support')).toBeInTheDocument()
    })

    it('shows empty state when no results found', async () => {
      const user = userEvent.setup()

      // Start with no results so empty state shows after search
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: {
          success: true,
          results: [],
          total: 0,
          count: 0,
          offset: 0,
          limit: 10,
          query: 'nonexistent',
          strategy: 'hybrid' as const,
        },
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      // Type a query to set local searchQuery state (required for "No memories found" branch)
      const searchInput = screen.getByPlaceholderText('Search memories...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No memories found')).toBeInTheDocument()
      expect(screen.getByText('Try a different search query')).toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    const mockPaginatedResults = {
      success: true,
      results: Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        identifier: 'test',
        platform: 'c.us',
        sessionId: 'mysession',
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
        tags: ['test'],
        score: 0.9,
        scores: {},
        collection: 'test',
      })),
      total: 25,
      count: 10,
      offset: 0,
      limit: 10,
      query: 'test',
      strategy: 'hybrid' as const,
    }

    it('shows pagination controls when there are multiple pages', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockPaginatedResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('(25 total)')).toBeInTheDocument()
      expect(screen.getByTitle('Previous page')).toBeInTheDocument()
      expect(screen.getByTitle('Next page')).toBeInTheDocument()
    })

    it('disables previous button on first page', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockPaginatedResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      const prevButton = screen.getByTitle('Previous page')
      expect(prevButton).toBeDisabled()
    })

    it('hides pagination when results fit in one page', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: {
          ...mockPaginatedResults,
          total: 5,
          count: 5,
        },
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.queryByText(/Page/)).not.toBeInTheDocument()
    })
  })

  describe('delete functionality', () => {
    const mockResultsWithDelete = {
      success: true,
      results: [
        {
          id: 'msg-1',
          identifier: 'test',
          platform: 'c.us',
          sessionId: 'mysession',
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date().toISOString(),
          tags: ['test'],
          score: 0.9,
          scores: {},
          collection: 'test',
        },
      ],
      total: 1,
      count: 1,
      offset: 0,
      limit: 10,
      query: 'test',
      strategy: 'hybrid' as const,
    }

    it('shows delete button for each result', () => {
      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResultsWithDelete,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByTitle('Delete memory')).toBeInTheDocument()
    })

    it('calls deleteMemory when confirmed', async () => {
      const user = userEvent.setup()
      mockDeleteMemory.mockResolvedValue(true)

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResultsWithDelete,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      const deleteButton = screen.getByTitle('Delete memory')
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(mockDeleteMemory).toHaveBeenCalledWith('msg-1')

      confirmSpy.mockRestore()
    })

    it('does not delete when cancelled', async () => {
      const user = userEvent.setup()

      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockResultsWithDelete,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      const deleteButton = screen.getByTitle('Delete memory')
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(mockDeleteMemory).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<RetrievedContextPanel chatId="test:c.us" onClose={onClose} />)

      const closeButton = screen.getByTitle('Close')
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('does not render close button when onClose is not provided', () => {
      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.queryByTitle('Close')).not.toBeInTheDocument()
    })
  })

  describe('time formatting', () => {
    it('formats recent times correctly', () => {
      const mockRecentResults = {
        success: true,
        results: [
          {
            id: 'msg-recent',
            identifier: 'test',
          platform: 'c.us',
            sessionId: 'mysession',
            role: 'user' as const,
            content: 'Recent message',
            timestamp: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
            tags: [],
            score: 0.9,
            scores: {},
            collection: 'test',
          },
        ],
        total: 1,
        count: 1,
        offset: 0,
        limit: 10,
        query: 'test',
        strategy: 'hybrid' as const,
      }

      vi.mocked(useMemoryStore).mockReturnValue({
        searchResults: mockRecentResults,
        isLoading: false,
        error: null,
        searchMemories: mockSearchMemories,
        deleteMemory: mockDeleteMemory,
        memoryStats: null,
        exportMemories: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })

      render(<RetrievedContextPanel chatId="test:c.us" />)

      expect(screen.getByText('just now')).toBeInTheDocument()
    })
  })
})
