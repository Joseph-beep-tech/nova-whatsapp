import type { Chat, Message, Contact } from '@/types'

// Helper to create dates relative to now
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000)
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)

// Empty state
export const emptyChats: Chat[] = []

// Single chat
export const singleChat: Chat[] = [
  {
    id: '1',
    identifier: '254712345678',
    platform: 'c.us',
    contactName: 'John Mwangi',
    contactPhone: '+254712345678',
    lastMessage: 'Hello, I need help with SOMO registration',
    lastMessageTime: minutesAgo(5),
    unreadCount: 2,
    status: 'open',
    isGroup: false,
    tags: ['SOMO'],
  },
]

// Multiple chats - mix of individual and group
export const multipleChats: Chat[] = [
  {
    id: '1',
    identifier: '254712345678',
    platform: 'c.us',
    contactName: 'John Mwangi',
    contactPhone: '+254712345678',
    lastMessage: 'Hello, I need help with SOMO registration',
    lastMessageTime: minutesAgo(5),
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
    lastMessageTime: minutesAgo(30),
    unreadCount: 0,
    status: 'resolved',
    isGroup: false,
    tags: ['SOMO', 'VIP'],
    assignedTo: 'user-agent-1',
  },
  {
    id: '3',
    identifier: '254755555555',
    platform: 'g.us',
    contactName: 'SOMO Kenya Group',
    contactPhone: '+254755555555',
    lastMessage: 'Welcome to the group!',
    lastMessageTime: hoursAgo(2),
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
    lastMessageTime: hoursAgo(5),
    unreadCount: 1,
    status: 'open',
    isGroup: false,
    tags: ['LMS'],
  },
  {
    id: '5',
    identifier: '254711222333',
    platform: 'c.us',
    contactName: 'Grace Akinyi',
    contactPhone: '+254711222333',
    lastMessage: 'Can I get more information?',
    lastMessageTime: hoursAgo(1),
    unreadCount: 3,
    status: 'pending',
    isGroup: false,
    tags: ['SOMO'],
  },
]

// Pending chats only (unassigned)
export const pendingChats: Chat[] = multipleChats.filter(
  (chat) => chat.status === 'pending' && !chat.assignedTo
)

// My chats (assigned to current user)
export const myChats: Chat[] = multipleChats.filter(
  (chat) => chat.assignedTo === 'user-agent-1'
)

// Group chats only
export const groupChats: Chat[] = multipleChats.filter((chat) => chat.isGroup)

// Messages for various chats (keyed by identifier:platform)
export const mockMessages: Record<string, Message[]> = {
  '254712345678:c.us': [
    {
      id: 'm1',
      identifier: '254712345678',
      platform: 'c.us',
      content: 'Hello, I need help with SOMO registration',
      contentType: 'text',
      timestamp: minutesAgo(10),
      sender: { type: 'customer', name: 'John Mwangi' },
      status: 'read',
      isFromMe: false,
    },
    {
      id: 'm2',
      identifier: '254712345678',
      platform: 'c.us',
      content:
        'Hi John! Welcome to SOMO. I can help you with registration. What would you like to know?',
      contentType: 'text',
      timestamp: minutesAgo(8),
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
      timestamp: minutesAgo(5),
      sender: { type: 'customer', name: 'John Mwangi' },
      status: 'read',
      isFromMe: false,
    },
  ],
  '254798765432:c.us': [
    {
      id: 'm4',
      identifier: '254798765432',
      platform: 'c.us',
      content: 'Hi, I have a question about my account',
      contentType: 'text',
      timestamp: hoursAgo(1),
      sender: { type: 'customer', name: 'Mary Wanjiku' },
      status: 'read',
      isFromMe: false,
    },
    {
      id: 'm5',
      identifier: '254798765432',
      platform: 'c.us',
      content: 'Sure, I can help you with that. What is your question?',
      contentType: 'text',
      timestamp: minutesAgo(45),
      sender: { type: 'agent', name: 'Test Agent', id: 'user-agent-1' },
      status: 'delivered',
      isFromMe: true,
    },
    {
      id: 'm6',
      identifier: '254798765432',
      platform: 'c.us',
      content: 'Thank you for the assistance!',
      contentType: 'text',
      timestamp: minutesAgo(30),
      sender: { type: 'customer', name: 'Mary Wanjiku' },
      status: 'read',
      isFromMe: false,
    },
  ],
}

// Empty messages
export const emptyMessages: Message[] = []

// Messages with media
export const messagesWithMedia: Message[] = [
  {
    id: 'media-1',
    identifier: '254712345678',
    platform: 'c.us',
    content: '',
    contentType: 'image',
    timestamp: minutesAgo(15),
    sender: { type: 'customer', name: 'John Mwangi' },
    status: 'read',
    isFromMe: false,
    mediaUrl: 'https://example.com/image.jpg',
    mediaCaption: 'Here is my ID document',
  },
  {
    id: 'media-2',
    identifier: '254712345678',
    platform: 'c.us',
    content: '',
    contentType: 'document',
    timestamp: minutesAgo(12),
    sender: { type: 'customer', name: 'John Mwangi' },
    status: 'read',
    isFromMe: false,
    mediaUrl: 'https://example.com/doc.pdf',
    mediaCaption: 'Application form',
  },
]

// Mock contacts (keyed by identifier:platform)
export const mockContacts: Record<string, Contact> = {
  '254712345678:c.us': {
    id: 'c1',
    identifier: '254712345678',
    platform: 'c.us',
    name: 'John Mwangi',
    phone: '+254712345678',
    email: 'john.mwangi@example.com',
    accountType: 'personal',
    status: 'active',
    tags: ['SOMO'],
    labels: [
      { id: 'l1', name: 'New User', color: '#4CAF50' },
      { id: 'l2', name: 'Priority', color: '#FF5722' },
    ],
    metadata: {
      source: 'WhatsApp',
      registrationDate: '2026-01-15',
    },
    notes: [
      {
        id: 'n1',
        content: 'Interested in SOMO program, needs registration help',
        author: 'Test Agent',
        authorId: 'user-agent-1',
        createdAt: hoursAgo(24),
      },
    ],
    firstSeen: hoursAgo(48),
    lastSeen: minutesAgo(5),
  },
  '254798765432:c.us': {
    id: 'c2',
    identifier: '254798765432',
    platform: 'c.us',
    name: 'Mary Wanjiku',
    phone: '+254798765432',
    email: 'mary.wanjiku@example.com',
    accountType: 'personal',
    status: 'active',
    tags: ['SOMO', 'VIP'],
    labels: [{ id: 'l3', name: 'VIP', color: '#9C27B0' }],
    metadata: {},
    notes: [],
    firstSeen: hoursAgo(72),
    lastSeen: minutesAgo(30),
  },
}
