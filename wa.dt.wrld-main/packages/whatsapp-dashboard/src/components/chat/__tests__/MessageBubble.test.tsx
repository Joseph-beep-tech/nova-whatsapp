import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble, NoteMessage } from '../MessageBubble'
import type { Message } from '@/types'

// Helper to create test messages
const createMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  identifier: '123',
  platform: 'c.us',
  content: 'Test message content',
  contentType: 'text',
  timestamp: new Date('2026-01-15T10:30:00'),
  sender: { type: 'customer', name: 'John Doe' },
  status: 'read',
  isFromMe: false,
  ...overrides,
})

describe('MessageBubble', () => {
  describe('basic rendering', () => {
    it('renders message content', () => {
      const message = createMessage({ content: 'Hello world!' })
      render(<MessageBubble message={message} />)

      expect(screen.getByText('Hello world!')).toBeInTheDocument()
    })

    it('renders timestamp in HH:mm format', () => {
      const message = createMessage({
        timestamp: new Date('2026-01-15T14:30:00'),
      })
      render(<MessageBubble message={message} />)

      expect(screen.getByText('14:30')).toBeInTheDocument()
    })

    it('preserves whitespace in message content', () => {
      const message = createMessage({ content: 'Line 1\nLine 2\n  Indented' })
      render(<MessageBubble message={message} />)

      const content = screen.getByText(/Line 1/)
      expect(content).toHaveClass('whitespace-pre-wrap')
    })
  })

  describe('message alignment', () => {
    it('aligns incoming messages (isFromMe=false) to the left', () => {
      const message = createMessage({ isFromMe: false })
      render(<MessageBubble message={message} />)

      const container = screen.getByText('Test message content').closest('div.flex')
      expect(container).toHaveClass('justify-start')
    })

    it('aligns outgoing messages (isFromMe=true) to the right', () => {
      const message = createMessage({ isFromMe: true })
      render(<MessageBubble message={message} />)

      const container = screen.getByText('Test message content').closest('div.flex')
      expect(container).toHaveClass('justify-end')
    })
  })

  describe('bubble styling', () => {
    it('applies incoming bubble class for customer messages', () => {
      const message = createMessage({ isFromMe: false })
      render(<MessageBubble message={message} />)

      const bubble = screen.getByText('Test message content').closest('div.px-3')
      expect(bubble).toHaveClass('bubble-incoming')
    })

    it('applies outgoing bubble class for own messages', () => {
      const message = createMessage({ isFromMe: true })
      render(<MessageBubble message={message} />)

      const bubble = screen.getByText('Test message content').closest('div.px-3')
      expect(bubble).toHaveClass('bubble-outgoing')
    })
  })

  describe('status indicators', () => {
    it('shows clock icon for pending status', () => {
      const message = createMessage({ isFromMe: true, status: 'pending' })
      render(<MessageBubble message={message} />)

      // Clock icon should be rendered
      const svg = document.querySelector('.lucide-clock')
      expect(svg).toBeInTheDocument()
    })

    it('shows single check for sent status', () => {
      const message = createMessage({ isFromMe: true, status: 'sent' })
      render(<MessageBubble message={message} />)

      // Check icon should be rendered (not check-check)
      const svg = document.querySelector('.lucide-check')
      expect(svg).toBeInTheDocument()
    })

    it('shows double check (gray) for delivered status', () => {
      const message = createMessage({ isFromMe: true, status: 'delivered' })
      render(<MessageBubble message={message} />)

      // CheckCheck icon should be rendered with muted color
      const svg = document.querySelector('.lucide-check-check')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('text-primary-foreground/60')
    })

    it('shows double check (blue) for read status', () => {
      const message = createMessage({ isFromMe: true, status: 'read' })
      render(<MessageBubble message={message} />)

      // CheckCheck icon should be rendered with blue color
      const svg = document.querySelector('.lucide-check-check')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('text-blue-500')
    })

    it('shows alert icon for failed status', () => {
      const message = createMessage({ isFromMe: true, status: 'failed' })
      render(<MessageBubble message={message} />)

      // AlertCircle icon should be rendered with red color
      // Lucide class name can vary by version: lucide-alert-circle or lucide-circle-alert
      const svg = document.querySelector('.lucide-alert-circle, .lucide-circle-alert')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('text-red-500')
    })

    it('does not show status icon for incoming messages', () => {
      const message = createMessage({ isFromMe: false, status: 'read' })
      render(<MessageBubble message={message} />)

      // No status icons should be present
      expect(document.querySelector('.lucide-check')).not.toBeInTheDocument()
      expect(document.querySelector('.lucide-check-check')).not.toBeInTheDocument()
    })
  })

  describe('sender badge', () => {
    it('does not show sender badge for customer messages', () => {
      const message = createMessage({
        sender: { type: 'customer', name: 'Customer' },
        isFromMe: false,
      })
      render(<MessageBubble message={message} showSender />)

      expect(screen.queryByText('Customer')).not.toBeInTheDocument()
    })

    it('shows bot badge with purple styling for bot messages', () => {
      const message = createMessage({
        sender: { type: 'bot', name: 'SOMO Bot' },
        isFromMe: true,
      })
      render(<MessageBubble message={message} showSender />)

      const badge = screen.getByText('SOMO Bot')
      expect(badge.closest('span')).toHaveClass('bg-purple-100', 'text-purple-700')

      // Bot icon should be present
      const botIcon = document.querySelector('.lucide-bot')
      expect(botIcon).toBeInTheDocument()
    })

    it('shows agent badge with blue styling for agent messages', () => {
      const message = createMessage({
        sender: { type: 'agent', name: 'Test Agent', id: 'agent-1' },
        isFromMe: true,
      })
      render(<MessageBubble message={message} showSender />)

      const badge = screen.getByText('Test Agent')
      expect(badge.closest('span')).toHaveClass('bg-blue-100', 'text-blue-700')

      // User icon should be present
      const userIcon = document.querySelector('.lucide-user')
      expect(userIcon).toBeInTheDocument()
    })

    it('does not show sender badge when showSender is false', () => {
      const message = createMessage({
        sender: { type: 'bot', name: 'SOMO Bot' },
        isFromMe: true,
      })
      render(<MessageBubble message={message} showSender={false} />)

      // Badge should not be visible (only message content)
      expect(screen.queryByText('SOMO Bot')).not.toBeInTheDocument()
    })
  })

  describe('quoted message', () => {
    it('renders quoted message when present', () => {
      const message = createMessage({
        quotedMessage: {
          id: 'q1',
          sender: 'Original Sender',
          content: 'Original quoted content',
        },
      })
      render(<MessageBubble message={message} />)

      expect(screen.getByText('Original Sender')).toBeInTheDocument()
      expect(screen.getByText('Original quoted content')).toBeInTheDocument()
    })

    it('does not render quoted section when not present', () => {
      const message = createMessage({ quotedMessage: undefined })
      render(<MessageBubble message={message} />)

      // Only the main message content should be present
      expect(screen.getByText('Test message content')).toBeInTheDocument()
      // No quoted message section
      expect(screen.queryByText('Original Sender')).not.toBeInTheDocument()
    })

    it('applies correct styling for quoted message in outgoing bubble', () => {
      const message = createMessage({
        isFromMe: true,
        quotedMessage: {
          id: 'q1',
          sender: 'Original',
          content: 'Quoted text',
        },
      })
      render(<MessageBubble message={message} />)

      const quotedSection = screen.getByText('Quoted text').closest('div')
      expect(quotedSection).toHaveClass('bg-white/10', 'border-white/40')
    })

    it('applies correct styling for quoted message in incoming bubble', () => {
      const message = createMessage({
        isFromMe: false,
        quotedMessage: {
          id: 'q1',
          sender: 'Original',
          content: 'Quoted text',
        },
      })
      render(<MessageBubble message={message} />)

      const quotedSection = screen.getByText('Quoted text').closest('div')
      expect(quotedSection).toHaveClass('bg-secondary', 'border-border')
    })
  })

  describe('media content', () => {
    it('renders image with correct src', () => {
      const message = createMessage({
        contentType: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        content: '',
      })
      render(<MessageBubble message={message} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
      expect(img).toHaveClass('rounded-lg')
    })

    it('renders video player for video content', () => {
      const message = createMessage({
        contentType: 'video',
        mediaUrl: 'https://example.com/video.mp4',
        content: '',
      })
      render(<MessageBubble message={message} />)

      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4')
      expect(video).toHaveAttribute('controls')
    })

    it('renders audio player for audio content', () => {
      const message = createMessage({
        contentType: 'audio',
        mediaUrl: 'https://example.com/audio.mp3',
        content: '',
      })
      render(<MessageBubble message={message} />)

      const audio = document.querySelector('audio')
      expect(audio).toBeInTheDocument()
      expect(audio).toHaveAttribute('src', 'https://example.com/audio.mp3')
      expect(audio).toHaveAttribute('controls')
    })

    it('renders download link for document content', () => {
      const message = createMessage({
        contentType: 'document',
        mediaUrl: 'https://example.com/doc.pdf',
        content: '',
      })
      render(<MessageBubble message={message} />)

      const link = screen.getByText('Download document')
      expect(link).toHaveAttribute('href', 'https://example.com/doc.pdf')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not render media section for text-only messages', () => {
      const message = createMessage({
        contentType: 'text',
        mediaUrl: undefined,
        content: 'Just text',
      })
      render(<MessageBubble message={message} />)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(document.querySelector('video')).not.toBeInTheDocument()
      expect(document.querySelector('audio')).not.toBeInTheDocument()
    })

    it('renders text content along with media caption', () => {
      const message = createMessage({
        contentType: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        content: 'Check out this photo!',
        mediaCaption: 'Photo caption',
      })
      render(<MessageBubble message={message} />)

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Check out this photo!')).toBeInTheDocument()
    })
  })

  describe('max width constraint', () => {
    it('applies max-w-[70%] to bubble container', () => {
      const message = createMessage()
      render(<MessageBubble message={message} />)

      const bubble = screen.getByText('Test message content').closest('div.max-w-\\[70\\%\\]')
      expect(bubble).toBeInTheDocument()
    })
  })
})

describe('NoteMessage', () => {
  it('renders note content', () => {
    render(
      <NoteMessage
        author="Agent Smith"
        content="This is an internal note"
        timestamp={new Date('2026-01-15T10:30:00')}
      />
    )

    expect(screen.getByText('This is an internal note')).toBeInTheDocument()
  })

  it('renders author name', () => {
    render(
      <NoteMessage
        author="Agent Smith"
        content="Note content"
        timestamp={new Date('2026-01-15T10:30:00')}
      />
    )

    expect(screen.getByText(/Note from Agent Smith/)).toBeInTheDocument()
  })

  it('renders timestamp', () => {
    render(
      <NoteMessage
        author="Agent"
        content="Note"
        timestamp={new Date('2026-01-15T14:30:00')}
      />
    )

    expect(screen.getByText('14:30')).toBeInTheDocument()
  })

  it('is centered', () => {
    render(
      <NoteMessage
        author="Agent"
        content="Centered note"
        timestamp={new Date()}
      />
    )

    const container = screen.getByText('Centered note').closest('div.flex')
    expect(container).toHaveClass('justify-center')
  })

  it('has yellow/warning styling', () => {
    render(
      <NoteMessage
        author="Agent"
        content="Warning styled note"
        timestamp={new Date()}
      />
    )

    const noteBox = screen.getByText('Warning styled note').closest('div.bg-yellow-50')
    expect(noteBox).toBeInTheDocument()
    expect(noteBox).toHaveClass('border-yellow-200')
  })

  it('constrains width with max-w-[80%]', () => {
    render(
      <NoteMessage
        author="Agent"
        content="Width constrained"
        timestamp={new Date()}
      />
    )

    const noteBox = screen.getByText('Width constrained').closest('div.max-w-\\[80\\%\\]')
    expect(noteBox).toBeInTheDocument()
  })
})
