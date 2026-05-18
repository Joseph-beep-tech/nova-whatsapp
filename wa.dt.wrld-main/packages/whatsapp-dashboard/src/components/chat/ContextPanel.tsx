import { useState, useEffect } from 'react'
import { X, Loader2, MessageSquare, Tag, Sparkles } from 'lucide-react'
import { Button, Badge } from '@/components/common'
import { useChatStore } from '@/stores/chatStore'
import type { ConversationMessage } from '@/types'
import { parseChatKey } from '@/types'
import { cn } from '@/lib/utils'

interface ContextPanelProps {
  onClose?: () => void
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { selectedChatId, conversationContext, loadContext } = useChatStore()
  const [isLoading, setIsLoading] = useState(false)

  const context = selectedChatId ? conversationContext[selectedChatId] : null

  // Fetch context when chat is selected
  useEffect(() => {
    if (!selectedChatId) {
      return
    }

    const fetchContext = async () => {
      setIsLoading(true)
      const { identifier, platform } = parseChatKey(selectedChatId)
      await loadContext(identifier, platform, 20)
      setIsLoading(false)
    }

    fetchContext()
  }, [selectedChatId, loadContext])

  if (!selectedChatId) {
    return (
      <div className="w-80 flex-shrink-0 bg-card dark:bg-card flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a chat to view context</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-80 flex-shrink-0 bg-card dark:bg-card flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-80 flex-shrink-0 bg-card dark:bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Conversation Context</h3>
            <p className="text-sm text-muted-foreground">Agent handoff information</p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* User Tags Section */}
        {context?.userTags && context.userTags.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-foreground">User Tags</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {context.userTags.map((tag) => (
                <Badge key={tag} variant="primary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* RAG Summary Section */}
        {context?.ragSummary && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-foreground">AI Summary</h4>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {context.ragSummary}
            </p>
          </div>
        )}

        {/* Recent Messages Section */}
        {context?.messages && context.messages.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-foreground">
                Recent Messages ({context.messages.length})
              </h4>
            </div>
            <div className="space-y-3">
              {context.messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!context?.messages?.length && !context?.ragSummary && !context?.userTags?.length && (
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No context available</p>
          </div>
        )}
      </div>

      {/* Footer - Claimed Info */}
      {context?.claimedBy && context.claimedAt && (
        <div className="p-3 bg-background">
          <p className="text-xs text-muted-foreground">
            Claimed by <span className="font-medium">{context.claimedBy}</span>
            <br />
            {new Date(context.claimedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

interface MessageItemProps {
  message: ConversationMessage
}

function MessageItem({ message }: MessageItemProps) {
  const isFromUser = message.fromUser
  const timestamp = new Date(message.timestamp)

  return (
    <div
      className={cn(
        'p-3 rounded-lg text-sm',
        isFromUser
          ? 'bg-background border border-border'
          : 'bg-primary-50 border border-primary-200'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span
          className={cn(
            'text-xs font-medium',
            isFromUser ? 'text-foreground' : 'text-primary-700'
          )}
        >
          {isFromUser ? 'Customer' : 'Bot'}
        </span>
        <span className="text-xs text-muted-foreground">
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-foreground whitespace-pre-wrap break-words">{message.body}</p>
      {message.hasMedia && (
        <div className="mt-2">
          <Badge variant="info" size="sm">
            {message.mediaType || 'Media'}
          </Badge>
        </div>
      )}
    </div>
  )
}
