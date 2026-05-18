import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '../chatStore'
import type { Message, ConversationContext } from '@/types'
import { chatKey } from '@/types'
import { chatApi } from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  chatApi: {
    claim: vi.fn(),
    release: vi.fn(),
    getContext: vi.fn(),
  },
  messageApi: {},
}))

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useChatStore.setState({
      selectedChatId: null,
      filter: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
      typingChats: new Set(),
    })
  })

  describe('selectChat', () => {
    it('updates selectedChatId', () => {
      const { selectChat, selectedChatId } = useChatStore.getState()
      expect(selectedChatId).toBeNull()

      selectChat('123:c.us')
      expect(useChatStore.getState().selectedChatId).toBe('123:c.us')
    })

    it('can clear selection', () => {
      const { selectChat } = useChatStore.getState()
      selectChat('123:c.us')
      selectChat(null)
      expect(useChatStore.getState().selectedChatId).toBeNull()
    })
  })

  describe('setFilter', () => {
    it('updates filter without refetching (client-side filtering)', () => {
      const { setFilter, filter } = useChatStore.getState()
      expect(filter).toBe('all')

      setFilter('pending')
      expect(useChatStore.getState().filter).toBe('pending')

      setFilter('groups')
      expect(useChatStore.getState().filter).toBe('groups')
    })
  })

  describe('setSearchQuery', () => {
    it('updates search query', () => {
      const { setSearchQuery, searchQuery } = useChatStore.getState()
      expect(searchQuery).toBe('')

      setSearchQuery('hello')
      expect(useChatStore.getState().searchQuery).toBe('hello')
    })

    it('can clear search query', () => {
      const { setSearchQuery } = useChatStore.getState()
      setSearchQuery('test')
      setSearchQuery('')
      expect(useChatStore.getState().searchQuery).toBe('')
    })
  })

  describe('setTyping', () => {
    it('adds chat to typing set', () => {
      const { setTyping, typingChats } = useChatStore.getState()
      expect(typingChats.size).toBe(0)

      setTyping('123:c.us', true)
      expect(useChatStore.getState().typingChats.has('123:c.us')).toBe(true)
    })

    it('removes chat from typing set', () => {
      const { setTyping } = useChatStore.getState()
      setTyping('123:c.us', true)
      setTyping('123:c.us', false)
      expect(useChatStore.getState().typingChats.has('123:c.us')).toBe(false)
    })

    it('handles multiple typing chats', () => {
      const { setTyping } = useChatStore.getState()
      setTyping('123:c.us', true)
      setTyping('456:c.us', true)

      const { typingChats } = useChatStore.getState()
      expect(typingChats.size).toBe(2)
      expect(typingChats.has('123:c.us')).toBe(true)
      expect(typingChats.has('456:c.us')).toBe(true)
    })
  })

  describe('addMessage', () => {
    it('adds message to correct chat', () => {
      const message: Message = {
        id: 'm1',
        identifier: '123',
        platform: 'c.us',
        content: 'Hello',
        contentType: 'text',
        timestamp: new Date(),
        sender: { type: 'customer', name: 'Test' },
        status: 'read',
        isFromMe: false,
      }

      const { addMessage } = useChatStore.getState()
      addMessage(message)

      const { messages } = useChatStore.getState()
      const key = chatKey('123', 'c.us')
      expect(messages[key]).toHaveLength(1)
      expect(messages[key][0].content).toBe('Hello')
    })

    it('does not add duplicate messages', () => {
      const message: Message = {
        id: 'm1',
        identifier: '123',
        platform: 'c.us',
        content: 'Hello',
        contentType: 'text',
        timestamp: new Date(),
        sender: { type: 'customer', name: 'Test' },
        status: 'read',
        isFromMe: false,
      }

      const { addMessage } = useChatStore.getState()
      addMessage(message)
      addMessage(message)

      const { messages } = useChatStore.getState()
      const key = chatKey('123', 'c.us')
      expect(messages[key]).toHaveLength(1)
    })

    it('updates last message on chat', () => {
      // First set up a chat - note: we need to reset messages first
      useChatStore.setState({
        chats: [{
          id: '1',
          identifier: '999',
          platform: 'c.us',
          contactName: 'Test User',
          contactPhone: '+123',
          lastMessage: 'Old message',
          lastMessageTime: new Date(Date.now() - 10000),
          unreadCount: 0,
          status: 'open',
          isGroup: false,
          tags: [],
        }],
        messages: {}, // Clear messages to ensure clean state
      })

      const message: Message = {
        id: 'new-msg-1',
        identifier: '999',
        platform: 'c.us',
        content: 'New message',
        contentType: 'text',
        timestamp: new Date(),
        sender: { type: 'customer', name: 'Test' },
        status: 'read',
        isFromMe: false,
      }

      const { addMessage } = useChatStore.getState()
      addMessage(message)

      const { chats } = useChatStore.getState()
      expect(chats[0].lastMessage).toBe('New message')
    })
  })

  describe('updateMessage', () => {
    it('updates message status', () => {
      const key = chatKey('123', 'c.us')
      // Set up messages
      useChatStore.setState({
        messages: {
          [key]: [{
            id: 'm1',
            identifier: '123',
            platform: 'c.us',
            content: 'Hello',
            contentType: 'text',
            timestamp: new Date(),
            sender: { type: 'agent', name: 'Me' },
            status: 'pending',
            isFromMe: true,
          }],
        },
      })

      const { updateMessage } = useChatStore.getState()
      updateMessage({ id: 'm1', status: 'delivered' })

      const { messages } = useChatStore.getState()
      expect(messages[key][0].status).toBe('delivered')
    })
  })

  describe('updateChat', () => {
    it('updates chat properties', () => {
      useChatStore.setState({
        chats: [{
          id: '1',
          identifier: '123',
          platform: 'c.us',
          contactName: 'Test User',
          contactPhone: '+123',
          lastMessage: 'Hello',
          lastMessageTime: new Date(),
          unreadCount: 0,
          status: 'open',
          isGroup: false,
          tags: [],
        }],
      })

      const { updateChat } = useChatStore.getState()
      updateChat({ id: '1', status: 'resolved', assignedTo: 'Agent 1' })

      const { chats } = useChatStore.getState()
      expect(chats[0].status).toBe('resolved')
      expect(chats[0].assignedTo).toBe('Agent 1')
    })
  })

  describe('claimChat', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('claims chat and updates assignedTo', async () => {
      const mockResponse = {
        success: true,
        data: {
          chat: {
            identifier: '123',
            platform: 'c.us' as const,
            assignedTo: 'Agent 1',
            claimedAt: '2024-01-01T00:00:00Z',
          },
        },
      }
      vi.mocked(chatApi.claim).mockResolvedValue(mockResponse)

      useChatStore.setState({
        chats: [{
          id: '1',
          identifier: '123',
          platform: 'c.us',
          contactName: 'Test User',
          contactPhone: '+123',
          lastMessage: 'Hello',
          lastMessageTime: new Date(),
          unreadCount: 0,
          status: 'open',
          isGroup: false,
          tags: [],
        }],
      })

      const { claimChat } = useChatStore.getState()
      await claimChat('123', 'c.us', 'Agent 1')

      const { chats } = useChatStore.getState()
      expect(chats[0].assignedTo).toBe('Agent 1')
      expect(chats[0].claimedAt).toBe('2024-01-01T00:00:00Z')
      expect(chatApi.claim).toHaveBeenCalledWith('123', 'c.us', 'Agent 1')
    })

    it('sets error on claim failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Failed to claim',
      }
      vi.mocked(chatApi.claim).mockResolvedValue(mockResponse)

      const { claimChat } = useChatStore.getState()
      await claimChat('123', 'c.us', 'Agent 1')

      const { error } = useChatStore.getState()
      expect(error).toBe('Failed to claim')
    })
  })

  describe('releaseChat', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('releases chat and clears assignedTo', async () => {
      const mockResponse = {
        success: true,
        data: {
          released: true,
        },
      }
      vi.mocked(chatApi.release).mockResolvedValue(mockResponse)

      useChatStore.setState({
        chats: [{
          id: '1',
          identifier: '123',
          platform: 'c.us',
          contactName: 'Test User',
          contactPhone: '+123',
          lastMessage: 'Hello',
          lastMessageTime: new Date(),
          unreadCount: 0,
          status: 'open',
          isGroup: false,
          tags: [],
          assignedTo: 'Agent 1',
        }],
      })

      const { releaseChat } = useChatStore.getState()
      await releaseChat('123', 'c.us')

      const { chats } = useChatStore.getState()
      expect(chats[0].assignedTo).toBeUndefined()
      expect(chatApi.release).toHaveBeenCalledWith('123', 'c.us')
    })

    it('sets error on release failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Failed to release',
      }
      vi.mocked(chatApi.release).mockResolvedValue(mockResponse)

      const { releaseChat } = useChatStore.getState()
      await releaseChat('123', 'c.us')

      const { error } = useChatStore.getState()
      expect(error).toBe('Failed to release')
    })
  })

  describe('loadContext', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('loads conversation context', async () => {
      const mockContext: ConversationContext = {
        messages: [
          {
            id: 'm1',
            identifier: '123',
            platform: 'c.us',
            body: 'Hello',
            fromUser: true,
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'm2',
            identifier: '123',
            platform: 'c.us',
            body: 'Hi there',
            fromUser: false,
            timestamp: '2024-01-01T00:01:00Z',
          },
        ],
        ragSummary: 'Customer inquiry about product',
        userTags: ['SOMO', 'VIP'],
      }

      const mockResponse = {
        success: true,
        data: {
          context: mockContext,
        },
      }
      vi.mocked(chatApi.getContext).mockResolvedValue(mockResponse)

      const key = chatKey('123', 'c.us')
      const { loadContext } = useChatStore.getState()
      await loadContext('123', 'c.us', 20)

      const { conversationContext } = useChatStore.getState()
      expect(conversationContext[key]).toEqual(mockContext)
      expect(chatApi.getContext).toHaveBeenCalledWith('123', 'c.us', 20)
    })

    it('uses default limit if not provided', async () => {
      const mockResponse = {
        success: true,
        data: {
          context: {
            messages: [],
            userTags: [],
          },
        },
      }
      vi.mocked(chatApi.getContext).mockResolvedValue(mockResponse)

      const { loadContext } = useChatStore.getState()
      await loadContext('123', 'c.us')

      expect(chatApi.getContext).toHaveBeenCalledWith('123', 'c.us', 20)
    })
  })
})
