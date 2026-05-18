/**
 * WhatsApp Engine
 *
 * Mirrors the wa.dt.wrld engine pattern (messageRouter + keyword + AI dispatch)
 * directly on top of whatsapp-web.js. Each user can run multiple WhatsApp
 * sessions; QR codes are exposed to the frontend, sessions persist via LocalAuth,
 * and incoming messages are routed to the user's active Prompt via OpenAI.
 */

import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import OpenAI from 'openai';
// whatsapp-web.js has no shipped types; require to keep TS happy
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client, LocalAuth } = require('whatsapp-web.js');

import WhatsAppSession, { WASessionStatus } from '../models/WhatsAppSession';
import WhatsAppMessage, { WAReplyKind } from '../models/WhatsAppMessage';
import WhatsAppLead, { IWhatsAppLead } from '../models/WhatsAppLead';
import Prompt from '../models/Prompt';
import AICredentials from '../models/AICredentials';
import { decrypt } from '../utils/credentialsCrypto';

const HISTORY_TURNS = 12;            // how many prior messages to feed the model
const READ_ONLY_SUFFIXES = ['@newsletter', '@broadcast', 'status@broadcast'];

const SESSION_DATA_PATH =
  process.env.WA_SESSION_DATA_PATH ||
  path.join(process.cwd(), '.wa_sessions');

if (!fs.existsSync(SESSION_DATA_PATH)) {
  fs.mkdirSync(SESSION_DATA_PATH, { recursive: true });
}

interface RuntimeSession {
  sessionId: string;
  userId: string;
  client: any;
  status: WASessionStatus;
  qr: string | null;          // raw qr string
  qrDataUrl: string | null;   // base64 data URL for the frontend
  phone: string | null;
  pushname: string | null;
  lastError: string | null;
  // Dedup window for incoming messages (id -> timestamp)
  recentMessageIds: Map<string, number>;
}

class WhatsAppEngine {
  private sessions: Map<string, RuntimeSession> = new Map();
  private readonly DEDUP_WINDOW_MS = 60_000;

