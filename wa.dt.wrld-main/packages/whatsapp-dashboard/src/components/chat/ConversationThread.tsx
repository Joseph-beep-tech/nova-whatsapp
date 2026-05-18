import { useEffect, useRef, useCallback } from 'react'
import { Loader2, MessageSquare, CheckCircle, Pin, Bell, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/common'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TakeoverButton } from './TakeoverButton'
import { ContextPanel } from './ContextPanel'
import { useChatStore } from '@/stores/chatStore'
import { messageApi } from '@/lib/api'
import { chatKey, parseChatKey } from '@/types'

interface ConversationHeaderProps {
  chatId: string
  onResolve: () => void
  onPin: () => void
  onMute: () => void
  onDelete: () => void
  onAssign: () => void
}

function ConversationHeader({
  chatId,
  onResolve,
  onPin,
  onMute,
  onDelete,
  onAssign,
}: ConversationHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card dark:bg-card">
      <h2 className="font-semibold text-foreground">Conversation</h2>
      <div className="flex items-center gap-2">
        {/* Takeover Button */}
        <TakeoverButton chatId={chatId} />

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/30">
          <Button
            variant="ghost"
            size="icon"
            onClick={onResolve}
            title="Resolve"
          >
            <CheckCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPin}
            title="Pin"
          >
            <Pin className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMute}
            title="Mute/Unmute"
          >
            <Bell className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onAssign}
            title="Assign"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <MessageSquare className="w-16 h-16 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">
        Select a conversation
      </h3>
      <p className="text-sm mt-1">
        Choose a chat from the list to start messaging
      </p>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-muted-foreground ml-2">Typing...</span>
    </div>
  )
}

export function ConversationThread() {
  const {
    selectedChatId,
    messages,
    chats,
    typingChats,
    sendMessage,
    updateChatStatus,
    fetchMessages,
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentMessages = selectedChatId ? messages[selectedChatId] || [] : []
  const currentChat = selectedChatId ? chats.find((c) => chatKey(c.identifier, c.platform) === selectedChatId) : undefined
  const isTyping = selectedChatId ? typingChats.has(selectedChatId) : false

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages.length])

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChatId && !messages[selectedChatId]) {
      const { identifier, platform } = parseChatKey(selectedChatId)
      fetchMessages(identifier, platform)
    }
  }, [selectedChatId, messages, fetchMessages])

  const handleSendMessage = useCallback(
    (content: string) => {
      if (selectedChatId) {
        const { identifier, platform } = parseChatKey(selectedChatId)
        sendMessage(identifier, platform, content)
      }
    },
    [selectedChatId, sendMessage]
  )

  const handleSendNote = useCallback(
    async (content: string) => {
      if (selectedChatId) {
        const { identifier, platform } = parseChatKey(selectedChatId)
        await messageApi.sendNote(identifier, platform, content)
        // Note will appear via WebSocket event
      }
    },
    [selectedChatId]
  )

  const handleResolve = useCallback(() => {
    if (selectedChatId) {
      const { identifier, platform } = parseChatKey(selectedChatId)
      updateChatStatus(identifier, platform, 'resolved')
    }
  }, [selectedChatId, updateChatStatus])

  const handlePin = useCallback(() => {
    // TODO: Implement pin functionality
    console.log('Pin chat:', selectedChatId)
  }, [selectedChatId])

  const handleMute = useCallback(() => {
    // TODO: Implement mute functionality
    console.log('Mute chat:', selectedChatId)
  }, [selectedChatId])

  const handleDelete = useCallback(() => {
    // TODO: Implement delete functionality
    console.log('Delete chat:', selectedChatId)
  }, [selectedChatId])

  const handleAssign = useCallback(() => {
    // TODO: Implement assign functionality
    console.log('Assign chat:', selectedChatId)
  }, [selectedChatId])

  if (!selectedChatId) {
    return (
      <div className="flex flex-col h-full bg-background">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      {/* Main Conversation Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <ConversationHeader
          chatId={selectedChatId}
          onResolve={handleResolve}
          onPin={handlePin}
          onMute={handleMute}
          onDelete={handleDelete}
          onAssign={handleAssign}
        />

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 chat-pattern"
        >
          {currentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : (
            currentMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showSender={message.isFromMe}
              />
            ))
          )}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendNote={handleSendNote}
          disabled={!currentChat || currentChat.status === 'resolved'}
          placeholder={
            currentChat?.status === 'resolved'
              ? 'This conversation is resolved'
              : 'Type a message...'
          }
        />
      </div>

      {/* Context Panel */}
      <ContextPanel />
    </div>
  )
}
