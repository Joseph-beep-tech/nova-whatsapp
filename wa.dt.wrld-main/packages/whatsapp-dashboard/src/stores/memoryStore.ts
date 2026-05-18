import { create } from 'zustand'
import { USE_MOCK_API } from '@/lib/config'

// Import backend API types
// Note: These types are defined in the backend service
// In a real monorepo setup, these would be shared via a common package
// For now, we redefine them here to maintain type safety
interface CollectionStats {
  collectionName: string
  vectorCount: number
  indexedVectors: number
  storageSizeBytes?: number
  lastUpdatedAt?: string
}

interface MemoryStatsResponse {
  success: boolean
  error?: string
  identifier?: string
  platform?: string
  tags?: string[]
  collections?: CollectionStats[]
  totalMessages?: number
  totalStorageBytes?: number
}

interface MemorySearchRequest {
  query: string
  identifier?: string
  platform?: string
  tag?: string
  collection?: string
  strategy?: 'vector' | 'keyword' | 'hybrid'
  limit?: number
  offset?: number
  minScore?: number
  after?: string
  before?: string
}

interface MemorySearchResultItem {
  id: string
  identifier: string
  platform: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  tags: string[]
  score: number
  scores: {
    vector?: number
    keyword?: number
  }
  collection?: string
}

interface MemorySearchResponse {
  success: boolean
  error?: string
  results?: MemorySearchResultItem[]
  total?: number
  count?: number
  offset?: number
  limit?: number
  query?: string
  strategy?: 'vector' | 'keyword' | 'hybrid'
}

interface MemoryExportItem {
  id: string
  identifier: string
  platform: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  tags: string[]
  collection: string
  metadata?: Record<string, unknown>
}

interface MemoryExportResponse {
  success: boolean
  error?: string
  identifier?: string
  platform?: string
  exportedAt?: string
  messages?: MemoryExportItem[]
  count?: number
  collections?: string[]
}

interface DeleteMemoryResponse {
  success: boolean
  error?: string
  messageId?: string
  collection?: string
  deleted?: boolean
}

// Mock data for development/testing
const MOCK_MEMORY_STATS: MemoryStatsResponse = {
  success: true,
  identifier: 'test',
  platform: 'c.us',
  tags: ['SOMO', 'support'],
  collections: [
    {
      collectionName: 'whatsapp_conversations',
      vectorCount: 42,
      indexedVectors: 42,
      storageSizeBytes: 1024000,
      lastUpdatedAt: new Date().toISOString(),
    },
  ],
  totalMessages: 42,
  totalStorageBytes: 1024000,
}

