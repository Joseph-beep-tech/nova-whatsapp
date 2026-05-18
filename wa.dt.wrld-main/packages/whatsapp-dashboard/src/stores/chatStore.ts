import { create } from 'zustand'
import type { Chat, Message, ChatFilter, ChatStatus, ConversationContext, Platform } from '@/types'
import { chatKey, parseChatKey } from '@/types'
import { chatApi, messageApi } from '@/lib/api'
import { USE_MOCK_API } from '@/lib/config'

// Mock data for development/testing
const MOCK_CHATS: Chat[] = [
  {
    id: '1',
    identifier: '254712345678',
    platform: 'c.us',
    contactName: 'John Mwangi',
    contactPhone: '+254712345678',
    lastMessage: 'Hello, I need help with SOMO registration',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 2,
    status: 'open',
    isGroup: false,
    tags: ['SOMO'],
  },
  {
    id: '2',
    identifier: '254798765432',
    platform: 'c.us',
    contactName: 'Mary Wanjiku',
    contactPhone: '+254798765432',
    lastMessage: 'Thank you for the assistance!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 0,
    status: 'resolved',
    isGroup: false,
    tags: ['SOMO', 'VIP'],
    assignedTo: 'Agent 1',
  },
  {
    id: '3',
    identifier: '254755555555',
    platform: 'g.us',
    contactName: 'SOMO Kenya Group',
    contactPhone: '+254755555555',
    lastMessage: 'Welcome to the group!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unreadCount: 5,
    status: 'pending',
    isGroup: true,
    tags: ['SOMO'],
  },
  {
    id: '4',
    identifier: '254700111222',
    platform: 'c.us',
    contactName: 'Peter Kamau',
    contactPhone: '+254700111222',
    lastMessage: 'When is the next session?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unreadCount: 1,
    status: 'open',
    isGroup: false,
    tags: ['LMS'],
  },
]

const MOCK_MESSAGES: Record<string, Message[]> = {
  '254712345678:c.us': [
    {
      id: 'm1',
      identifier: '254712345678',
      platform: 'c.us',
      content: 'Hello, I need help with SOMO registration',
      contentType: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 10),
      sender: { type: 'customer', name: 'John Mwangi' },
      status: 'read',
      isFromMe: false,
    },
    {
      id: 'm2',
      identifier: '254712345678',
      platform: 'c.us',
      content: 'Hi John! Welcome to SOMO. I can help you with registration. What would you like to know?',
      contentType: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 8),
      sender: { type: 'bot', name: 'SOMO Bot' },
      status: 'delivered',
      isFromMe: true,
    },
    {
      id: 'm3',
      identifier: '254712345678',
      platform: 'c.us',
      content: 'How do I sign up for the program?',
      contentType: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      sender: { type: 'customer', name: 'John Mwangi' },
      status: 'read',
      isFromMe: false,
    },
  ],
}

// Use mock data when mock API is enabled
const USE_MOCK_DATA = USE_MOCK_API

interface ChatState {
  // State
  chats: Chat[]
  messages: Record<string, Message[]> // chatKey (identifier:platform) -> messages
  conversationContext: Record<string, ConversationContext> // chatKey -> conversation context
  selectedChatId: string | null // composite key (identifier:platform)
  filter: ChatFilter
  searchQuery: string
  isLoading: boolean
  error: string | null
  typingChats: Set<string> // set of composite keys

  // Actions
  fetchChats: (filter?: ChatFilter) => Promise<void>
  fetchMessages: (identifier: string, platform: Platform) => Promise<void>
  selectChat: (chatId: string | null) => void
  setFilter: (filter: ChatFilter) => void
  setSearchQuery: (query: string) => void
  sendMessage: (identifier: string, platform: Platform, content: string) => Promise<void>
  updateChatStatus: (identifier: string, platform: Platform, status: ChatStatus) => Promise<void>
  claimChat: (identifier: string, platform: Platform, agentId: string) => Promise<void>
  releaseChat: (identifier: string, platform: Platform) => Promise<void>
  loadContext: (identifier: string, platform: Platform, limit?: number) => Promise<void>

