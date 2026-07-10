/**
 * WhatsApp routes — thin proxy to the external wwebjs-api service.
 *
 * Set env vars in Railway:
 *   WHATSAPP_API_URL   Base URL of the deployed wwebjs-api (e.g. https://wa.dater.world)
 *   WHATSAPP_API_KEY   API key expected by that service (x-api-key header)
 *
 * Session records are kept in Postgres so each user can only see their own
 * sessions. All live WhatsApp state (QR, connection, messages) lives in the
 * wwebjs-api service.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  persistMessage, isAiPaused, setAiPaused, respondAsRestaurantAI,
  listChats, listMessages, getLead, listLeads,
} from '../services/whatsappInbox';
import { reverseGeocode } from '../services/geocoding';

const router = Router();

const WA_API_URL = (process.env.WHATSAPP_API_URL || '').replace(/\/$/, '');
const WA_API_KEY = process.env.WHATSAPP_API_KEY || '';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

function normalizeSessionId(raw?: string): string {
  const t = (raw || '').trim();
  if (!t) return `wa-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  return t
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function waHeaders(): Record<string, string> {
  return { 'x-api-key': WA_API_KEY };
}

// ── Inbound webhook (service-to-service, from baileys-api) ───────────────────

function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  if (!WA_API_KEY || req.headers['x-api-key'] !== WA_API_KEY) {
    return res.status(403).json({ error: 'Invalid webhook secret' });
  }
  next();
}

router.post('/webhook/inbound/:sessionId', verifyWebhookSecret, async (req: Request, res: Response) => {
  res.status(200).json({ ok: true }); // ack immediately — baileys-api doesn't await this
  const { sessionId } = req.params;
  const { chatId, isGroup, author, body, hasMedia, messageId, timestamp, location } = req.body || {};

  try {
    const session = await prisma.whatsAppSession.findUnique({ where: { sessionId } });
    if (!session || !chatId) return;

    let effectiveBody: string = body || '';
    let locationForHandler: { lat: number; lng: number; address: string } | undefined;

    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      const address =
        location.address ||
        location.name ||
        (await reverseGeocode(location.lat, location.lng)) ||
        `${location.lat}, ${location.lng}`;
      if (!effectiveBody) effectiveBody = `📍 Shared current location: ${address}`;
      locationForHandler = { lat: location.lat, lng: location.lng, address };
    }

    await persistMessage({
      userId: session.userId,
      sessionId,
      chatId,
      isGroup: !!isGroup,
      fromMe: false,
      direction: 'in',
      author: author || null,
      body: effectiveBody,
      hasMedia: !!hasMedia,
      messageId: messageId || null,
      replyKind: null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: location ? { lat: location.lat, lng: location.lng } : undefined,
    });

    if (!effectiveBody || !session.restaurantId) return; // no restaurant linked — capture only
    if (await isAiPaused(sessionId, chatId)) return; // admin took over this chat

    await respondAsRestaurantAI({
      userId: session.userId,
      sessionId,
      restaurantId: session.restaurantId,
      chatId,
      body: effectiveBody,
      isGroup: !!isGroup,
      location: locationForHandler,
    });
  } catch (err) {
    console.error(`[whatsapp][webhook][${sessionId}]`, err);
  }
});

// ── Chats, messages, leads (DB-backed) ─────────────────────────────────────────

router.get('/sessions/:sessionId/chats', authMiddleware, async (req: AuthRequest, res: Response) => {
  const chats = await listChats(req.userId!, req.params.sessionId);
  if (chats === null) return res.status(404).json({ error: 'Session not found' });
  return res.json(chats);
});

router.get('/sessions/:sessionId/chats/:chatId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  const messages = await listMessages(req.userId!, req.params.sessionId, req.params.chatId, 100);
  if (messages === null) return res.status(404).json({ error: 'Session not found' });
  return res.json(messages);
});

router.get('/sessions/:sessionId/chats/:chatId/lead', authMiddleware, async (req: AuthRequest, res: Response) => {
  const lead = await getLead(req.userId!, req.params.sessionId, req.params.chatId);
  if (!lead) return res.status(404).json({ error: 'No lead for this chat' });
  return res.json(lead);
});

router.post('/sessions/:sessionId/chats/:chatId/resume-ai', authMiddleware, async (req: AuthRequest, res: Response) => {
  const session = await prisma.whatsAppSession.findFirst({
    where: { sessionId: req.params.sessionId, userId: req.userId! },
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  await setAiPaused(req.params.sessionId, req.params.chatId, false);
  return res.json({ ok: true });
});

router.get('/leads', authMiddleware, async (req: AuthRequest, res: Response) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  return res.json(await listLeads(req.userId!, { sessionId }));
});

router.patch('/sessions/:sessionId/restaurant', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { restaurantId } = req.body || {};
  const updated = await prisma.whatsAppSession.updateMany({
    where: { sessionId: req.params.sessionId, userId: req.userId! },
    data: { restaurantId: restaurantId || null },
  });
  if (updated.count === 0) return res.status(404).json({ error: 'Session not found' });
  return res.json({ ok: true, restaurantId: restaurantId || null });
});

// ── Session listing (DB-backed for user isolation) ────────────────────────────

router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.whatsAppSession.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(sessions);
  } catch (err) {
    console.error('[whatsapp][list]', err);
    return res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ── Create / start a session ──────────────────────────────────────────────────

router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, promptId, restaurantId } = req.body || {};
    const sessionId = normalizeSessionId(name);

    await prisma.whatsAppSession.upsert({
      where: { sessionId },
      create: {
        userId: req.userId!,
        sessionId,
        name: name || sessionId,
        promptId: promptId || null,
        restaurantId: restaurantId || null,
        status: 'initializing',
      },
      update: { status: 'initializing', lastError: null },
    });

    if (WA_API_URL) {
      // wwebjs-api's start endpoint blocks until Chromium's pupPage is ready
      // (can take 30-90s). Use a 90s timeout and treat timeout as "still starting".
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90_000);
      const resp = await fetch(
        `${WA_API_URL}/session/start/${encodeURIComponent(sessionId)}`,
        { headers: waHeaders(), signal: controller.signal }
      ).catch((e) => {
        if (e?.name !== 'AbortError') console.error('[whatsapp][start] fetch error:', e?.message);
        return null;
      }).finally(() => clearTimeout(timer));

      if (resp && !resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error(`[whatsapp][start] wwebjs-api ${resp.status}:`, body);
      }
    } else {
      console.warn('[whatsapp] WHATSAPP_API_URL not set — session recorded but not started');
    }

    return res.status(201).json({ sessionId, status: 'initializing' });
  } catch (err) {
    console.error('[whatsapp][create]', err);
    return res.status(500).json({ error: 'Failed to start session' });
  }
});

// ── Live status (proxied from wwebjs-api) ─────────────────────────────────────

router.get('/sessions/:sessionId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    if (!WA_API_URL) {
      return res.json({ status: 'disconnected', error: 'WHATSAPP_API_URL not configured' });
    }

    const resp = await fetch(
      `${WA_API_URL}/session/status/${encodeURIComponent(sessionId)}`,
      { headers: waHeaders() }
    );

    const data: any = await resp.json().catch(() => ({}));

    // wwebjs-api returns { success, state, message }
    // state is a whatsapp-web.js WAState string (CONNECTED, PAIRING, OPENING, etc.)
    // When null + message='session_not_found', the session is still booting — keep as
    // 'initializing' so the frontend spinner stays up rather than showing DISCONNECTED.
    // Only use 'disconnected' when we know the browser/session is actually gone.
    const rawState: string = data?.state || data?.status || '';
    const waMessage: string = data?.message || '';
    let status: string;
    if (rawState) {
      status = rawState.toLowerCase();
    } else if (waMessage === 'session_not_found') {
      status = 'initializing';
    } else {
      // browser tab closed, session closed, auth_failure, etc.
      status = 'disconnected';
    }

    // Persist latest status so the DB stays in sync
    await prisma.whatsAppSession.updateMany({
      where: { sessionId, userId: req.userId! },
      data: { status },
    }).catch(() => {});

    return res.json({
      status,
      phone:    data?.phone    ?? null,
      pushname: data?.pushname ?? null,
    });
  } catch (err) {
    console.error('[whatsapp][status]', err);
    return res.status(503).json({ status: 'disconnected', error: 'WhatsApp API unreachable' });
  }
});

// ── QR code — fetched from wwebjs-api and returned as base64 data URL ─────────

router.get('/sessions/:sessionId/qr', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    if (!WA_API_URL) {
      return res.json({ status: 'not_ready', qrDataUrl: null });
    }

    const resp = await fetch(
      `${WA_API_URL}/session/qr/${encodeURIComponent(sessionId)}/image`,
      { headers: waHeaders() }
    );

    // wwebjs-api returns JSON {success:false} with 200 when QR isn't ready yet —
    // only treat the body as an image if Content-Type is actually image/*
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok || !contentType.includes('image/')) {
      return res.json({ status: 'not_ready', qrDataUrl: null });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    const qrDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    return res.json({ qrDataUrl, status: 'qr_pending' });
  } catch (err) {
    console.error('[whatsapp][qr]', err);
    return res.json({ status: 'not_ready', qrDataUrl: null });
  }
});

// ── Disconnect ────────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    if (WA_API_URL) {
      await fetch(
        `${WA_API_URL}/session/terminate/${encodeURIComponent(sessionId)}`,
        { headers: waHeaders() }
      ).catch(() => {});
    }

    await prisma.whatsAppSession.updateMany({
      where: { sessionId, userId: req.userId! },
      data: { status: 'disconnected' },
    }).catch(() => {});

    return res.json({ status: 'disconnected' });
  } catch (err) {
    console.error('[whatsapp][disconnect]', err);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ── Delete session ────────────────────────────────────────────────────────────

router.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    if (WA_API_URL) {
      await fetch(
        `${WA_API_URL}/session/terminate/${encodeURIComponent(sessionId)}`,
        { headers: waHeaders() }
      ).catch(() => {});
    }

    await prisma.whatsAppSession.deleteMany({
      where: { sessionId, userId: req.userId! },
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp][delete]', err);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ── Send message ──────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  const { to, text } = req.body || {};

  try {
    if (!WA_API_URL) {
      return res.status(503).json({ error: 'WHATSAPP_API_URL not configured' });
    }

    const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId: req.userId! } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const chatId: string = String(to).includes('@') ? String(to) : `${to}@s.whatsapp.net`;
    const isGroup = chatId.endsWith('@g.us');

    const resp = await fetch(
      `${WA_API_URL}/client/sendMessage/${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        headers: { ...waHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, contentType: 'string', content: text }),
      }
    );

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(resp.status).json(data);

    await persistMessage({
      userId: session.userId, sessionId, chatId, isGroup, fromMe: true, direction: 'out',
      author: null, body: text, hasMedia: false, messageId: null, replyKind: 'manual',
      timestamp: new Date(),
    });
    await setAiPaused(sessionId, chatId, true); // manual reply = takeover

    return res.status(200).json(data);
  } catch (err) {
    console.error('[whatsapp][send]', err);
    return res.status(503).json({ error: 'WhatsApp API unreachable' });
  }
});

export default router;
