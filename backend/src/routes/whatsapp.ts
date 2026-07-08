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

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

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
      const resp = await fetch(
        `${WA_API_URL}/session/start/${encodeURIComponent(sessionId)}`,
        { headers: waHeaders() }
      ).catch((e) => {
        console.error('[whatsapp][start] fetch error:', e?.message);
        return null;
      });

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

    // wwebjs-api returns { success, state } — map to { status }
    const status: string = (data?.state || data?.status || 'disconnected').toLowerCase();

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

    if (!resp.ok) {
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

    const resp = await fetch(
      `${WA_API_URL}/client/sendMessage/${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        headers: { ...waHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${to}@c.us`, contentType: 'string', content: text }),
      }
    );

    const data = await resp.json().catch(() => ({}));
    return res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    console.error('[whatsapp][send]', err);
    return res.status(503).json({ error: 'WhatsApp API unreachable' });
  }
});

export default router;
