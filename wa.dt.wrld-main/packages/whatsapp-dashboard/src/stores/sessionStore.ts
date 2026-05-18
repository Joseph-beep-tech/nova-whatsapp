import { create } from 'zustand'
import type { SessionStatus } from '@/types'
import { sessionApi } from '@/lib/api'
import { socketClient } from '@/lib/socket'

interface SessionState {
  // State
  status: SessionStatus | null
  isConnecting: boolean
  socketConnected: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  connectSocket: (sessionId?: string) => void
  disconnectSocket: () => void
  updateStatus: (status: SessionStatus) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  status: null,
  isConnecting: false,
  socketConnected: false,
  error: null,

  // Fetch session status from API
  fetchStatus: async () => {
    set({ isConnecting: true, error: null })

    const response = await sessionApi.status()
    if (response.success && response.data) {
      set({ status: response.data, isConnecting: false })
    } else {
      set({ error: response.error || 'Failed to fetch session status', isConnecting: false })
    }
  },

  // Connect WebSocket
  connectSocket: (sessionId = 'mysession') => {
    socketClient.connect(sessionId)
    set({ socketConnected: socketClient.isConnected })

    // Update connection status when socket events fire
    socketClient.on('session:status', (status) => {
      get().updateStatus(status)
    })
  },

  // Disconnect WebSocket
  disconnectSocket: () => {
    socketClient.disconnect()
    set({ socketConnected: false })
  },

  // Real-time: update session status
  updateStatus: (status) => {
    set({ status })
  },
}))
