import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Send } from 'lucide-react'
import { Avatar, Button, TextArea } from '@/components/common'
import type { Note } from '@/types'

interface NotesProps {
  notes: Note[]
  onAddNote: (content: string) => Promise<void>
}

function NoteItem({ note }: { note: Note }) {
  return (
    <div className="flex gap-3 py-3">
      <Avatar name={note.author} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {note.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(note.createdAt), 'MMM d, HH:mm')}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
          {note.content}
        </p>
      </div>
    </div>
  )
}

export function Notes({ notes, onAddNote }: NotesProps) {
  const [newNote, setNewNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!newNote.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddNote(newNote.trim())
      setNewNote('')
    } finally {
      setIsSubmitting(false)
    }
  }, [newNote, isSubmitting, onAddNote])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Add note form */}
      <div className="flex gap-2">
        <TextArea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          rows={2}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="icon"
          onClick={handleSubmit}
          disabled={!newNote.trim() || isSubmitting}
          isLoading={isSubmitting}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Press Cmd+Enter to submit
      </p>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No notes yet
        </p>
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
