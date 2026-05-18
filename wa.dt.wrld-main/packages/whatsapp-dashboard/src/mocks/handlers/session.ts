import { http, HttpResponse, delay } from 'msw'
import { connectedSession, multipleSessions } from '../data/sessions'
import type { SessionStatus } from '@/types'

// Mutable state for tests
let currentSession: SessionStatus = { ...connectedSession }
let allSessions: SessionStatus[] = [...multipleSessions]

// Helper to set session state for tests
export function setMockSession(session: SessionStatus) {
  currentSession = { ...session }
}

// Helper to set all sessions for tests
export function setMockSessions(sessions: SessionStatus[]) {
  allSessions = [...sessions]
}

// Reset to default state
export function resetMockSessionState() {
  currentSession = { ...connectedSession }
  allSessions = [...multipleSessions]
}

export const sessionHandlers = [
  // GET /api/session/status/:sessionId - Get session status
  http.get('/api/session/status/:sessionId', async ({ params }) => {
    await delay(50)

    const sessionId = params.sessionId as string

    // Find session by ID or return current session if matching default
    const session = allSessions.find((s) => s.sessionId === sessionId)

    if (session) {
      return HttpResponse.json({ success: true, data: session })
    }

    if (sessionId === currentSession.sessionId) {
      return HttpResponse.json({ success: true, data: currentSession })
    }

    return HttpResponse.json(
      { success: false, error: 'Session not found' },
      { status: 404 }
    )
  }),

  // GET /api/session/qr/:sessionId/image - Get QR code image
  http.get('/api/session/qr/:sessionId/image', async ({ params }) => {
    await delay(50)

    const sessionId = params.sessionId as string
    const session = allSessions.find((s) => s.sessionId === sessionId) || currentSession

    if (session.status !== 'qr_required' || !session.qrCode) {
      return HttpResponse.json(
        { success: false, error: 'QR code not available' },
        { status: 404 }
      )
    }

    // Return mock QR code image
    // In real tests, this would return an actual image buffer
    return new HttpResponse(session.qrCode, {
      headers: {
        'Content-Type': 'image/png',
      },
    })
  }),

  // GET /api/sessions - List all sessions (for admin)
  http.get('/api/sessions', async () => {
    await delay(100)

    return HttpResponse.json({
      success: true,
      data: allSessions,
    })
  }),

  // POST /api/session/:sessionId/start - Start session
  http.post('/api/session/:sessionId/start', async ({ params }) => {
    await delay(200)

    const sessionId = params.sessionId as string
    const sessionIndex = allSessions.findIndex((s) => s.sessionId === sessionId)

    if (sessionIndex >= 0) {
      allSessions[sessionIndex] = {
        ...allSessions[sessionIndex],
        status: 'loading',
      }
      return HttpResponse.json({ success: true, data: allSessions[sessionIndex] })
    }

    // Create new session
    const newSession: SessionStatus = {
      sessionId,
      status: 'loading',
    }
    allSessions.push(newSession)

    return HttpResponse.json({ success: true, data: newSession })
  }),

  // POST /api/session/:sessionId/stop - Stop session
  http.post('/api/session/:sessionId/stop', async ({ params }) => {
    await delay(200)

    const sessionId = params.sessionId as string
    const sessionIndex = allSessions.findIndex((s) => s.sessionId === sessionId)

    if (sessionIndex < 0) {
      return HttpResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    allSessions[sessionIndex] = {
      ...allSessions[sessionIndex],
      status: 'disconnected',
    }

    return HttpResponse.json({ success: true, data: allSessions[sessionIndex] })
  }),
]