  // Real-time updates
  addMessage: (message: Message) => void
  updateMessage: (message: Partial<Message> & { id: string }) => void
  updateChat: (chat: Partial<Chat> & { id: string }) => void
  setTyping: (chatId: string, isTyping: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  chats: USE_MOCK_DATA ? MOCK_CHATS : [],
  messages: USE_MOCK_DATA ? MOCK_MESSAGES : {},
  conversationContext: {},
  selectedChatId: null,
  filter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  typingChats: new Set(),

  // Fetch all chats with optional filter
  fetchChats: async (filter) => {
    const activeFilter = filter ?? get().filter
    set({ isLoading: true, error: null })

    if (USE_MOCK_DATA) {
      // Use mock data in development
      setTimeout(() => {
        set({ chats: MOCK_CHATS, isLoading: false })
      }, 300)
      return
    }

    const response = await chatApi.list(activeFilter)
    if (response.success && response.data) {
      set({ chats: response.data, isLoading: false })
    } else {
      set({ error: response.error || 'Failed to fetch chats', isLoading: false })
    }
  },

  // Fetch messages for a specific chat
  fetchMessages: async (identifier, platform) => {
    const key = chatKey(identifier, platform)
    if (USE_MOCK_DATA) {
      // Use mock data in development
      setTimeout(() => {
        set((state) => ({
          messages: {
            ...state.messages,
            [key]: MOCK_MESSAGES[key] || [],
          },
        }))
      }, 200)
      return
    }

    const response = await messageApi.list(identifier, platform)
    if (response.success && response.data) {
      set((state) => ({
        messages: {
          ...state.messages,
          [key]: response.data || [],
        },
      }))
    }
  },

  // Select a chat and fetch its messages (chatId is composite key identifier:platform)
  selectChat: (chatId) => {
    set({ selectedChatId: chatId })
    if (chatId && !get().messages[chatId]) {
      const { identifier, platform } = parseChatKey(chatId)
      get().fetchMessages(identifier, platform)
    }
  },

  // Set filter (client-side filtering, no refetch needed)
  setFilter: (filter) => {
    set({ filter })
  },

  // Search within chats
  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  // Send a message (agent takeover)
  sendMessage: async (identifier, platform, content) => {
    const key = chatKey(identifier, platform)
    // Optimistically add the message
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      identifier,
      platform,
      content,
      contentType: 'text',
      timestamp: new Date(),
      sender: { type: 'agent', name: 'You' },
      status: 'pending',
      isFromMe: true,
    }

    set((state) => ({
      messages: {
        ...state.messages,
        [key]: [...(state.messages[key] || []), tempMessage],
      },
    }))

    const response = await messageApi.send(identifier, platform, content)
    if (response.success && response.data) {
      // Replace temp message with real one
      set((state) => ({
        messages: {
          ...state.messages,
          [key]: state.messages[key].map((m) =>
            m.id === tempMessage.id ? response.data! : m
          ),
        },
      }))
    } else {
      // Mark message as failed
      set((state) => ({
        messages: {
          ...state.messages,
          [key]: state.messages[key].map((m) =>
            m.id === tempMessage.id ? { ...m, status: 'failed' as const } : m
          ),
        },
      }))
    }
  },

  // Update chat status (resolve, archive, etc.)
  updateChatStatus: async (identifier, platform, status) => {
    const response = await chatApi.updateStatus(identifier, platform, status)
    if (response.success && response.data) {
      const key = chatKey(identifier, platform)
      set((state) => ({
        chats: state.chats.map((c) =>
          chatKey(c.identifier, c.platform) === key ? { ...c, status } : c
        ),
      }))
    }
  },

  // Claim a conversation for an agent
  claimChat: async (identifier, platform, agentId) => {
    set({ isLoading: true, error: null })

    const response = await chatApi.claim(identifier, platform, agentId)
    if (response.success && response.data?.chat) {
      const { assignedTo, claimedAt } = response.data.chat
      const key = chatKey(identifier, platform)
      set((state) => ({
        chats: state.chats.map((c) =>
          chatKey(c.identifier, c.platform) === key ? { ...c, assignedTo, claimedAt } : c
        ),
        isLoading: false,
      }))
    } else {
      set({ error: response.error || 'Failed to claim chat', isLoading: false })
    }
  },

  // Release a conversation back to automation
  releaseChat: async (identifier, platform) => {
    set({ isLoading: true, error: null })

    const response = await chatApi.release(identifier, platform)
    if (response.success && response.data?.released) {
      const key = chatKey(identifier, platform)
      set((state) => ({
        chats: state.chats.map((c) =>
          chatKey(c.identifier, c.platform) === key ? { ...c, assignedTo: undefined } : c
        ),
        isLoading: false,
      }))
    } else {
      set({ error: response.error || 'Failed to release chat', isLoading: false })
    }
  },

  // Load conversation context (messages, RAG summary, tags)
  loadContext: async (identifier, platform, limit = 20) => {
    const key = chatKey(identifier, platform)
    const response = await chatApi.getContext(identifier, platform, limit)
    if (response.success && response.data?.context) {
      set((state) => ({
        conversationContext: {
          ...state.conversationContext,
          [key]: response.data!.context!,
        },
      }))
    }
  },

  // Real-time: add new message
  addMessage: (message) => {
    set((state) => {
      const key = chatKey(message.identifier, message.platform)
      const chatMessages = state.messages[key] || []
      // Avoid duplicates
      if (chatMessages.some((m) => m.id === message.id)) {
        return state
      }
      return {
        messages: {
          ...state.messages,
          [key]: [...chatMessages, message],
        },
        // Update chat's last message
        chats: state.chats.map((c) => {
          const cKey = chatKey(c.identifier, c.platform)
          return cKey === key
            ? {
                ...c,
                lastMessage: message.content,
                lastMessageTime: message.timestamp,
                unreadCount: cKey === state.selectedChatId ? 0 : c.unreadCount + 1,
              }
            : c
        }),
      }
    })
  },

  // Real-time: update message (status, reactions)
  updateMessage: (update) => {
    set((state) => {
      const messages = { ...state.messages }
      for (const chatId of Object.keys(messages)) {
        messages[chatId] = messages[chatId].map((m) =>
          m.id === update.id ? { ...m, ...update } : m
        )
      }
      return { messages }
    })
  },

  // Real-time: update chat (status changes, assignments)
  updateChat: (update) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === update.id ? { ...c, ...update } : c
      ),
    }))
  },

  // Real-time: typing indicator
  setTyping: (chatId, isTyping) => {
    set((state) => {
      const typingChats = new Set(state.typingChats)
      if (isTyping) {
        typingChats.add(chatId)
      } else {
        typingChats.delete(chatId)
      }
      return { typingChats }
    })
  },
}))
