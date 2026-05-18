import { useEffect, useMemo } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/common'
import { ChatCard } from './ChatCard'
import { useChatStore } from '@/stores/chatStore'
import type { ChatFilter } from '@/types'
import { chatKey } from '@/types'
import { cn } from '@/lib/utils'

const filters: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'mine', label: 'My chats' },
  { value: 'groups', label: 'Groups' },
  { value: 'unassigned', label: 'Unassigned' },
]

export function ChatList() {
  const {
    chats,
    filter,
    searchQuery,
    selectedChatId,
    isLoading,
    typingChats,
    fetchChats,
    setFilter,
    setSearchQuery,
    selectChat,
  } = useChatStore()

  // Initial fetch
  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  // Filter and search chats
  const filteredChats = useMemo(() => {
    let result = chats

    // Apply filter tabs (client-side filtering)
    switch (filter) {
      case 'pending':
        result = result.filter((chat) => chat.status === 'pending')
        break
      case 'mine':
        // TODO: Replace 'You' with actual current user ID from auth
        result = result.filter((chat) => chat.assignedTo === 'You' || chat.assignedTo === 'Agent 1')
        break
      case 'groups':
        result = result.filter((chat) => chat.isGroup)
        break
      case 'unassigned':
        result = result.filter((chat) => !chat.assignedTo)
        break
      case 'all':
      default:
        // No filtering needed for 'all'
        break
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (chat) =>
          chat.contactName.toLowerCase().includes(query) ||
          chat.lastMessage.toLowerCase().includes(query) ||
          chat.contactPhone.includes(query)
      )
    }

    // Sort by last message time (newest first)
    return [...result].sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    )
  }, [chats, filter, searchQuery])

  return (
    <div className="flex flex-col h-full bg-card dark:bg-card">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-xl font-semibold text-foreground">Chats</h1>

        {/* Search */}
        <div className="mt-3">
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No chats found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredChats.map((chat) => {
              const key = chatKey(chat.identifier, chat.platform)
              return (
                <ChatCard
                  key={chat.id}
                  chat={chat}
                  isSelected={key === selectedChatId}
                  isTyping={typingChats.has(key)}
                  onClick={() => selectChat(key)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
