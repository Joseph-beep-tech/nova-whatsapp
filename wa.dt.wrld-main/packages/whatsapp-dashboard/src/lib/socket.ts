import { io, Socket } from 'socket.io-client'
import type { Message, Chat, SessionStatus } from '@/types'

// Socket event payloads
export interface SocketEventMap {
  'message:new': Message
  'message:update': Partial<Message> & { id: string }
  'typing:start': { chatId: string; identifier?: string; platform?: string; user?: string }
  'typing:stop': { chatId: string; identifier?: string; platform?: string }
  'chat:update': Partial<Chat> & { id: string }
  'session:status': SessionStatus
}

type EventCallback<T> = (data: T) => void

// Configuration for error suppression
const MAX_RECONNECTION_ATTEMPTS = 3 // Reduced - fail fast if server doesn't have Socket.IO
const ERROR_LOG_INTERVAL = 60000 // Only log same error every 60 seconds

class SocketClient {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map()
  private lastErrorTime = 0
  private lastErrorMessage = ''
  private reconnectAttempts = 0
  private isReconnecting = false
  private permanentlyDisabled = false // Don't try again after max attempts

  connect(sessionId = 'mysession') {
    if (this.socket?.connected) {
      return this.socket
    }

    // Don't retry if we've permanently given up
    if (this.permanentlyDisabled) {
      return null
    }

    // Reset state on new connection
    this.reconnectAttempts = 0
    this.isReconnecting = false

    this.socket = io('/', {
      path: '/socket.io',
      transports: ['websocket'], // Only try WebSocket, fail fast if unavailable
      query: { sessionId },
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: 5000, // Short timeout
    })

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id)
      this.reconnectAttempts = 0
      this.isReconnecting = false
      // Re-attach all listeners after reconnect
      this.listeners.forEach((handlers, event) => {
        handlers.forEach((handler) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.socket?.on(event, handler as any)
        })
      })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      this.isReconnecting = true
    })

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++

      // Suppress repeated errors - only log if different error or time passed
      const now = Date.now()
      const shouldLog =
        error.message !== this.lastErrorMessage ||
        now - this.lastErrorTime > ERROR_LOG_INTERVAL

      if (shouldLog && this.reconnectAttempts <= MAX_RECONNECTION_ATTEMPTS) {
        // Only log first attempt, then stay quiet
        if (this.reconnectAttempts === 1) {
          console.info('[Socket] WebSocket connecting... (server may not support real-time)')
        }
        this.lastErrorTime = now
        this.lastErrorMessage = error.message
      }

      // Permanently disable after max attempts
      if (this.reconnectAttempts >= MAX_RECONNECTION_ATTEMPTS) {
        this.permanentlyDisabled = true
      }
    })

    // Handle max reconnect attempts
    this.socket.io.on('reconnect_failed', () => {
      console.info('[Socket] WebSocket not available on server. Real-time updates disabled.')
      this.isReconnecting = false
      this.permanentlyDisabled = true
      // Clean disconnect to stop any further attempts
      this.socket?.disconnect()
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  on<K extends keyof SocketEventMap>(
    event: K,
    handler: EventCallback<SocketEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as EventCallback<unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket?.on(event, handler as any)

    return () => this.off(event, handler)
  }

  off<K extends keyof SocketEventMap>(
    event: K,
    handler: EventCallback<SocketEventMap[K]>
  ) {
    this.listeners.get(event)?.delete(handler as EventCallback<unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket?.off(event, handler as any)
  }

  emit<K extends keyof SocketEventMap>(event: K, data: SocketEventMap[K]) {
    this.socket?.emit(event, data)
  }

  get isConnected() {
    return this.socket?.connected ?? false
  }

  get connectionId() {
    return this.socket?.id
  }

  get isReconnectingState() {
    return this.isReconnecting
  }

  get reconnectAttemptsCount() {
    return this.reconnectAttempts
  }

  // Manually retry connection after max attempts reached
  retryConnection(sessionId = 'mysession') {
    this.disconnect()
    this.permanentlyDisabled = false // Allow manual retry
    return this.connect(sessionId)
  }

  // Check if socket has been permanently disabled
  get isDisabled() {
    return this.permanentlyDisabled
  }
}

export const socketClient = new SocketClient()
