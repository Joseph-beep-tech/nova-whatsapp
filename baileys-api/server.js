'use strict'

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys')
const qrcode = require('qrcode')
const pino = require('pino')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY || ''
const SESSIONS_PATH = process.env.SESSIONS_PATH || path.join(__dirname, 'sessions')

// sessionId → { socket, qr, state }
const sessions = new Map()

// ── Auth middleware ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(403).json({ success: false, error: 'Invalid API key' })
  }
  next()
})

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/ping', (_, res) => res.json({ success: true, engine: 'baileys' }))

// ── Start session ─────────────────────────────────────────────────────────────
app.get('/session/start/:sessionId', (req, res) => {
  const { sessionId } = req.params
  if (sessions.has(sessionId)) {
    return res.json({ success: true, message: 'Session already running' })
  }
  // Fire-and-forget — Baileys is async, frontend polls status
  startSession(sessionId).catch(err => console.error(`[start][${sessionId}]`, err.message))
  res.json({ success: true, message: 'Session starting' })
})

// ── Session status ────────────────────────────────────────────────────────────
app.get('/session/status/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const s = sessions.get(sessionId)
  if (!s) return res.json({ success: false, state: null, message: 'session_not_found' })
  res.json({ success: s.state === 'CONNECTED', state: s.state, message: '' })
})

// ── QR code as PNG ────────────────────────────────────────────────────────────
app.get('/session/qr/:sessionId/image', async (req, res) => {
  const { sessionId } = req.params
  const s = sessions.get(sessionId)
  if (!s || !s.qr) {
    return res.json({ success: false, message: 'QR not ready' })
  }
  try {
    const buf = await qrcode.toBuffer(s.qr)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res.send(buf)
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to render QR' })
  }
})

// ── Terminate session ─────────────────────────────────────────────────────────
app.get('/session/terminate/:sessionId', async (req, res) => {
  await destroySession(req.params.sessionId)
  res.json({ success: true, message: 'Session terminated' })
})

// ── Send message ──────────────────────────────────────────────────────────────
app.post('/client/sendMessage/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  const { chatId, content } = req.body || {}
  const s = sessions.get(sessionId)
  if (!s || s.state !== 'CONNECTED') {
    return res.status(422).json({ success: false, message: 'Session not connected' })
  }
  try {
    // wwebjs-api uses @c.us; Baileys uses @s.whatsapp.net for individuals
    const jid = (chatId || '').replace(/@c\.us$/, '@s.whatsapp.net')
    await s.socket.sendMessage(jid, { text: String(content || '') })
    res.json({ success: true })
  } catch (err) {
    console.error(`[sendMessage][${sessionId}]`, err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Core: create a Baileys socket for a session ───────────────────────────────
async function startSession(sessionId) {
  const authDir = path.join(SESSIONS_PATH, sessionId)
  fs.mkdirSync(authDir, { recursive: true })

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir)

  const sessionData = { socket: null, qr: null, state: 'INITIALIZING' }
  sessions.set(sessionId, sessionData)

  const socket = makeWASocket({
    auth: authState,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['NovaGo', 'Chrome', '120.0'],
    connectTimeoutMs: 30_000,
    retryRequestDelayMs: 2_000,
    maxMsgRetryCount: 2,
  })

  sessionData.socket = socket
  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      sessionData.qr = qr
      sessionData.state = 'SCAN_QR_CODE'
      console.log(`[${sessionId}] QR ready — scan now`)
    }

    if (connection === 'open') {
      sessionData.state = 'CONNECTED'
      sessionData.qr = null
      console.log(`[${sessionId}] Connected ✓`)
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[${sessionId}] Closed — code=${code} loggedOut=${loggedOut}`)

      if (loggedOut) {
        // Wipe saved credentials and remove from memory
        fs.rmSync(authDir, { recursive: true, force: true })
        sessions.delete(sessionId)
      } else {
        // Transient disconnect — reconnect after a short delay
        sessions.delete(sessionId)
        setTimeout(() => {
          startSession(sessionId).catch(err => console.error(`[reconnect][${sessionId}]`, err.message))
        }, 3_000)
      }
    }
  })
}

// ── Core: cleanly shut down a session ────────────────────────────────────────
async function destroySession(sessionId) {
  const s = sessions.get(sessionId)
  if (s?.socket) {
    try { s.socket.end() } catch {}
  }
  sessions.delete(sessionId)
  // Wipe auth credentials so the next startSession always generates a fresh QR
  const authDir = path.join(SESSIONS_PATH, sessionId)
  try { fs.rmSync(authDir, { recursive: true, force: true }) } catch {}
}

// ── Restore sessions that were saved to disk ──────────────────────────────────
async function restoreSessions() {
  if (!fs.existsSync(SESSIONS_PATH)) return
  const entries = fs.readdirSync(SESSIONS_PATH, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      console.log(`[restore] ${e.name}`)
      await startSession(e.name).catch(err => console.error(`[restore][${e.name}]`, err.message))
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Baileys API on port ${PORT}`)
  await restoreSessions()
})
