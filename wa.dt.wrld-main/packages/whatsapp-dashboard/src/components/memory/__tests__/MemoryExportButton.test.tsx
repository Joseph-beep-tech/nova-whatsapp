import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryExportButton } from '../MemoryExportButton'
import { useMemoryStore } from '@/stores/memoryStore'

// Mock the memory store
vi.mock('@/stores/memoryStore', () => ({
  useMemoryStore: vi.fn(),
}))

describe('MemoryExportButton', () => {
  const mockExportMemories = vi.fn()
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()

    // jsdom doesn't provide URL.createObjectURL/revokeObjectURL — define them before spying
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn()
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn()
    }

    // Mock URL.createObjectURL and URL.revokeObjectURL
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // Default mock implementation
    vi.mocked(useMemoryStore).mockImplementation((selector) =>
      selector({
        memoryStats: null,
        searchResults: null,
        isLoading: false,
        error: null,
        fetchMemoryStats: vi.fn(),
        searchMemories: vi.fn(),
        exportMemories: mockExportMemories,
        deleteMemory: vi.fn(),
        clearError: vi.fn(),
        reset: vi.fn(),
      })
    )
  })

  afterEach(() => {
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  describe('rendering', () => {
    it('renders export button with default props', () => {
      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('renders with custom variant and size', () => {
      render(<MemoryExportButton chatId="test:c.us" variant="primary" size="lg" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      expect(button).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<MemoryExportButton chatId="test:c.us" className="custom-class" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      expect(button).toHaveClass('custom-class')
    })

    it('shows download icon when not loading', () => {
      const { container } = render(<MemoryExportButton chatId="test:c.us" />)

      // Check for Download icon (lucide-react adds svg)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('disables button when no chatId provided', () => {
      render(<MemoryExportButton chatId="" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      expect(button).toBeDisabled()
    })
  })

  describe('export functionality', () => {
    it('calls exportMemories when button is clicked', async () => {
      const user = userEvent.setup()
      const mockExportData = {
        success: true,
        identifier: 'test', platform: 'c.us',
        exportedAt: '2024-02-10T10:00:00Z',
        messages: [
          {
            id: 'msg-1',
            identifier: 'test', platform: 'c.us',
            sessionId: 'mysession',
            role: 'user' as const,
            content: 'Test message',
            timestamp: '2024-02-10T09:00:00Z',
            tags: ['test'],
            collection: 'whatsapp_conversations',
          },
        ],
        count: 1,
        collections: ['whatsapp_conversations'],
      }

      mockExportMemories.mockResolvedValue(mockExportData)

      // Render first, then spy on DOM methods (mocking appendChild before render breaks createRoot)
      render(<MemoryExportButton chatId="test:c.us" />)

      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockExportMemories).toHaveBeenCalledWith('test', 'c.us')
      })

      // Verify download was triggered
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalled()

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('generates correct filename with timestamp', async () => {
      const user = userEvent.setup()
      const mockExportData = {
        success: true,
        identifier: 'test', platform: 'c.us',
        exportedAt: '2024-02-10T10:00:00Z',
        messages: [],
        count: 0,
        collections: [],
      }

      mockExportMemories.mockResolvedValue(mockExportData)

      render(<MemoryExportButton chatId="test:c.us" />)

      // Spy on appendChild to capture the created link element
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        const linkCall = appendChildSpy.mock.calls.find(
          ([el]) => el instanceof HTMLAnchorElement
        )
        expect(linkCall).toBeDefined()
        const link = linkCall![0] as HTMLAnchorElement
        expect(link.download).toMatch(/^memory-export-test:c\.us-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/)
      })

      appendChildSpy.mockRestore()
    })
  })

  describe('loading state', () => {
    it('shows loading state during export', async () => {
      const user = userEvent.setup()
      let resolveExport: (value: any) => void
      const exportPromise = new Promise((resolve) => {
        resolveExport = resolve
      })

      mockExportMemories.mockReturnValue(exportPromise)

      const { container } = render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      // Button component replaces children with spinner when isLoading
      await waitFor(() => {
        expect(container.querySelector('.animate-spin')).toBeInTheDocument()
      })

      // Button should be disabled during export
      expect(button).toBeDisabled()

      // Resolve the export
      resolveExport!({
        success: true,
        identifier: 'test', platform: 'c.us',
        messages: [],
        count: 0,
      })

      await waitFor(() => {
        expect(screen.getByText('Export Memories')).toBeInTheDocument()
      })
    })

    it('disables button during export', async () => {
      const user = userEvent.setup()
      let resolveExport: (value: any) => void
      const exportPromise = new Promise((resolve) => {
        resolveExport = resolve
      })

      mockExportMemories.mockReturnValue(exportPromise)

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
      })

      resolveExport!({ success: true, identifier: 'test', platform: 'c.us', messages: [], count: 0 })
    })
  })

  describe('error handling', () => {
    it('displays error when export returns null', async () => {
      const user = userEvent.setup()
      mockExportMemories.mockResolvedValue(null)

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
        expect(screen.getByText('Export failed: No data returned')).toBeInTheDocument()
      })
    })

    it('displays error when export throws', async () => {
      const user = userEvent.setup()
      mockExportMemories.mockRejectedValue(new Error('Network error'))

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('displays generic error for non-Error exceptions', async () => {
      const user = userEvent.setup()
      mockExportMemories.mockRejectedValue('String error')

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
        expect(screen.getByText('Failed to export memories')).toBeInTheDocument()
      })
    })

    it('allows dismissing error message', async () => {
      const user = userEvent.setup()
      mockExportMemories.mockResolvedValue(null)

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
      })

      // Find and click dismiss button
      const dismissButton = screen.getByLabelText('Dismiss error')
      await user.click(dismissButton)

      await waitFor(() => {
        expect(screen.queryByText('Export Failed')).not.toBeInTheDocument()
      })
    })

    it('clears previous error on new export attempt', async () => {
      const user = userEvent.setup()

      // First export fails
      mockExportMemories.mockResolvedValueOnce(null)

      render(<MemoryExportButton chatId="test:c.us" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
      })

      // Second export succeeds
      mockExportMemories.mockResolvedValueOnce({
        success: true,
        identifier: 'test', platform: 'c.us',
        messages: [],
        count: 0,
      })

      await user.click(button)

      await waitFor(() => {
        expect(screen.queryByText('Export Failed')).not.toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty chatId gracefully', () => {
      render(<MemoryExportButton chatId="" />)

      const button = screen.getByRole('button', { name: /export memories/i })
      expect(button).toBeDisabled()
    })

    it('does not call export when disabled', async () => {
      const user = userEvent.setup()
      render(<MemoryExportButton chatId="" />)

      const button = screen.getByRole('button', { name: /export memories/i })

      // Try to click disabled button
      await user.click(button)

      expect(mockExportMemories).not.toHaveBeenCalled()
    })
  })
})