const MOCK_SEARCH_RESULTS: MemorySearchResponse = {
  success: true,
  results: [
    {
      id: 'msg-1',
      identifier: 'test',
      platform: 'c.us',
      sessionId: 'mysession',
      role: 'user',
      content: 'What is the refund policy?',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
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
      role: 'assistant',
      content: 'Our refund policy allows returns within 30 days...',
      timestamp: new Date(Date.now() - 86400000 + 60000).toISOString(),
      tags: ['SOMO'],
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
  strategy: 'hybrid',
}

interface MemoryStore {
  // State
  memoryStats: MemoryStatsResponse | null
  searchResults: MemorySearchResponse | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchMemoryStats: (identifier: string, platform?: string) => Promise<void>
  searchMemories: (request: MemorySearchRequest) => Promise<void>
  exportMemories: (identifier: string, platform?: string) => Promise<MemoryExportResponse | null>
  deleteMemory: (messageId: string) => Promise<boolean>
  clearError: () => void
  reset: () => void
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  // Initial state
  memoryStats: null,
  searchResults: null,
  isLoading: false,
  error: null,

  // Fetch memory statistics for a specific chat
  fetchMemoryStats: async (identifier: string, platform = 'c.us') => {
    set({ isLoading: true, error: null })

    if (USE_MOCK_API) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300))
      set({
        memoryStats: MOCK_MEMORY_STATS,
        isLoading: false,
      })
      return
    }

    try {
      const params = new URLSearchParams({ identifier, platform })
      const response = await fetch(`/service/memory/stats?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch memory stats: ${response.status}`)
      }

      const data: MemoryStatsResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch memory stats')
      }

      set({
        memoryStats: data,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch memory stats'
      set({
        memoryStats: null,
        isLoading: false,
        error: message,
      })
    }
  },

  // Search memories with filters
  searchMemories: async (request: MemorySearchRequest) => {
    set({ isLoading: true, error: null })

    if (USE_MOCK_API) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 400))
      set({
        searchResults: MOCK_SEARCH_RESULTS,
        isLoading: false,
      })
      return
    }

    try {
      const response = await fetch('/service/memory/search', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Failed to search memories: ${response.status}`)
      }

      const data: MemorySearchResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to search memories')
      }

      set({
        searchResults: data,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search memories'
      set({
        searchResults: null,
        isLoading: false,
        error: message,
      })
    }
  },

  // Export memories for a chat (returns data for download)
  exportMemories: async (identifier: string, platform = 'c.us'): Promise<MemoryExportResponse | null> => {
    set({ isLoading: true, error: null })

    if (USE_MOCK_API) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500))
      const mockExport: MemoryExportResponse = {
        success: true,
        identifier,
        platform,
        exportedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-1',
            identifier,
            platform,
            sessionId: 'mysession',
            role: 'user',
            content: 'What is the refund policy?',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            tags: ['SOMO'],
            collection: 'whatsapp_conversations',
          },
          {
            id: 'msg-2',
            identifier,
            platform,
            sessionId: 'mysession',
            role: 'assistant',
            content: 'Our refund policy allows returns within 30 days...',
            timestamp: new Date(Date.now() - 86400000 + 60000).toISOString(),
            tags: ['SOMO'],
            collection: 'whatsapp_conversations',
          },
        ],
        count: 2,
        collections: ['whatsapp_conversations'],
      }
      set({ isLoading: false })
      return mockExport
    }

    try {
      const params = new URLSearchParams({ identifier, platform })
      const response = await fetch(`/service/memory/export?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to export memories: ${response.status}`)
      }

      const data: MemoryExportResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to export memories')
      }

      set({ isLoading: false })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export memories'
      set({
        isLoading: false,
        error: message,
      })
      return null
    }
  },

  // Delete a specific memory
  deleteMemory: async (messageId: string): Promise<boolean> => {
    set({ isLoading: true, error: null })

    if (USE_MOCK_API) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Remove from search results if present
      const currentResults = get().searchResults
      if (currentResults?.results) {
        set({
          searchResults: {
            ...currentResults,
            results: currentResults.results.filter((r) => r.id !== messageId),
            count: (currentResults.count || 0) - 1,
            total: (currentResults.total || 0) - 1,
          },
          isLoading: false,
        })
      } else {
        set({ isLoading: false })
      }
      return true
    }

    try {
      const response = await fetch(`/service/memory/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.status}`)
      }

      const data: DeleteMemoryResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete memory')
      }

      // Remove from search results if present
      const currentResults = get().searchResults
      if (currentResults?.results) {
        set({
          searchResults: {
            ...currentResults,
            results: currentResults.results.filter((r) => r.id !== messageId),
            count: (currentResults.count || 0) - 1,
            total: (currentResults.total || 0) - 1,
          },
        })
      }

      set({ isLoading: false })
      return data.deleted || false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete memory'
      set({
        isLoading: false,
        error: message,
      })
      return false
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null })
  },

  // Reset store to initial state
  reset: () => {
    set({
      memoryStats: null,
      searchResults: null,
      isLoading: false,
      error: null,
    })
  },
}))

// Selector hooks for common use cases
export const useMemoryStats = () => useMemoryStore((state) => state.memoryStats)

export const useSearchResults = () => useMemoryStore((state) => state.searchResults)

export const useMemoryLoading = () => useMemoryStore((state) => state.isLoading)

export const useMemoryError = () => useMemoryStore((state) => state.error)
