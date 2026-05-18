import type { ApiResponse, Chat, Message, Contact, QuickReply, SessionStatus, Note, ConversationContext, Alert, AlertStats, AlertSeverity, AlertType, Platform } from '@/types'

const API_BASE = '/api'

// Get API key from localStorage or environment
function getApiKey(): string {
  return localStorage.getItem('api_key') || ''
}

// Track if we've already triggered a session expired redirect
let isRedirectingToLogin = false

// Callback for session expiry (set by AuthProvider)
let onSessionExpiredCallback: (() => void) | null = null

export function setOnSessionExpired(callback: () => void) {
  onSessionExpiredCallback = callback
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const apiKey = getApiKey()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Required for session cookies
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { 'x-api-key': apiKey }),
      ...options.headers,
    },
  })

  // Handle 401 globally - session expired
  if (response.status === 401 && !isRedirectingToLogin) {
    isRedirectingToLogin = true
    if (onSessionExpiredCallback) {
      onSessionExpiredCallback()
    } else {
      // Fallback: redirect to login
      window.location.href = '/auth/login'
    }
    return { success: false, error: 'Session expired' }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    return { success: false, error: error.error || `HTTP ${response.status}` }
  }

  const data = await response.json()
  return { success: true, data }
}

// Reset redirect flag (call when user logs in successfully)
export function resetSessionExpiredFlag() {
  isRedirectingToLogin = false
}

// Chat API
export const chatApi = {
  list: (filter?: string, page = 1, limit = 50) =>
    fetchApi<Chat[]>(`/chats?filter=${filter || 'all'}&page=${page}&limit=${limit}`),

  get: (identifier: string, platform: Platform = 'c.us') => {
    const params = new URLSearchParams({ identifier, platform })
    return fetchApi<Chat>(`/chats?${params}`)
  },

  updateStatus: (identifier: string, platform: Platform, status: Chat['status']) =>
    fetchApi<Chat>('/chats/status', {
      method: 'PUT',
      body: JSON.stringify({ identifier, platform, status }),
    }),

  assign: (identifier: string, platform: Platform, userId?: string) =>
    fetchApi<Chat>('/chats/assign', {
      method: 'PUT',
      body: JSON.stringify({ identifier, platform, userId }),
    }),

  updateLabels: (identifier: string, platform: Platform, labels: string[]) =>
    fetchApi<Chat>('/chats/labels', {
      method: 'PUT',
      body: JSON.stringify({ identifier, platform, labels }),
    }),

  claim: (identifier: string, platform: Platform, agentId: string) =>
    fetchApi<{ chat?: { identifier: string; platform: Platform; assignedTo: string; claimedAt: string } }>(
      '/chats/claim',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, platform, agentId }),
      }
    ),

  release: (identifier: string, platform: Platform) =>
    fetchApi<{ message?: string; released: boolean }>(
      '/chats/release',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, platform }),
      }
    ),

  getContext: (identifier: string, platform: Platform, limit = 20) => {
    const params = new URLSearchParams({ identifier, platform, limit: String(limit) })
    return fetchApi<{ context?: ConversationContext }>(
      `/chats/context?${params}`
    )
  },
}

// Message API
export const messageApi = {
  list: (identifier: string, platform: Platform, before?: string, limit = 50) => {
    const params = new URLSearchParams({ identifier, platform, limit: String(limit) })
    if (before) params.set('before', before)
    return fetchApi<Message[]>(`/chats/messages?${params}`)
  },

  send: (identifier: string, platform: Platform, content: string, contentType = 'text') =>
    fetchApi<Message>('/chats/send', {
      method: 'POST',
      body: JSON.stringify({ identifier, platform, content, contentType }),
    }),

  sendNote: (identifier: string, platform: Platform, content: string) =>
    fetchApi<Note>('/chats/notes', {
      method: 'POST',
      body: JSON.stringify({ identifier, platform, content }),
    }),
}

// Contact API
export const contactApi = {
  get: (identifier: string, platform: Platform = 'c.us') => {
    const params = new URLSearchParams({ identifier, platform })
    return fetchApi<Contact>(`/contacts?${params}`)
  },

  update: (identifier: string, platform: Platform, data: Partial<Contact>) =>
    fetchApi<Contact>('/contacts', {
      method: 'PUT',
      body: JSON.stringify({ identifier, platform, ...data }),
    }),

  getNotes: (identifier: string, platform: Platform = 'c.us') => {
    const params = new URLSearchParams({ identifier, platform })
    return fetchApi<Note[]>(`/contacts/notes?${params}`)
  },

  addNote: (identifier: string, platform: Platform, content: string) =>
    fetchApi<Note>('/contacts/notes', {
      method: 'POST',
      body: JSON.stringify({ identifier, platform, content }),
    }),
}

// Quick Reply API
export const quickReplyApi = {
  list: () =>
    fetchApi<QuickReply[]>('/quick-replies'),

  create: (data: Omit<QuickReply, 'id'>) =>
    fetchApi<QuickReply>('/quick-replies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<QuickReply>) =>
    fetchApi<QuickReply>(`/quick-replies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/quick-replies/${id}`, { method: 'DELETE' }),
}

// Session API
export const sessionApi = {
  status: (sessionId = 'mysession') =>
    fetchApi<SessionStatus>(`/session/status/${sessionId}`),

  qrCode: (sessionId = 'mysession') =>
    `${API_BASE}/session/qr/${sessionId}/image`,
}

// Health check
export const healthApi = {
  check: () => fetchApi<{ status: string }>('/health'),
}

// Alert API
export const alertApi = {
  list: (severity?: AlertSeverity, type?: AlertType, acknowledged?: boolean, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (severity) params.set('severity', severity)
    if (type) params.set('type', type)
    if (acknowledged !== undefined) params.set('acknowledged', String(acknowledged))
    return fetchApi<Alert[]>(`/alerts?${params}`)
  },

  get: (alertId: string) =>
    fetchApi<Alert>(`/alerts/${alertId}`),

  create: (data: Omit<Alert, '_id' | 'acknowledged' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<Alert>('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  acknowledge: (alertId: string, acknowledgedBy?: string) =>
    fetchApi<Alert>(`/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ acknowledgedBy }),
    }),

  delete: (alertId: string) =>
    fetchApi<void>(`/alerts/${alertId}`, { method: 'DELETE' }),

  stats: () =>
    fetchApi<AlertStats>('/alerts/stats'),
}