  /**
   * Restore sessions from MongoDB on startup. LocalAuth will pick up disk state
   * and either reconnect silently or emit a fresh qr event.
   */
  async restoreFromDb(): Promise<void> {
    try {
      const records = await WhatsAppSession.find({
        status: { $in: ['authenticated', 'connected', 'qr_pending', 'initializing'] },
      });
      for (const record of records) {
        try {
          await this.startClient(record.sessionId, String(record.userId));
        } catch (err) {
          console.error(
            `[WhatsAppEngine] Failed to restore session ${record.sessionId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
      if (records.length > 0) {
        console.log(`[WhatsAppEngine] Restored ${records.length} session(s)`);
      }
    } catch (err) {
      console.error('[WhatsAppEngine] restoreFromDb failed:', err);
    }
  }

  /**
   * Create a new session record + start the underlying client.
   */
  async createSession(userId: string, name: string, promptId?: string | null): Promise<RuntimeSession> {
    const sessionId = `wa-${userId.slice(-4)}-${Date.now().toString(36)}`;

    await WhatsAppSession.create({
      userId,
      sessionId,
      name: name || '',
      promptId: promptId || null,
      status: 'initializing',
    });

    return this.startClient(sessionId, userId);
  }

  /**
   * Boot the whatsapp-web.js Client for a sessionId. Idempotent: returns the
   * existing runtime session if already active.
   */
  async startClient(sessionId: string, userId: string): Promise<RuntimeSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: SESSION_DATA_PATH,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    const runtime: RuntimeSession = {
      sessionId,
      userId,
      client,
      status: 'initializing',
      qr: null,
      qrDataUrl: null,
      phone: null,
      pushname: null,
      lastError: null,
      recentMessageIds: new Map(),
    };
    this.sessions.set(sessionId, runtime);

    client.on('qr', async (qr: string) => {
      runtime.qr = qr;
      try {
        runtime.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      } catch (err) {
        console.error(`[WhatsAppEngine][${sessionId}] QR encode failed:`, err);
        runtime.qrDataUrl = null;
      }
      await this.updateStatus(sessionId, 'qr_pending');
    });

    client.on('authenticated', async () => {
      runtime.qr = null;
      runtime.qrDataUrl = null;
      await this.updateStatus(sessionId, 'authenticated');
    });

    client.on('auth_failure', async (msg: string) => {
      runtime.lastError = msg;
      await this.updateStatus(sessionId, 'auth_failed', { lastError: msg });
    });

    client.on('ready', async () => {
      const info = client.info;
      runtime.phone = info?.wid?.user || null;
      runtime.pushname = info?.pushname || null;
      runtime.qr = null;
      runtime.qrDataUrl = null;
      await this.updateStatus(sessionId, 'connected', {
        phone: runtime.phone,
        pushname: runtime.pushname,
        lastActiveAt: new Date(),
      });
      console.log(`[WhatsAppEngine][${sessionId}] Connected as ${runtime.pushname} (${runtime.phone})`);
    });

    client.on('disconnected', async (reason: string) => {
      runtime.lastError = reason;
      await this.updateStatus(sessionId, 'disconnected', { lastError: reason });
      try {
        await client.destroy();
      } catch (_) { /* noop */ }
      this.sessions.delete(sessionId);
    });

    client.on('message', async (msg: any) => {
      try {
        await this.handleIncomingMessage(runtime, msg);
      } catch (err) {
        console.error(`[WhatsAppEngine][${sessionId}] message handler error:`, err);
      }
    });

    client.initialize().catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      runtime.lastError = message;
      await this.updateStatus(sessionId, 'disconnected', { lastError: message });
      console.error(`[WhatsAppEngine][${sessionId}] initialize failed:`, message);
    });

    return runtime;
  }

  /**
   * Core message router — mirrors wa.dt.wrld messageRouter:
   * 1. Skip own messages (feedback loop prevention)
   * 2. Deduplicate
   * 3. Persist inbound message
   * 4. Built-in keyword commands (ping, echo, help)
   * 5. Fallback to AI using the user's active prompt + OpenAI credentials
   */
  private async handleIncomingMessage(runtime: RuntimeSession, msg: any): Promise<void> {
    if (msg.fromMe) return;

    const id = msg?.id?._serialized || msg?.id?.id || `${msg.from}:${msg.timestamp}`;
    const now = Date.now();
    for (const [k, t] of runtime.recentMessageIds) {
      if (now - t > this.DEDUP_WINDOW_MS) runtime.recentMessageIds.delete(k);
    }
    if (runtime.recentMessageIds.has(id)) return;
    runtime.recentMessageIds.set(id, now);

    const body: string = (msg.body || '').trim();
    const chatId: string = msg.from;
    const isGroup = typeof chatId === 'string' && chatId.endsWith('@g.us');
    const isReadOnly = READ_ONLY_SUFFIXES.some((suffix) =>
      typeof chatId === 'string' && chatId.endsWith(suffix)
    );

    // Persist inbound message (even empty/media-only — useful in chat history)
    await this.persistMessage({
      userId: runtime.userId,
      sessionId: runtime.sessionId,
      chatId,
      isGroup,
      fromMe: false,
      direction: 'in',
      author: msg.author || null,
      body,
      hasMedia: !!msg.hasMedia,
      messageId: id,
      replyKind: null,
      timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
    });

    // Channels and broadcasts are read-only feeds — WhatsApp won't deliver replies.
    // Skip both keyword and AI handlers to avoid wasted OpenAI calls.
    if (isReadOnly) return;

    if (!body) return;

    // Built-in commands (mirroring keywordHandler in the engine)
    const keyword = this.detectKeyword(body);
    if (keyword) {
      await this.respondKeyword(runtime, msg, keyword);
      return;
    }

    // AI fallback using user's prompt + credentials
    await this.respondWithAI(runtime, msg, body, chatId, isGroup);
  }

  private async persistMessage(data: {
    userId: string;
    sessionId: string;
    chatId: string;
    isGroup: boolean;
    fromMe: boolean;
    direction: 'in' | 'out';
    author: string | null;
    body: string;
    hasMedia: boolean;
    messageId: string | null;
    replyKind: WAReplyKind;
    timestamp: Date;
  }): Promise<void> {
    try {
      await WhatsAppMessage.create(data);
    } catch (err) {
      console.error(`[WhatsAppEngine][${data.sessionId}] persist message failed:`, err);
    }
  }

  private async sendAndLog(
    runtime: RuntimeSession,
    chatId: string,
    text: string,
    replyKind: WAReplyKind,
    isGroup: boolean
  ): Promise<void> {
    const sent = await runtime.client.sendMessage(chatId, text);
    await this.persistMessage({
      userId: runtime.userId,
      sessionId: runtime.sessionId,
      chatId,
      isGroup,
      fromMe: true,
      direction: 'out',
      author: null,
      body: text,
      hasMedia: false,
      messageId: sent?.id?._serialized || null,
      replyKind,
      timestamp: new Date(),
    });
  }

  private detectKeyword(body: string): { name: 'ping' | 'echo' | 'help'; arg?: string } | null {
    if (/^\/?ping\s*$/i.test(body)) return { name: 'ping' };
    if (/^\/?help\s*$/i.test(body)) return { name: 'help' };
    const echoMatch = body.match(/^echo\s+(.+)$/i);
    if (echoMatch) return { name: 'echo', arg: echoMatch[1] };
    return null;
  }

  private async respondKeyword(
    runtime: RuntimeSession,
    msg: any,
    kw: { name: 'ping' | 'echo' | 'help'; arg?: string }
  ): Promise<void> {
    const chatId: string = msg.from;
    const isGroup = typeof chatId === 'string' && chatId.endsWith('@g.us');
    let text: string | null = null;
    if (kw.name === 'ping') text = 'pong 🏓';
    else if (kw.name === 'echo' && kw.arg) text = kw.arg;
    else if (kw.name === 'help') {
      text =
        'Available commands:\n• ping — health check\n• echo <text> — repeat your text\n• help — this menu\n\nOr just send a message and the AI will respond.';
    }
    if (text) await this.sendAndLog(runtime, chatId, text, 'keyword', isGroup);
  }

  private async respondWithAI(
    runtime: RuntimeSession,
    _msg: any,
    body: string,
    chatId: string,
    isGroup: boolean
  ): Promise<void> {
    const creds = await AICredentials.findOne({ userId: runtime.userId });
    if (!creds?.openaiApiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] No OpenAI key for user ${runtime.userId}`);
      return;
    }
    const apiKey = decrypt(creds.openaiApiKey);
    if (!apiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] OpenAI key could not be decrypted for user ${runtime.userId}`);
      return;
    }

    // Resolve the user's prompt (session-bound > active > most recent)
    const sessionRecord = await WhatsAppSession.findOne({ sessionId: runtime.sessionId });
    let prompt = null;
    if (sessionRecord?.promptId) {
      prompt = await Prompt.findOne({ _id: sessionRecord.promptId, userId: runtime.userId });
    }
    if (!prompt) {
      prompt = await Prompt.findOne({ userId: runtime.userId, status: 'active' }).sort({ updatedAt: -1 });
    }
    if (!prompt) {
      prompt = await Prompt.findOne({ userId: runtime.userId }).sort({ updatedAt: -1 });
    }

    const businessContext =
      prompt?.content?.trim() ||
      'You are a helpful WhatsApp assistant for a small business. Be warm, concise, and professional.';
    const businessName = prompt?.name?.trim() || 'our business';

    // Lead state + chat history
    const lead = await this.getOrCreateLead(runtime, chatId);
    const history = await WhatsAppMessage.find({
      sessionId: runtime.sessionId,
      chatId,
    })
      .sort({ timestamp: -1 })
      .limit(HISTORY_TURNS + 1) // +1 because the message we just stored is included
      .lean();

    // Drop the message we just received (duplicate) and reverse to chronological order.
    const priorHistory = history
      .reverse()
      .slice(0, -1)
      .map((m: any) => ({
        role: m.direction === 'out' ? ('assistant' as const) : ('user' as const),
        content: m.body || (m.hasMedia ? '[media]' : ''),
      }))
      .filter((m) => m.content);

    const isFirstContact = priorHistory.length === 0;

    const systemPrompt = this.buildSystemPrompt({
      businessName,
      businessContext,
      lead,
      isFirstContact,
      isGroup,
    });

    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...priorHistory,
          { role: 'user', content: body },
        ],
        temperature: 0.6,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = this.parseAIResponse(raw);

      if (parsed.extracted) {
        await this.applyLeadExtraction(lead, parsed.extracted);
      }

      // Always increment turns + bump last interaction
      lead.turns += 1;
      lead.lastInteractionAt = new Date();
      await lead.save();

      if (parsed.reply) {
        await this.sendAndLog(runtime, chatId, parsed.reply, 'ai', isGroup);
      }
    } catch (err) {
      console.error(`[WhatsAppEngine][${runtime.sessionId}] OpenAI call failed:`, err);
    }
  }

  private async getOrCreateLead(runtime: RuntimeSession, chatId: string): Promise<IWhatsAppLead> {
    const phone = chatId.endsWith('@c.us')
      ? chatId.replace('@c.us', '')
      : null; // @lid hides the real number; we only persist what we know
    const session = await WhatsAppSession.findOne({ sessionId: runtime.sessionId });
    const userObjectId = session?.userId;

    let lead = await WhatsAppLead.findOne({ sessionId: runtime.sessionId, chatId });
    if (!lead) {
      lead = await WhatsAppLead.create({
        userId: userObjectId,
        sessionId: runtime.sessionId,
        chatId,
        phone,
      });
    } else if (!lead.phone && phone) {
      lead.phone = phone;
    }
    return lead;
  }

  private buildSystemPrompt(args: {
    businessName: string;
    businessContext: string;
    lead: IWhatsAppLead;
    isFirstContact: boolean;
    isGroup: boolean;
  }): string {
    const { businessName, businessContext, lead, isFirstContact, isGroup } = args;
    const known = (val: string | null) => (val && val.trim() ? val : 'unknown');

    return [
      `You are the official WhatsApp assistant for ${businessName}.`,
      '',
      'BUSINESS CONTEXT — your knowledge and offerings are STRICTLY limited to what is described below.',
      'Do not answer questions outside this scope. If asked something off-topic, politely redirect the user back to what the business offers.',
      '----- BUSINESS CONTEXT START -----',
      businessContext,
      '----- BUSINESS CONTEXT END -----',
      '',
      'CONVERSATION GOALS:',
      isFirstContact
        ? '1. THIS IS THE FIRST MESSAGE FROM THIS USER. Open with a warm, friendly greeting and a one-sentence introduction to what the business does (based on the BUSINESS CONTEXT above). Then ask ONE follow-up question (start by asking for their NAME).'
        : '1. Continue the conversation naturally. Do NOT re-greet, do NOT re-introduce the business unless the user asks.',
      '2. Over the course of the conversation, smoothly collect: NAME → LOCATION → REQUIREMENT (what they need / what brings them here). Ask ONE thing at a time, conversationally — never list a form. Skip fields you already know.',
      '3. Once you have enough information, summarize back to the user, propose the next step the business offers, and answer their questions within scope.',
      '4. Keep replies short (1–3 short paragraphs at most) — this is WhatsApp, not email.',
      '5. Be human, warm, and professional. Use the user\'s first name once you know it. Use light, tasteful emojis sparingly only when natural.',
      isGroup
        ? '6. This is a GROUP chat — keep replies brief and only respond when the message clearly addresses the assistant or the business.'
        : '6. This is a one-to-one DM.',
      '',
      'WHAT YOU ALREADY KNOW ABOUT THIS USER (do not re-ask these):',
      `- Phone (auto-captured from WhatsApp): ${lead.phone || 'hidden / @lid identifier'}`,
      `- Name: ${known(lead.name)}`,
      `- Location: ${known(lead.location)}`,
      `- Requirement: ${known(lead.requirement)}`,
      `- Prior turns in this conversation: ${lead.turns}`,
      '',
      'OUTPUT FORMAT — respond ONLY with a JSON object, no markdown, no surrounding text:',
      '{',
      '  "reply": "<the message to send back, suitable for WhatsApp>",',
      '  "extracted": {',
      '    "name":        "<the user\'s name if they revealed it in THIS message, else null>",',
      '    "location":    "<the user\'s location if revealed in THIS message, else null>",',
      '    "requirement": "<a short phrase describing what they need / are asking about, if expressed in THIS message, else null>"',
      '  }',
      '}',
      '',
      'Never include the JSON keys in your reply text. Never invent values for extracted fields — only fill them when the user actually provided the information in their latest message.',
    ].join('\n');
  }

  private parseAIResponse(raw: string): {
    reply: string | null;
    extracted: { name?: string | null; location?: string | null; requirement?: string | null } | null;
  } {
    try {
      const obj = JSON.parse(raw);
      const reply = typeof obj.reply === 'string' ? obj.reply.trim() : null;
      const extracted = obj.extracted && typeof obj.extracted === 'object' ? obj.extracted : null;
      return { reply, extracted };
    } catch {
      // Model didn't honor JSON — fall back to using the raw text as the reply.
      return { reply: raw || null, extracted: null };
    }
  }

  private async applyLeadExtraction(
    lead: IWhatsAppLead,
    extracted: { name?: string | null; location?: string | null; requirement?: string | null }
  ): Promise<void> {
    const clean = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      if (!t) return null;
      if (/^(unknown|null|none|n\/a)$/i.test(t)) return null;
      return t;
    };
    const newName = clean(extracted.name);
    const newLocation = clean(extracted.location);
    const newRequirement = clean(extracted.requirement);
    if (newName && !lead.name) lead.name = newName;
    if (newLocation && !lead.location) lead.location = newLocation;
    if (newRequirement) {
      // Append over time — requirements may evolve as the chat develops.
      lead.requirement = lead.requirement
        ? `${lead.requirement}; ${newRequirement}`
        : newRequirement;
    }
  }

  private async updateStatus(
    sessionId: string,
    status: WASessionStatus,
    extra: Partial<{ phone: string | null; pushname: string | null; lastError: string | null; lastActiveAt: Date }> = {}
  ): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (runtime) runtime.status = status;
    try {
      await WhatsAppSession.updateOne({ sessionId }, { $set: { status, ...extra } });
    } catch (err) {
      console.error(`[WhatsAppEngine][${sessionId}] DB updateStatus failed:`, err);
    }
  }

  getRuntimeSession(sessionId: string): RuntimeSession | undefined {
    return this.sessions.get(sessionId);
  }

  async listForUser(userId: string) {
    const records = await WhatsAppSession.find({ userId }).sort({ createdAt: -1 });
    return records.map((r) => {
      const runtime = this.sessions.get(r.sessionId);
      return {
        id: String(r._id),
        sessionId: r.sessionId,
        name: r.name,
        phone: runtime?.phone || r.phone,
        pushname: runtime?.pushname || r.pushname,
        status: runtime?.status || r.status,
        promptId: r.promptId ? String(r.promptId) : null,
        lastActiveAt: r.lastActiveAt,
        lastError: runtime?.lastError || r.lastError,
        createdAt: r.createdAt,
      };
    });
  }

  async getQR(userId: string, sessionId: string): Promise<{ status: WASessionStatus; qrDataUrl: string | null } | null> {
    const record = await WhatsAppSession.findOne({ sessionId, userId });
    if (!record) return null;
    const runtime = this.sessions.get(sessionId);
    return {
      status: runtime?.status || record.status,
      qrDataUrl: runtime?.qrDataUrl || null,
    };
  }

  async getStatus(userId: string, sessionId: string) {
    const record = await WhatsAppSession.findOne({ sessionId, userId });
    if (!record) return null;
    const runtime = this.sessions.get(sessionId);
    return {
      status: runtime?.status || record.status,
      phone: runtime?.phone || record.phone,
      pushname: runtime?.pushname || record.pushname,
      lastActiveAt: record.lastActiveAt,
      lastError: runtime?.lastError || record.lastError,
    };
  }

  async disconnect(userId: string, sessionId: string): Promise<boolean> {
    const record = await WhatsAppSession.findOne({ sessionId, userId });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (runtime) {
      try { await runtime.client.logout(); } catch (_) { /* ignore */ }
      try { await runtime.client.destroy(); } catch (_) { /* ignore */ }
      this.sessions.delete(sessionId);
    }
    await WhatsAppSession.updateOne({ sessionId }, { $set: { status: 'disconnected' } });
    return true;
  }

  async destroy(userId: string, sessionId: string): Promise<boolean> {
    const record = await WhatsAppSession.findOne({ sessionId, userId });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (runtime) {
      try { await runtime.client.logout(); } catch (_) { /* ignore */ }
      try { await runtime.client.destroy(); } catch (_) { /* ignore */ }
      this.sessions.delete(sessionId);
    }
    await WhatsAppSession.deleteOne({ sessionId });
    // Best-effort cleanup of LocalAuth data on disk
    const dir = path.join(SESSION_DATA_PATH, `session-${sessionId}`);
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[WhatsAppEngine][${sessionId}] cleanup failed:`, err);
    }
    return true;
  }

