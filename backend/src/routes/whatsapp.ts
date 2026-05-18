import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { whatsappEngine } from '../services/whatsappEngine';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// List all WhatsApp sessions for the current user
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await whatsappEngine.listForUser(req.userId!);
    res.json(sessions);
  } catch (err) {
    console.error('[whatsapp][list] error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Create a new session and start the underlying engine client
router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, promptId } = req.body || {};
    const runtime = await whatsappEngine.createSession(req.userId!, name || '', promptId || null);
    res.status(201).json({
      sessionId: runtime.sessionId,
      status: runtime.status,
      name: name || '',
      promptId: promptId || null,
    });
  } catch (err) {
    console.error('[whatsapp][create] error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get current QR code (data URL) for a session
router.get('/sessions/:sessionId/qr', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = await whatsappEngine.getQR(req.userId!, req.params.sessionId);
    if (!data) return res.status(404).json({ error: 'Session not found' });
    res.json(data);
  } catch (err) {
    console.error('[whatsapp][qr] error:', err);
    res.status(500).json({ error: 'Failed to fetch QR' });
  }
});

// Get session status (poll target for the frontend)
router.get('/sessions/:sessionId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = await whatsappEngine.getStatus(req.userId!, req.params.sessionId);
    if (!status) return res.status(404).json({ error: 'Session not found' });
    res.json(status);
  } catch (err) {
    console.error('[whatsapp][status] error:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Disconnect a session (keeps the record but logs out the client)
router.post('/sessions/:sessionId/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await whatsappEngine.disconnect(req.userId!, req.params.sessionId);
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    res.json({ status: 'disconnected' });
  } catch (err) {
    console.error('[whatsapp][disconnect] error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Permanently delete a session (also removes LocalAuth data)
router.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await whatsappEngine.destroy(req.userId!, req.params.sessionId);
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp][destroy] error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// List leads (CRM-style summary across all sessions, optionally filtered)
router.get('/leads', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = (req.query as any).sessionId as string | undefined;
    const limit = parseInt((req.query as any).limit || '200', 10) || 200;
    const leads = await whatsappEngine.listLeads(req.userId!, { sessionId, limit });
    res.json(leads);
  } catch (err) {
    console.error('[whatsapp][leads] error:', err);
    res.status(500).json({ error: 'Failed to list leads' });
  }
});

// Get a single lead for one chat (used in the chat panel)
router.get(
  '/sessions/:sessionId/chats/:chatId/lead',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const lead = await whatsappEngine.getLead(req.userId!, req.params.sessionId, req.params.chatId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json(lead);
    } catch (err) {
      console.error('[whatsapp][lead] error:', err);
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  }
);

// Aggregate WhatsApp stats for the dashboard
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await whatsappEngine.statsForUser(req.userId!);
    res.json(stats);
  } catch (err) {
    console.error('[whatsapp][stats] error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// List chats for a session (one entry per chatId, with last message + counts)
router.get('/sessions/:sessionId/chats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chats = await whatsappEngine.listChats(req.userId!, req.params.sessionId);
    if (chats === null) return res.status(404).json({ error: 'Session not found' });
    res.json(chats);
  } catch (err) {
    console.error('[whatsapp][chats] error:', err);
    res.status(500).json({ error: 'Failed to list chats' });
  }
});

// Get message transcript for a single chat (oldest → newest)
router.get(
  '/sessions/:sessionId/chats/:chatId/messages',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
      const messages = await whatsappEngine.listMessages(
        req.userId!,
        req.params.sessionId,
        req.params.chatId,
        limit
      );
      if (messages === null) return res.status(404).json({ error: 'Session not found' });
      res.json(messages);
    } catch (err) {
      console.error('[whatsapp][messages] error:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

// Send a message manually (useful for the frontend HITL view / testing)
router.post('/sessions/:sessionId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
    const ok = await whatsappEngine.sendMessage(req.userId!, req.params.sessionId, to, text);
    if (!ok) return res.status(409).json({ error: 'Session not connected' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp][sendMessage] error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
