import { useState, useEffect } from 'react'
import { Brain } from 'lucide-react'
import {
  MemoryStatsCard,
  RetrievedContextPanel,
  MemoryExportButton,
} from '@/components/memory'
import { useMemoryStore } from '@/stores/memoryStore'
import { useChatStore } from '@/stores/chatStore'
import { chatKey, parseChatKey } from '@/types'

export function MemoryInsightsPage() {
  const [selectedChatId, setSelectedChatId] = useState<string>('')
  const { memoryStats, isLoading, error, fetchMemoryStats } = useMemoryStore()
  const { selectedChatId: chatStoreSelectedId, chats } = useChatStore()

  // Use selected chat from chat store
  useEffect(() => {
    if (chatStoreSelectedId) {
      setSelectedChatId(chatStoreSelectedId)
      const { identifier, platform } = parseChatKey(chatStoreSelectedId)
      fetchMemoryStats(identifier, platform)
    }
  }, [chatStoreSelectedId, fetchMemoryStats])

  // Find selected chat for display
  const selectedChat = selectedChatId
    ? chats.find((chat) => chatKey(chat.identifier, chat.platform) === selectedChatId)
    : undefined

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-card dark:bg-card border-b border-border">
        <Brain className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">
          Memory Insights
        </h1>
        {selectedChat && (
          <span className="text-sm text-muted-foreground">
            • {selectedChat.contactName}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Card */}
          <div className="bg-card dark:bg-card rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Memory Statistics
              </h2>
              {selectedChatId && (
                <MemoryExportButton chatId={selectedChatId} />
              )}
            </div>
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading memory statistics...
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {!isLoading && !error && memoryStats?.collections && memoryStats.collections.length > 0 && (
              <div className="space-y-4">
                {memoryStats.collections.map((collection) => (
                  <MemoryStatsCard key={collection.collectionName} stats={collection} />
                ))}
              </div>
            )}
            {!isLoading && !error && !memoryStats && (
              <div className="text-center py-8 text-muted-foreground">
                Select a chat to view memory insights
              </div>
            )}
          </div>

          {/* Retrieved Context Panel */}
          {selectedChatId && (
            <div className="bg-card dark:bg-card rounded-lg shadow-sm border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Retrieved Memories
              </h2>
              <RetrievedContextPanel chatId={selectedChatId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