  async sendMessage(userId: string, sessionId: string, to: string, text: string): Promise<boolean> {
    const record = await WhatsAppSession.findOne({ sessionId, userId });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (!runtime || runtime.status !== 'connected') return false;
    const chatId = to.includes('@') ? to : `${to.replace(/[^\d]/g, '')}@c.us`;
    const isGroup = chatId.endsWith('@g.us');
    await this.sendAndLog(runtime, chatId, text, 'manual', isGroup);
    return true;
  }

  /**
   * List chats for a session: one entry per chatId with last message + counts.
   */
  async listChats(userId: string, sessionId: string) {
    const session = await WhatsAppSession.findOne({ sessionId, userId });
    if (!session) return null;

    const chats = await WhatsAppMessage.aggregate([
      { $match: { sessionId, userId: session.userId } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$chatId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          inboundCount: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, 1, 0] } },
        },
      },
      { $sort: { 'lastMessage.timestamp': -1 } },
      { $limit: 200 },
    ]);

    return chats.map((c: any) => ({
      chatId: c._id,
      isGroup: typeof c._id === 'string' && c._id.endsWith('@g.us'),
      lastMessage: {
        body: c.lastMessage.body,
        direction: c.lastMessage.direction,
        timestamp: c.lastMessage.timestamp,
        replyKind: c.lastMessage.replyKind,
        hasMedia: c.lastMessage.hasMedia,
      },
      messageCount: c.messageCount,
      inboundCount: c.inboundCount,
    }));
  }

  async getLead(userId: string, sessionId: string, chatId: string) {
    const session = await WhatsAppSession.findOne({ sessionId, userId });
    if (!session) return null;
    const lead = await WhatsAppLead.findOne({ sessionId, chatId, userId: session.userId }).lean();
    return lead || null;
  }

  async listLeads(userId: string, opts: { sessionId?: string; limit?: number } = {}) {
    const filter: Record<string, unknown> = { userId };
    if (opts.sessionId) filter.sessionId = opts.sessionId;
    const limit = Math.min(opts.limit || 200, 500);
    const leads = await WhatsAppLead.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
    return leads.map((l: any) => ({
      id: String(l._id),
      sessionId: l.sessionId,
      chatId: l.chatId,
      phone: l.phone,
      name: l.name,
      location: l.location,
      requirement: l.requirement,
      turns: l.turns,
      lastInteractionAt: l.lastInteractionAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }

  /**
   * Aggregate stats for a user across all their WhatsApp sessions.
   * Powers the dashboard tiles (interactions, AI/keyword/manual reply counts).
   */
  async statsForUser(userId: string) {
    const sessions = await WhatsAppSession.find({ userId }).select('_id userId').lean();
    const objectId = sessions[0]?.userId; // Mongoose ObjectId we can reuse for queries

    const baseMatch = objectId ? { userId: objectId } : { userId: userId as any };
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totals, last24, monthly, distinctChats, recentChats] = await Promise.all([
      WhatsAppMessage.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            inbound: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, 1, 0] } },
            outbound: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 1, 0] } },
            ai: { $sum: { $cond: [{ $eq: ['$replyKind', 'ai'] }, 1, 0] } },
            keyword: { $sum: { $cond: [{ $eq: ['$replyKind', 'keyword'] }, 1, 0] } },
            manual: { $sum: { $cond: [{ $eq: ['$replyKind', 'manual'] }, 1, 0] } },
          },
        },
      ]),
      WhatsAppMessage.aggregate([
        { $match: { ...baseMatch, timestamp: { $gte: dayAgo } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            inbound: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, 1, 0] } },
            outbound: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 1, 0] } },
          },
        },
      ]),
      WhatsAppMessage.aggregate([
        { $match: { ...baseMatch, timestamp: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            replies: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 1, 0] } },
          },
        },
      ]),
      WhatsAppMessage.distinct('chatId', baseMatch),
      WhatsAppMessage.aggregate([
        { $match: baseMatch },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$chatId',
            lastBody: { $first: '$body' },
            lastDirection: { $first: '$direction' },
            timestamp: { $first: '$timestamp' },
          },
        },
        { $sort: { timestamp: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const t = totals[0] || { total: 0, inbound: 0, outbound: 0, ai: 0, keyword: 0, manual: 0 };
    const d = last24[0] || { total: 0, inbound: 0, outbound: 0 };
    const m = monthly[0] || { total: 0, replies: 0 };

    return {
      sessions: sessions.length,
      totalChats: distinctChats.length,
      totals: {
        all: t.total,
        inbound: t.inbound,
        outbound: t.outbound,
        ai: t.ai,
        keyword: t.keyword,
        manual: t.manual,
      },
      last24h: {
        all: d.total,
        inbound: d.inbound,
        outbound: d.outbound,
      },
      thisMonth: {
        all: m.total,
        replies: m.replies,
      },
      recentChats: recentChats.map((c: any) => ({
        chatId: c._id,
        lastBody: c.lastBody,
        lastDirection: c.lastDirection,
        timestamp: c.timestamp,
      })),
    };
  }

  async listMessages(
    userId: string,
    sessionId: string,
    chatId: string,
    limit = 100
  ) {
    const session = await WhatsAppSession.findOne({ sessionId, userId });
    if (!session) return null;
    const messages = await WhatsAppMessage.find({ sessionId, chatId, userId: session.userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return messages.reverse().map((m: any) => ({
      id: String(m._id),
      chatId: m.chatId,
      direction: m.direction,
      fromMe: m.fromMe,
      author: m.author,
      body: m.body,
      hasMedia: m.hasMedia,
      replyKind: m.replyKind,
      timestamp: m.timestamp,
    }));
  }
}

export const whatsappEngine = new WhatsAppEngine();
