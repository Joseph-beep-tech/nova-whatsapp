import type { SessionStatus } from '@/types'

// Session statuses for testing
export const connectedSession: SessionStatus = {
  sessionId: 'mysession',
  status: 'connected',
  phone: '+254748085137',
  pushName: 'SOMO Bot',
  lastSeen: new Date(),
}

export const disconnectedSession: SessionStatus = {
  sessionId: 'mysession',
  status: 'disconnected',
  lastSeen: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
}

export const qrRequiredSession: SessionStatus = {
  sessionId: 'mysession',
  status: 'qr_required',
  qrCode: 'data:image/png;base64,mockqrcode',
}

export const loadingSession: SessionStatus = {
  sessionId: 'mysession',
  status: 'loading',
}

// Multiple sessions for sessions page
export const multipleSessions: SessionStatus[] = [
  connectedSession,
  {
    sessionId: 'testsession',
    status: 'disconnected',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  },
  {
    sessionId: 'devsession',
    status: 'qr_required',
    qrCode: 'data:image/png;base64,devqrcode',
  },
]
