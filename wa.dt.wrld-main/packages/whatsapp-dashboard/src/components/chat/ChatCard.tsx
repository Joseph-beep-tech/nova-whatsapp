import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Users } from 'lucide-react'
import { Avatar, Badge, CountBadge } from '@/components/common'
import type { Chat } from '@/types'

interface ChatCardProps {
  chat: Chat
  isSelected: boolean
  isTyping: boolean
  onClick: () => void
}

export function ChatCard({ chat, isSelected, isTyping, onClick }: ChatCardProps) {
  const formattedTime = formatDistanceToNow(new Date(chat.lastMessageTime), {
    addSuffix: false,
  })

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors',
        'hover:bg-secondary',
        isSelected && 'bg-secondary border-l-2 border-primary'
      )}
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar
          name={chat.contactName}
          imageUrl={chat.avatarUrl}
          size="lg"
          status={chat.status === 'open' ? 'online' : undefined}
        />
        {chat.isGroup && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-0.5">
            <Users className="w-3 h-3 text-white" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground truncate">
            {chat.contactName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formattedTime}
          </span>
        </div>

        {/* Message preview */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isTyping ? (
            <span className="text-sm text-primary italic">
              {chat.typingUser ? `${chat.typingUser} is typing...` : 'Typing...'}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground truncate">
              {chat.lastMessage}
            </span>
          )}
          {chat.unreadCount > 0 && (
            <CountBadge count={chat.unreadCount} className="shrink-0" />
          )}
        </div>

        {/* Tags row */}
        {chat.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {chat.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="primary" size="sm" className="text-[10px] px-1 py-0">
                {tag}
              </Badge>
            ))}
            {chat.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{chat.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Assignment */}
        {chat.assignedTo && (
          <div className="mt-0.5">
            <Badge variant="info" size="sm" className="text-[10px] px-1 py-0">
              {chat.assignedTo}
            </Badge>
          </div>
        )}
      </div>
    </button>
  )
}
