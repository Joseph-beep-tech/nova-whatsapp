import { http, HttpResponse, delay } from 'msw'
import { mockContacts } from '../data/chats'
import type { Contact, Note, Platform } from '@/types'
import { chatKey } from '@/types'

// Mutable state for tests
let currentContacts: Record<string, Contact> = { ...mockContacts }

// Helper to set contacts for tests
export function setMockContacts(contacts: Record<string, Contact>) {
  currentContacts = { ...contacts }
}

// Reset to default state
export function resetMockContactState() {
  currentContacts = { ...mockContacts }
}

export const contactHandlers = [
  // GET /api/contacts - Get contact info (identifier+platform as query params)
  http.get('/api/contacts', async ({ request }) => {
    await delay(50)

    const url = new URL(request.url)
    const identifier = url.searchParams.get('identifier') || ''
    const platform = (url.searchParams.get('platform') || 'c.us') as Platform
    const key = chatKey(identifier, platform)
    const contact = currentContacts[key]

    if (!contact) {
      return HttpResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    return HttpResponse.json({ success: true, data: contact })
  }),

  // PUT /api/contacts - Update contact (identifier+platform in body)
  http.put('/api/contacts', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as Partial<Contact> & { identifier: string; platform: Platform }
    const key = chatKey(body.identifier, body.platform)

    if (!currentContacts[key]) {
      return HttpResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    currentContacts[key] = {
      ...currentContacts[key],
      ...body,
    }

    return HttpResponse.json({ success: true, data: currentContacts[key] })
  }),

  // GET /api/contacts/notes - Get contact notes (identifier+platform as query params)
  http.get('/api/contacts/notes', async ({ request }) => {
    await delay(50)

    const url = new URL(request.url)
    const identifier = url.searchParams.get('identifier') || ''
    const platform = (url.searchParams.get('platform') || 'c.us') as Platform
    const key = chatKey(identifier, platform)
    const contact = currentContacts[key]

    if (!contact) {
      return HttpResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    return HttpResponse.json({ success: true, data: contact.notes })
  }),

  // POST /api/contacts/notes - Add note to contact (identifier+platform in body)
  http.post('/api/contacts/notes', async ({ request }) => {
    await delay(100)

    const body = (await request.json()) as { identifier: string; platform: Platform; content: string }
    const key = chatKey(body.identifier, body.platform)

    if (!currentContacts[key]) {
      return HttpResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    const newNote: Note = {
      id: `note-${Date.now()}`,
      content: body.content,
      author: 'Test Agent',
      authorId: 'user-agent-1',
      createdAt: new Date(),
    }

    currentContacts[key].notes.push(newNote)

    return HttpResponse.json({ success: true, data: newNote })
  }),
]
