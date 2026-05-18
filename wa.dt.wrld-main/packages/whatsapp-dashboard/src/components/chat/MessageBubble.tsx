import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Check, CheckCheck, Clock, AlertCircle, Bot, User } from 'lucide-react'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  showSender?: boolean
}

function StatusIcon({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3 h-3 text-primary-foreground/60" />
    case 'sent':
      return <Check className="w-3 h-3 text-primary-foreground/60" />
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
    case 'read':
      return <CheckCheck className="w-3 h-3 text-blue-500" />
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-500" />
    default:
      return null
  }
}

function SenderBadge({ sender }: { sender: Message['sender'] }) {
  if (sender.type === 'customer') return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded',
        sender.type === 'bot'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-blue-100 text-blue-700'
      )}
    >
      {sender.type === 'bot' ? (
        <Bot className="w-3 h-3" />
      ) : (
        <User className="w-3 h-3" />
      )}
      {sender.name}
    </span>
  )
}

export function MessageBubble({ message, showSender = false }: MessageBubbleProps) {
  const isOutgoing = message.isFromMe
  const formattedTime = format(new Date(message.timestamp), 'HH:mm')

  return (
    <div
      className={cn(
        'flex',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] px-3 py-2',
          isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'
        )}
      >
        {/* Sender badge for outgoing messages */}
        {showSender && isOutgoing && message.sender.type !== 'customer' && (
          <div className="mb-1">
            <SenderBadge sender={message.sender} />
          </div>
        )}

        {/* Quoted message */}
        {message.quotedMessage && (
          <div
            className={cn(
              'mb-2 px-2 py-1 text-xs rounded border-l-2',
              isOutgoing
                ? 'bg-white/10 border-white/40'
                : 'bg-secondary border-border'
            )}
          >
            <p className="font-medium truncate">
              {message.quotedMessage.sender}
            </p>
            <p className="truncate opacity-80">
              {message.quotedMessage.content}
            </p>
          </div>
        )}

        {/* Media content */}
        {message.mediaUrl && message.contentType !== 'text' && (
          <div className="mb-2">
            {message.contentType === 'image' && (
              <img
                src={message.mediaUrl}
                alt=""
                className="max-w-full rounded-lg"
              />
            )}
            {message.contentType === 'video' && (
              <video
                src={message.mediaUrl}
                controls
                className="max-w-full rounded-lg"
              />
            )}
            {message.contentType === 'audio' && (
              <audio src={message.mediaUrl} controls className="w-full" />
            )}
            {message.contentType === 'document' && (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                Download document
              </a>
            )}
          </div>
        )}

        {/* Text content */}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Footer with time and status */}
        <div
          className={cn(
            'flex items-center justify-end gap-1 mt-1',
            isOutgoing ? 'text-white/70' : 'text-muted-foreground'
          )}
        >
          <span className="text-[10px]">{formattedTime}</span>
          {isOutgoing && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}

// Note message (internal, not sent to customer)
interface NoteMessageProps {
  author: string
  content: string
  timestamp: Date
}

export function NoteMessage({ author, content, timestamp }: NoteMessageProps) {
  const formattedTime = format(timestamp, 'HH:mm')

  return (
    <div className="flex justify-center my-2">
      <div className="max-w-[80%] px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-yellow-700">
            Note from {author}
          </span>
          <span className="text-xs text-yellow-600">{formattedTime}</span>
        </div>
        <p className="text-sm text-yellow-800">{content}</p>
      </div>
    </div>
  )
}
