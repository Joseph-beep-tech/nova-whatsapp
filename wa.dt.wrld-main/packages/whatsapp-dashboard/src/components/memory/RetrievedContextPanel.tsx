import { useState, useCallback } from 'react'
import { X, Trash2, ChevronLeft, ChevronRight, Search, Loader2, AlertCircle, TrendingUp } from 'lucide-react'
import { Button, Badge, Input } from '@/components/common'
import { useMemoryStore } from '@/stores/memoryStore'
import { parseChatKey } from '@/types'
import { clsx } from 'clsx'

interface RetrievedContextPanelProps {
  chatId: string | null // composite key (identifier:platform)
  onClose?: () => void
}

// Format timestamp to relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Format score to percentage
function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`
}

export function RetrievedContextPanel({ chatId, onClose }: RetrievedContextPanelProps) {
  const { searchResults, isLoading, error, searchMemories, deleteMemory } = useMemoryStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const ITEMS_PER_PAGE = 10

  // Handle search
  const handleSearch = useCallback(
    async (query: string) => {
      if (!chatId) return

      setSearchQuery(query)
      setPage(1)

      const { identifier, platform } = parseChatKey(chatId)
      await searchMemories({
        query: query || '*',
        identifier,
        platform,
        strategy: 'hybrid',
        limit: ITEMS_PER_PAGE,
        offset: 0,
      })
    },
    [chatId, searchMemories]
  )

  // Handle pagination
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (!chatId || !searchQuery) return

      const offset = (newPage - 1) * ITEMS_PER_PAGE
      setPage(newPage)

      const { identifier, platform } = parseChatKey(chatId)
      await searchMemories({
        query: searchQuery || '*',
        identifier,
        platform,
        strategy: 'hybrid',
        limit: ITEMS_PER_PAGE,
        offset,
      })
    },
    [chatId, searchQuery, searchMemories]
  )

  // Handle delete memory
  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
        return
      }

      setDeletingId(messageId)
      const success = await deleteMemory(messageId)
      setDeletingId(null)

      if (success && searchQuery) {
        // Refresh current page after deletion
        handleSearch(searchQuery)
      }
    },
    [deleteMemory, searchQuery, handleSearch]
  )

  // Calculate pagination
  const totalPages = searchResults?.total ? Math.ceil(searchResults.total / ITEMS_PER_PAGE) : 0
  const hasResults = searchResults?.results && searchResults.results.length > 0

  if (!chatId) {
    return (
      <div className="w-96 flex-shrink-0 bg-white border-l border-surface-200 flex items-center justify-center">
        <p className="text-sm text-surface-400">Select a chat to view retrieved context</p>
      </div>
    )
  }

  return (
    <div className="w-96 flex-shrink-0 bg-white border-l border-surface-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-surface-200">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-surface-900">Retrieved Context</h3>
            <p className="text-xs text-surface-500 mt-1">
              Search memories and view relevance scores
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <Input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery)
              }
            }}
            className="pl-9 pr-4"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setSearchQuery('')
                setPage(1)
              }}
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Search Button */}
        <Button
          variant="primary"
          size="sm"
          className="w-full mt-2"
          onClick={() => handleSearch(searchQuery)}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Error State */}
        {error && (
          <div className="p-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !hasResults && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-surface-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !hasResults && searchQuery && (
          <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
            <Search className="w-12 h-12 text-surface-300 mb-3" />
            <p className="text-sm font-medium text-surface-600">No memories found</p>
            <p className="text-xs text-surface-400 mt-1">
              Try a different search query
            </p>
          </div>
        )}

        {/* Initial State */}
        {!isLoading && !hasResults && !searchQuery && (
          <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
            <TrendingUp className="w-12 h-12 text-surface-300 mb-3" />
            <p className="text-sm font-medium text-surface-600">Search to view memories</p>
            <p className="text-xs text-surface-400 mt-1">
              Enter a query to retrieve relevant context
            </p>
          </div>
        )}

        {/* Results List */}
        {hasResults && (
          <div className="divide-y divide-surface-100">
            {searchResults.results!.map((result) => (
              <div
                key={result.id}
                className={clsx(
                  'p-4 hover:bg-surface-50 transition-colors',
                  deletingId === result.id && 'opacity-50 pointer-events-none'
                )}
              >
                {/* Header: Role badge + Timestamp */}
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant={result.role === 'user' ? 'default' : result.role === 'assistant' ? 'info' : 'secondary'}
                  >
                    {result.role}
                  </Badge>
                  <span className="text-xs text-surface-400">
                    {formatRelativeTime(result.timestamp)}
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm text-surface-700 mb-3 line-clamp-4">
                  {result.content}
                </p>

                {/* Scores */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-surface-500">Overall:</span>
                    <Badge variant="success" className="text-xs">
                      {formatScore(result.score)}
                    </Badge>
                  </div>
                  {result.scores.vector !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-surface-400">Vector:</span>
                      <span className="text-xs font-mono text-surface-600">
                        {formatScore(result.scores.vector)}
                      </span>
                    </div>
                  )}
                  {result.scores.keyword !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-surface-400">Keyword:</span>
                      <span className="text-xs font-mono text-surface-600">
                        {formatScore(result.scores.keyword)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer: Tags + Delete */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {result.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(result.id)}
                    disabled={deletingId === result.id}
                    title="Delete memory"
                    className="h-7 w-7"
                  >
                    {deletingId === result.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {hasResults && totalPages > 1 && (
        <div className="p-4 border-t border-surface-200">
          <div className="flex items-center justify-between">
            <div className="text-xs text-surface-500">
              Page {page} of {totalPages}
              {searchResults.total && (
                <span className="ml-1">({searchResults.total} total)</span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isLoading}
                title="Previous page"
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || isLoading}
                title="Next page"
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
