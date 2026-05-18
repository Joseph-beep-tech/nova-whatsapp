// Platform types
export type Platform = 'c.us' | 'g.us' | 'lid'

// Helper to create a composite key from identifier + platform (for internal store keying)
export function chatKey(identifier: string, platform: Platform): string {
  return `${identifier}:${platform}`
}

// Helper to parse a composite key back to identifier + platform
export function parseChatKey(key: string): { identifier: string; platform: Platform } {
  const lastColon = key.lastIndexOf(':')
  if (lastColon === -1) {
    return { identifier: key, platform: 'c.us' }
  }
  return {
    identifier: key.substring(0, lastColon),
    platform: key.substring(lastColon + 1) as Platform,
  }
}

// Chat types
export interface Chat {
  id: string
  identifier: string
  platform: Platform
  contactName: string
  contactPhone: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  status: ChatStatus
  isGroup: boolean
  tags: string[]
  assignedTo?: string
  claimedAt?: string
  avatarUrl?: string
  isTyping?: boolean
  typingUser?: string
}

export type ChatStatus = 'open' | 'pending' | 'resolved' | 'archived'

export type ChatFilter = 'all' | 'pending' | 'mine' | 'groups' | 'unassigned'

// Message types
export interface Message {
  id: string
  identifier: string
  platform: Platform
  content: string
  contentType: MessageContentType
  timestamp: Date
  sender: MessageSender
  status: MessageStatus
  isFromMe: boolean
  quotedMessage?: QuotedMessage
  mediaUrl?: string
  mediaCaption?: string
  reactions?: MessageReaction[]
}

export type MessageContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'contact'
  | 'sticker'
  | 'poll'

export type MessageSender = {
  type: 'customer' | 'bot' | 'agent'
  name: string
  id?: string
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface QuotedMessage {
  id: string
  content: string
  sender: string
}

export interface MessageReaction {
  emoji: string
  senderId: string
  senderName: string
}

// Contact types
export interface Contact {
  id: string
  identifier: string
  platform: Platform
  name: string
  phone: string
  email?: string
  company?: string
  country?: string
  language?: string
  accountType: 'personal' | 'business'
  status: 'active' | 'blocked' | 'archived'
  tags: string[]
  labels: Label[]
  metadata: Record<string, string>
  notes: Note[]
  firstSeen: Date
  lastSeen: Date
  avatarUrl?: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Note {
  id: string
  content: string
  author: string
  authorId: string
  createdAt: Date
}

// Quick Reply types
export interface QuickReply {
  id: string
  title: string
  content: string
  shortcut?: string
  category?: string
}

// Session types
export interface SessionStatus {
  sessionId: string
  status: 'connected' | 'disconnected' | 'qr_required' | 'loading'
  phone?: string
  pushName?: string
  qrCode?: string
  lastSeen?: Date
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// Tag system types (from existing codebase)
export interface Tag {
  name: string
  description?: string
  apps: TagApp[]
  welcomeMessage?: string
}

export type TagApp = 'KnowledgeBase' | 'LMS' | 'Keywords'

// Conversation Context types (for agent takeover)
export interface ConversationMessage {
  id: string
  identifier: string
  platform: Platform
  body: string
  fromUser: boolean
  timestamp: string
  hasMedia?: boolean
  mediaType?: string
}

export interface ConversationContext {
  messages: ConversationMessage[]
  ragSummary?: string
  userTags: string[]
  claimedAt?: string
  claimedBy?: string
}

// Authentication types
export type Role = 'agent' | 'automation_engineer' | 'tenant_admin' | 'creator_admin'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthState {
  authenticated: boolean
  user: AuthUser | null
  roles: Role[]
  organizationId: string | null
  organizationName: string | null
}

// Role hierarchy - higher index means more permissions
export const ROLE_HIERARCHY: Role[] = ['agent', 'automation_engineer', 'tenant_admin', 'creator_admin']

// Helper to check if a role has at least the required level
export function hasRole(userRoles: Role[], requiredRole: Role): boolean {
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole)
  return userRoles.some((role) => ROLE_HIERARCHY.indexOf(role) >= requiredIndex)
}

// Helper to check if user has any of the required roles
export function hasAnyRole(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.some((role) => userRoles.includes(role))
}

// Alert types
export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'session_disconnect'
  | 'failed_message'
  | 'queue_backup'
  | 'escalation_needed'

export interface AlertMetadata {
  sessionId?: string
  identifier?: string
  platform?: Platform
  errorMessage?: string
  queueName?: string
  queueDepth?: number
  threshold?: number
  tags?: string[]
  [key: string]: unknown
}

export interface Alert {
  _id?: string
  type: AlertType
  severity: AlertSeverity
  message: string
  metadata: AlertMetadata
  acknowledged: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface AlertStats {
  total: number
  unacknowledged: number
  acknowledged: number
  bySeverity: {
    info: number
    warning: number
    critical: number
  }
  byType: {
    session_disconnect: number
    failed_message: number
    queue_backup: number
    escalation_needed: number
  }
}
