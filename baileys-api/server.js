'use strict'

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
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
const BACKEND_WEBHOOK_URL = (process.env.BACKEND_WEBHOOK_URL || '').replace(/\/$/, '')

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
  // Baileys ships with a WA web version baked in at release time; WhatsApp
  // rotates the accepted protocol version frequently, so an unpinned/stale
  // version gets the connection closed immediately (before a QR is ever
  // emitted). Always negotiate the current version instead of relying on
  // the library default.
  const { version } = await fetchLatestBaileysVersion()

  const sessionData = { socket: null, qr: null, state: 'INITIALIZING' }
  sessions.set(sessionId, sessionData)

  const socket = makeWASocket({
    auth: authState,
    version,
    logger: pino({ level: 'warn' }),   // surface warnings/errors in Railway logs
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 0,
    retryRequestDelayMs: 3_000,
    maxMsgRetryCount: 3,
  })

  sessionData.socket = socket
  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      handleInboundMessage(sessionId, msg).catch(err =>
        console.error(`[inbound][${sessionId}]`, err.message))
    }
  })

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

// ── Inbound messages: forward to backend for persistence + AI reply ──────────
async function handleInboundMessage(sessionId, msg) {
  if (msg.key?.fromMe || !msg.key?.remoteJid) return
  if (!BACKEND_WEBHOOK_URL) return

  const chatId = msg.key.remoteJid
  const isGroup = chatId.endsWith('@g.us')
  const author = isGroup ? (msg.key.participant || null) : null
  const m = msg.message || {}
  const body =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  const hasMedia = !!(m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage)
  const messageId = msg.key.id || null
  const timestamp = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString()

  // "Share current location" / a picked place — degreesLatitude/Longitude are
  // always present; name/address are only set when the customer picked a named
  // place rather than sharing raw GPS. Backend does any address lookup.
  const loc = m.locationMessage
  const location = loc
    ? { lat: loc.degreesLatitude, lng: loc.degreesLongitude, name: loc.name || null, address: loc.address || null }
    : undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const resp = await fetch(`${BACKEND_WEBHOOK_URL}/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ chatId, isGroup, author, body, hasMedia, messageId, timestamp, location }),
      signal: controller.signal,
    })
    if (!resp.ok) console.error(`[inbound][${sessionId}] webhook ${resp.status}`)
  } finally {
    clearTimeout(timer)
  }
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
    // Skip ext4's reserved recovery directory that Railway volumes create —
    // it isn't a session and would otherwise spin up a bogus Baileys socket.
    if (e.isDirectory() && e.name !== 'lost+found') {
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
