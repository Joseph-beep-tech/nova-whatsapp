import { http, HttpResponse, delay } from 'msw'
import { multipleChats, mockMessages, mockContacts } from '../data/chats'
import type { Chat, Message, ChatFilter, ChatStatus, Note, Platform } from '@/types'
import { chatKey } from '@/types'

// Mutable state for tests
let currentChats: Chat[] = [...multipleChats]
let currentMessages: Record<string, Message[]> = { ...mockMessages }

// Helper to set chats for tests
export function setMockChats(chats: Chat[]) {
  currentChats = [...chats]
}

// Helper to set messages for tests
export function setMockMessages(messages: Record<string, Message[]>) {
  currentMessages = { ...messages }
}

// Reset to default state
export function resetMockChatState() {
  currentChats = [...multipleChats]
  currentMessages = { ...mockMessages }
}

// Helper to filter chats based on filter parameter
function filterChats(chats: Chat[], filter: ChatFilter): Chat[] {
  switch (filter) {
    case 'pending':
      return chats.filter((c) => c.status === 'pending')
    case 'mine':
      return chats.filter((c) => c.assignedTo === 'user-agent-1')
    case 'groups':
      return chats.filter((c) => c.isGroup)
    case 'unassigned':
      return chats.filter((c) => !c.assignedTo)
    case 'all':
    default:
      return chats
  }
}

export const chatHandlers = [
  // GET /api/chats - List all chats or get single chat (with identifier+platform query params)
  // Note: This handler matches when identifier param is present, otherwise the list handler above runs
  http.get('/api/chats', async ({ request }) => {
    await delay(50)

    const url = new URL(request.url)
    const identifier = url.searchParams.get('identifier')
    const platform = url.searchParams.get('platform') as Platform | null

    // If identifier is present, return single chat; otherwise fall through to list
    if (identifier) {
      const key = chatKey(identifier, platform || 'c.us')
      const chat = currentChats.find((c) => chatKey(c.identifier, c.platform) === key || c.id === identifier)

      if (!chat) {
        return HttpResponse.json(
          { success: false, error: 'Chat not found' },
          { status: 404 }
        )
      }

      return HttpResponse.json({ success: true, data: chat })
    }

    // List mode (filter, page, limit)
    const filter = (url.searchParams.get('filter') || 'all') as ChatFilter
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const filteredChats = filterChats(currentChats, filter)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedChats = filteredChats.slice(start, end)

    return HttpResponse.json({
      success: true,
      data: paginatedChats,
      pagination: {
        page,
        limit,
        total: filteredChats.length,
        hasMore: end < filteredChats.length,
      },
    })
  }),

  // GET /api/chats/messages - Get messages for a chat (identifier+platform as query params)
  http.get('/api/chats/messages', async ({ request }) => {
    await delay(100)

    const url = new URL(request.url)
    const identifier = url.searchParams.get('identifier') || ''
    const platform = (url.searchParams.get('platform') || 'c.us') as Platform
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const before = url.searchParams.get('before')

    const key = chatKey(identifier, platform)
    let messages = currentMessages[key] || []

    // If 'before' is provided, filter messages before that ID
    if (before) {
      const beforeIndex = messages.findIndex((m) => m.id === before)
      if (beforeIndex > 0) {
        messages = messages.slice(0, beforeIndex)
      }
    }

    // Limit results
    const paginatedMessages = messages.slice(-limit)

    return HttpResponse.json({
      success: true,
      data: paginatedMessages,
      pagination: {
        page: 1,
        limit,
        total: messages.length,
        hasMore: messages.length > limit,
      },
    })
  }),

  // POST /api/chats/send - Send message (identifier+platform in body)
  http.post('/api/chats/send', async ({ request }) => {
    await delay(150)

    const body = (await request.json()) as { identifier: string; platform: Platform; content: string; contentType?: string }
    const key = chatKey(body.identifier, body.platform)

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      identifier: body.identifier,
      platform: body.platform,
      content: body.content,
      contentType: (body.contentType as Message['contentType']) || 'text',
      timestamp: new Date(),
      sender: { type: 'agent', name: 'Test Agent', id: 'user-agent-1' },
      status: 'sent',
      isFromMe: true,
    }

    // Add to messages
    if (!currentMessages[key]) {
      currentMessages[key] = []
    }
    currentMessages[key].push(newMessage)

    // Update chat's last message
    const chatIndex = currentChats.findIndex((c) => chatKey(c.identifier, c.platform) === key)
    if (chatIndex >= 0) {
      currentChats[chatIndex] = {
        ...currentChats[chatIndex],
        lastMessage: body.content,
        lastMessageTime: new Date(),
      }
    }

    return HttpResponse.json({ success: true, data: newMessage })
  }),

  // POST /api/chats/notes - Add internal note (identifier+platform in body)
  http.post('/api/chats/notes', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as { identifier: string; platform: Platform; content: string }
    const key = chatKey(body.identifier, body.platform)

    const newNote: Note = {
      id: `note-${Date.now()}`,
      content: body.content,
      author: 'Test Agent',
      authorId: 'user-agent-1',
      createdAt: new Date(),
    }

    // Add to contact's notes if contact exists
    const contact = mockContacts[key]
    if (contact) {
      contact.notes.push(newNote)
    }

    return HttpResponse.json({ success: true, data: newNote })
  }),

  // PUT /api/chats/status - Update chat status (identifier+platform in body)
  http.put('/api/chats/status', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as { identifier: string; platform: Platform; status: ChatStatus }
    const key = chatKey(body.identifier, body.platform)

    const chatIndex = currentChats.findIndex((c) => chatKey(c.identifier, c.platform) === key || c.id === body.identifier)
    if (chatIndex < 0) {
      return HttpResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      )
    }

    currentChats[chatIndex] = {
      ...currentChats[chatIndex],
      status: body.status,
    }

    return HttpResponse.json({ success: true, data: currentChats[chatIndex] })
  }),

  // PUT /api/chats/assign - Assign chat to user (identifier+platform in body)
  http.put('/api/chats/assign', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as { identifier: string; platform: Platform; userId?: string }
    const key = chatKey(body.identifier, body.platform)

    const chatIndex = currentChats.findIndex((c) => chatKey(c.identifier, c.platform) === key || c.id === body.identifier)
    if (chatIndex < 0) {
      return HttpResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      )
    }

    currentChats[chatIndex] = {
      ...currentChats[chatIndex],
      assignedTo: body.userId,
    }

    return HttpResponse.json({ success: true, data: currentChats[chatIndex] })
  }),

  // PUT /api/chats/labels - Update chat labels (identifier+platform in body)
  http.put('/api/chats/labels', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as { identifier: string; platform: Platform; labels: string[] }
    const key = chatKey(body.identifier, body.platform)

    const chatIndex = currentChats.findIndex((c) => chatKey(c.identifier, c.platform) === key || c.id === body.identifier)
    if (chatIndex < 0) {
      return HttpResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      )
    }

    currentChats[chatIndex] = {
      ...currentChats[chatIndex],
      tags: body.labels,
    }

    return HttpResponse.json({ success: true, data: currentChats[chatIndex] })
  }),
]
