import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { Send, Paperclip, Smile, StickyNote } from 'lucide-react'
import { Button } from '@/components/common'
import { cn } from '@/lib/utils'

type InputMode = 'reply' | 'note'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  onSendNote: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSendMessage,
  onSendNote,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [mode, setMode] = useState<InputMode>('reply')
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const content = message.trim()
    if (!content) return

    if (mode === 'reply') {
      onSendMessage(content)
    } else {
      onSendNote(content)
    }

    setMessage('')
    textareaRef.current?.focus()
  }, [message, mode, onSendMessage, onSendNote])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  return (
    <div className="bg-card dark:bg-card">
      {/* Mode tabs */}
      <div className="flex">
        <button
          onClick={() => setMode('reply')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            mode === 'reply'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Send className="w-4 h-4" />
          Reply
        </button>
        <button
          onClick={() => setMode('note')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            mode === 'note'
              ? 'text-yellow-600 border-b-2 border-yellow-500'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <StickyNote className="w-4 h-4" />
          Note
        </button>
      </div>

      {/* Input area */}
      <div
        className={cn(
          'p-3',
          mode === 'note' && 'bg-yellow-50'
        )}
      >
        {mode === 'note' && (
          <p className="text-xs text-yellow-700 mb-2">
            Notes are internal and won't be sent to the customer.
          </p>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          {/* Emoji button */}
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            title="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </Button>

          {/* Text input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'note' ? 'Write a note...' : placeholder}
              disabled={disabled}
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg resize-none',
                'border border-border/40 bg-card dark:bg-card',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring',
                'disabled:bg-secondary disabled:cursor-not-allowed',
                'max-h-[120px]'
              )}
              rows={1}
            />
          </div>

          {/* Send button */}
          <Button
            variant={mode === 'note' ? 'secondary' : 'primary'}
            size="icon"
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            title={mode === 'note' ? 'Add note' : 'Send message'}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
