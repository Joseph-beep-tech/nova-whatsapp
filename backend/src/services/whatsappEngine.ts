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

import { WASessionStatus } from '../models/WhatsAppSession';
import { WAReplyKind } from '../models/WhatsAppMessage';
import { IWhatsAppLead } from '../models/WhatsAppLead';
import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/credentialsCrypto';
import { novaGoHandler } from '../modules/whatsapp/novagoConversationHandler';

const HISTORY_TURNS = 12;
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
  client: unknown;
  status: WASessionStatus;
  qr: string | null;
  qrDataUrl: string | null;
  phone: string | null;
  pushname: string | null;
  lastError: string | null;
  restaurantId: string | null;
  recentMessageIds: Map<string, number>;
}

class WhatsAppEngine {
  private sessions: Map<string, RuntimeSession> = new Map();
  private readonly DEDUP_WINDOW_MS = 60_000;

  async restoreFromDb(): Promise<void> {
    try {
      // Purge stale sessions that are already dead — keeps the DB clean on each startup
      await prisma.whatsAppSession.deleteMany({
        where: { status: { in: ['disconnected', 'auth_failed'] } },
      }).catch(() => {/* noop */});

      const records = await prisma.whatsAppSession.findMany({
        where: { status: { in: ['authenticated', 'connected', 'qr_pending', 'initializing'] } },
      });
      for (const record of records) {
        try {
          await this.startClient(record.sessionId, record.userId);
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

  async createSession(
    userId: string,
    name: string,
    promptId?: string | null,
    restaurantId?: string | null,
  ): Promise<RuntimeSession> {
    const sessionId = (name || '').trim() || `wa-${userId.slice(-4)}-${Date.now().toString(36)}`;

    // Already running in memory — return immediately
    const existing = this.sessions.get(sessionId);
    if (existing && existing.status !== 'disconnected' && existing.status !== 'auth_failed') {
      return existing;
    }

    // Upsert so reconnect doesn't fail with unique-key errors
    await prisma.whatsAppSession.upsert({
      where: { sessionId },
      create: {
        userId,
        sessionId,
        name: name || sessionId,
        promptId: promptId || null,
        restaurantId: restaurantId || null,
        status: 'initializing',
      },
      update: {
        status: 'initializing',
        lastError: null,
      },
    });

    // Remove stale runtime entry so startClient re-creates the client
    this.sessions.delete(sessionId);

    return this.startClient(sessionId, userId);
  }

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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      },
    });

    const sessionRecord = await prisma.whatsAppSession.findUnique({ where: { sessionId } });
    const restaurantId = sessionRecord?.restaurantId || null;

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
      restaurantId,
      recentMessageIds: new Map(),
    };
    this.sessions.set(sessionId, runtime);

    const c = client as { on: (e: string, fn: (...a: unknown[]) => unknown) => void; initialize: () => Promise<void>; info?: { wid?: { user?: string }; pushname?: string } };

    c.on('qr', async (qr: string) => {
      runtime.qr = qr;
      try {
        runtime.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      } catch (err) {
        console.error(`[WhatsAppEngine][${sessionId}] QR encode failed:`, err);
        runtime.qrDataUrl = null;
      }
      await this.updateStatus(sessionId, 'qr_pending');
    });

    c.on('authenticated', async () => {
      runtime.qr = null;
      runtime.qrDataUrl = null;
      await this.updateStatus(sessionId, 'authenticated');
    });

    c.on('auth_failure', async (msg: string) => {
      runtime.lastError = msg;
      await this.updateStatus(sessionId, 'auth_failed', { lastError: msg });
    });

    c.on('ready', async () => {
      const info = (client as { info?: { wid?: { user?: string }; pushname?: string } }).info;
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

    c.on('disconnected', async (reason: string) => {
      runtime.lastError = reason;
      await this.updateStatus(sessionId, 'disconnected', { lastError: reason });
      try {
        await (client as { destroy: () => Promise<void> }).destroy();
      } catch (_) { /* noop */ }
      this.sessions.delete(sessionId);
    });

    c.on('message', async (msg: unknown) => {
      try {
        await this.handleIncomingMessage(runtime, msg);
      } catch (err) {
        console.error(`[WhatsAppEngine][${sessionId}] message handler error:`, err);
      }
    });

    c.initialize().catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      runtime.lastError = message;
      await this.updateStatus(sessionId, 'disconnected', { lastError: message });
      console.error(`[WhatsAppEngine][${sessionId}] initialize failed:`, message);
    });

    return runtime;
  }

  private async handleIncomingMessage(runtime: RuntimeSession, msg: unknown): Promise<void> {
    const m = msg as {
      fromMe?: boolean;
      id?: { _serialized?: string; id?: string };
      from?: string;
      timestamp?: number;
      body?: string;
      author?: string;
      hasMedia?: boolean;
    };

    if (m.fromMe) return;

    const id = m?.id?._serialized || m?.id?.id || `${m.from}:${m.timestamp}`;
    const now = Date.now();
    for (const [k, t] of runtime.recentMessageIds) {
      if (now - t > this.DEDUP_WINDOW_MS) runtime.recentMessageIds.delete(k);
    }
    if (runtime.recentMessageIds.has(id)) return;
    runtime.recentMessageIds.set(id, now);

    const body: string = (m.body || '').trim();
    const chatId: string = m.from || '';
    const isGroup = typeof chatId === 'string' && chatId.endsWith('@g.us');
    const isReadOnly = READ_ONLY_SUFFIXES.some((suffix) =>
      typeof chatId === 'string' && chatId.endsWith(suffix)
    );

    await this.persistMessage({
      userId: runtime.userId,
      sessionId: runtime.sessionId,
      chatId,
      isGroup,
      fromMe: false,
      direction: 'in',
      author: m.author || null,
      body,
      hasMedia: !!m.hasMedia,
      messageId: id,
      replyKind: null,
      timestamp: m.timestamp ? new Date(m.timestamp * 1000) : new Date(),
    });

    if (isReadOnly) return;
    if (!body) return;

    const keyword = this.detectKeyword(body);
    if (keyword) {
      await this.respondKeyword(runtime, msg, keyword);
      return;
    }

    if (runtime.restaurantId) {
      await this.respondAsRestaurantAI(runtime, msg, body, chatId, isGroup);
      return;
    }

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
      await prisma.whatsAppMessage.create({
        data: {
          userId: data.userId,
          sessionId: data.sessionId,
          chatId: data.chatId,
          from: data.fromMe ? 'me' : data.chatId,
          to: data.fromMe ? data.chatId : null,
          body: data.body,
          direction: data.direction,
          fromMe: data.fromMe,
          isGroup: data.isGroup,
          author: data.author,
          hasMedia: data.hasMedia,
          replyKind: data.replyKind || null,
          messageId: data.messageId,
          timestamp: data.timestamp,
        },
      });
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
    const sent = await (runtime.client as { sendMessage: (to: string, text: string) => Promise<{ id?: { _serialized?: string } }> }).sendMessage(chatId, text);
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
    msg: unknown,
    kw: { name: 'ping' | 'echo' | 'help'; arg?: string }
  ): Promise<void> {
    const chatId: string = (msg as { from?: string }).from || '';
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

  private async respondAsRestaurantAI(
    runtime: RuntimeSession,
    _msg: unknown,
    body: string,
    chatId: string,
    isGroup: boolean,
  ): Promise<void> {
    const creds = await prisma.aICredentials.findFirst({ where: { userId: runtime.userId } });
    if (!creds?.openaiApiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] NovaGo: no OpenAI key for user ${runtime.userId}`);
      return;
    }
    const apiKey = decrypt(creds.openaiApiKey);
    if (!apiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] NovaGo: OpenAI key decrypt failed`);
      return;
    }

    const history = await prisma.whatsAppMessage.findMany({
      where: { sessionId: runtime.sessionId, chatId },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
    const priorHistory = [...history]
      .reverse()
      .slice(0, -1)
      .map((m) => ({
        role: m.direction === 'out' ? ('assistant' as const) : ('user' as const),
        content: m.body || '',
      }))
      .filter((m) => m.content);

    const customerPhone = chatId.endsWith('@c.us') ? chatId.replace('@c.us', '') : chatId;

    try {
      const reply = await novaGoHandler.handleMessage({
        restaurantId:  runtime.restaurantId!,
        sessionId:     runtime.sessionId,
        chatId,
        customerPhone,
        messageBody:   body,
        apiKey,
        priorHistory,
      });
      if (reply) {
        await this.sendAndLog(runtime, chatId, reply, 'ai', isGroup);
      }
    } catch (err) {
      console.error(`[WhatsAppEngine][${runtime.sessionId}] NovaGo handler error:`, err);
    }
  }

  private async respondWithAI(
    runtime: RuntimeSession,
    _msg: unknown,
    body: string,
    chatId: string,
    isGroup: boolean
  ): Promise<void> {
    const creds = await prisma.aICredentials.findFirst({ where: { userId: runtime.userId } });
    if (!creds?.openaiApiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] No OpenAI key for user ${runtime.userId}`);
      return;
    }
    const apiKey = decrypt(creds.openaiApiKey);
    if (!apiKey) {
      console.warn(`[WhatsAppEngine][${runtime.sessionId}] OpenAI key could not be decrypted for user ${runtime.userId}`);
      return;
    }

    const sessionRecord = await prisma.whatsAppSession.findUnique({ where: { sessionId: runtime.sessionId } });
    let prompt = null;
    if (sessionRecord?.promptId) {
      prompt = await prisma.prompt.findFirst({ where: { id: sessionRecord.promptId, userId: runtime.userId } });
    }
    if (!prompt) {
      prompt = await prisma.prompt.findFirst({ where: { userId: runtime.userId, status: 'active' }, orderBy: { updatedAt: 'desc' } });
    }
    if (!prompt) {
      prompt = await prisma.prompt.findFirst({ where: { userId: runtime.userId }, orderBy: { updatedAt: 'desc' } });
    }

    const businessContext =
      prompt?.content?.trim() ||
      'You are a helpful WhatsApp assistant for a small business. Be warm, concise, and professional.';
    const businessName = prompt?.name?.trim() || 'our business';

    const lead = await this.getOrCreateLead(runtime, chatId);
    const history = await prisma.whatsAppMessage.findMany({
      where: { sessionId: runtime.sessionId, chatId },
      orderBy: { timestamp: 'desc' },
      take: HISTORY_TURNS + 1,
    });

    const priorHistory = [...history]
      .reverse()
      .slice(0, -1)
      .map((m) => ({
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

      await prisma.whatsAppLead.update({
        where: { id: lead.id },
        data: { turns: { increment: 1 }, lastInteractionAt: new Date() },
      });

      if (parsed.reply) {
        await this.sendAndLog(runtime, chatId, parsed.reply, 'ai', isGroup);
      }
    } catch (err) {
      console.error(`[WhatsAppEngine][${runtime.sessionId}] OpenAI call failed:`, err);
    }
  }

  private async getOrCreateLead(runtime: RuntimeSession, chatId: string): Promise<IWhatsAppLead> {
    const phone = chatId.endsWith('@c.us') ? chatId.replace('@c.us', '') : null;
    const session = await prisma.whatsAppSession.findUnique({ where: { sessionId: runtime.sessionId } });
    const userId = session?.userId || runtime.userId;

    let lead = await prisma.whatsAppLead.findFirst({ where: { sessionId: runtime.sessionId, chatId } });
    if (!lead) {
      lead = await prisma.whatsAppLead.create({
        data: { userId, sessionId: runtime.sessionId, chatId, phone, source: 'whatsapp' },
      });
    } else if (!lead.phone && phone) {
      lead = await prisma.whatsAppLead.update({ where: { id: lead.id }, data: { phone } });
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
    const known = (val: string | null | undefined) => (val && val.trim() ? val : 'unknown');

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
      const obj = JSON.parse(raw) as { reply?: unknown; extracted?: { name?: string | null; location?: string | null; requirement?: string | null } };
      const reply = typeof obj.reply === 'string' ? obj.reply.trim() : null;
      const extracted = obj.extracted && typeof obj.extracted === 'object' ? obj.extracted : null;
      return { reply, extracted };
    } catch {
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
    const updates: Record<string, string> = {};
    const newName = clean(extracted.name);
    const newLocation = clean(extracted.location);
    const newRequirement = clean(extracted.requirement);
    if (newName && !lead.name) updates.name = newName;
    if (newLocation && !lead.location) updates.location = newLocation;
    if (newRequirement) {
      updates.requirement = lead.requirement
        ? `${lead.requirement}; ${newRequirement}`
        : newRequirement;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.whatsAppLead.update({ where: { id: lead.id }, data: updates });
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
      await prisma.whatsAppSession.update({ where: { sessionId }, data: { status, ...extra } });
    } catch (err) {
      console.error(`[WhatsAppEngine][${sessionId}] DB updateStatus failed:`, err);
    }
  }

  getRuntimeSession(sessionId: string): RuntimeSession | undefined {
    return this.sessions.get(sessionId);
  }

  async listForUser(userId: string) {
    const records = await prisma.whatsAppSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => {
      const runtime = this.sessions.get(r.sessionId);
      return {
        id:           r.id,
        sessionId:    r.sessionId,
        name:         r.name,
        phone:        runtime?.phone    || r.phone,
        pushname:     runtime?.pushname || r.pushname,
        status:       runtime?.status   || r.status,
        promptId:     r.promptId     || null,
        restaurantId: r.restaurantId || null,
        lastActiveAt: r.lastActiveAt,
        lastError:    runtime?.lastError || r.lastError,
        createdAt:    r.createdAt,
      };
    });
  }

  async linkRestaurant(userId: string, sessionId: string, restaurantId: string | null): Promise<boolean> {
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!record) return false;
    await prisma.whatsAppSession.update({ where: { sessionId }, data: { restaurantId: restaurantId ?? null } });
    const runtime = this.sessions.get(sessionId);
    if (runtime) runtime.restaurantId = restaurantId;
    return true;
  }

  async getQR(userId: string, sessionId: string): Promise<{ status: WASessionStatus; qrDataUrl: string | null } | null> {
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!record) return null;
    const runtime = this.sessions.get(sessionId);
    return {
      status: (runtime?.status || record.status) as WASessionStatus,
      qrDataUrl: runtime?.qrDataUrl || null,
    };
  }

  async getStatus(userId: string, sessionId: string) {
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
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
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (runtime) {
      try { await (runtime.client as { logout: () => Promise<void> }).logout(); } catch (_) { /* ignore */ }
      try { await (runtime.client as { destroy: () => Promise<void> }).destroy(); } catch (_) { /* ignore */ }
      this.sessions.delete(sessionId);
    }
    await prisma.whatsAppSession.update({ where: { sessionId }, data: { status: 'disconnected' } });
    return true;
  }

  async destroy(userId: string, sessionId: string): Promise<boolean> {
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (runtime) {
      try { await (runtime.client as { logout: () => Promise<void> }).logout(); } catch (_) { /* ignore */ }
      try { await (runtime.client as { destroy: () => Promise<void> }).destroy(); } catch (_) { /* ignore */ }
      this.sessions.delete(sessionId);
    }
    await prisma.whatsAppSession.delete({ where: { sessionId } });
    const dir = path.join(SESSION_DATA_PATH, `session-${sessionId}`);
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[WhatsAppEngine][${sessionId}] cleanup failed:`, err);
    }
    return true;
  }

  async sendMessage(userId: string, sessionId: string, to: string, text: string): Promise<boolean> {
    const record = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!record) return false;
    const runtime = this.sessions.get(sessionId);
    if (!runtime || runtime.status !== 'connected') return false;
    const chatId = to.includes('@') ? to : `${to.replace(/[^\d]/g, '')}@c.us`;
    const isGroup = chatId.endsWith('@g.us');
    await this.sendAndLog(runtime, chatId, text, 'manual', isGroup);
    return true;
  }

  async listChats(userId: string, sessionId: string) {
    const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!session) return null;

    type ChatRow = {
      chatId: string;
      messageCount: bigint;
      inboundCount: bigint;
      lastBody: string;
      lastDirection: string;
      lastTimestamp: Date;
      lastReplyKind: string | null;
      lastHasMedia: boolean;
    };

    const chats = await prisma.$queryRaw<ChatRow[]>`
      SELECT
        "chatId",
        COUNT(*) as "messageCount",
        SUM(CASE WHEN direction = 'in' THEN 1 ELSE 0 END) as "inboundCount",
        (array_agg(body ORDER BY timestamp DESC))[1] as "lastBody",
        (array_agg(direction ORDER BY timestamp DESC))[1] as "lastDirection",
        (array_agg("replyKind" ORDER BY timestamp DESC))[1] as "lastReplyKind",
        (array_agg("hasMedia" ORDER BY timestamp DESC))[1] as "lastHasMedia",
        MAX(timestamp) as "lastTimestamp"
      FROM "WhatsAppMessage"
      WHERE "sessionId" = ${sessionId}
      GROUP BY "chatId"
      ORDER BY MAX(timestamp) DESC
      LIMIT 200
    `;

    return chats.map((c) => ({
      chatId: c.chatId,
      isGroup: typeof c.chatId === 'string' && c.chatId.endsWith('@g.us'),
      lastMessage: {
        body: c.lastBody,
        direction: c.lastDirection,
        timestamp: c.lastTimestamp,
        replyKind: c.lastReplyKind,
        hasMedia: c.lastHasMedia,
      },
      messageCount: Number(c.messageCount),
      inboundCount: Number(c.inboundCount),
    }));
  }

  async getLead(userId: string, sessionId: string, chatId: string) {
    const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!session) return null;
    return prisma.whatsAppLead.findFirst({ where: { sessionId, chatId, userId: session.userId } });
  }

  async listLeads(userId: string, opts: { sessionId?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit || 200, 500);
    const leads = await prisma.whatsAppLead.findMany({
      where: { userId, ...(opts.sessionId ? { sessionId: opts.sessionId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return leads.map((l) => ({
      id: l.id,
      sessionId: l.sessionId,
      chatId: l.chatId,
      phone: l.phone,
      name: l.name,
      location: l.location,
      requirement: l.requirement,
      turns: l.turns,
      lastInteractionAt: l.lastInteractionAt,
      createdAt: l.createdAt,
    }));
  }

  async statsForUser(userId: string) {
    const sessions = await prisma.whatsAppSession.findMany({
      where: { userId },
      select: { sessionId: true },
    });
    const sessionIds = sessions.map((s) => s.sessionId);

    if (sessionIds.length === 0) {
      return {
        sessions: 0, totalChats: 0,
        totals: { all: 0, inbound: 0, outbound: 0, ai: 0, keyword: 0, manual: 0 },
        last24h: { all: 0, inbound: 0, outbound: 0 },
        thisMonth: { all: 0, replies: 0 },
        recentChats: [],
      };
    }

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const where = { sessionId: { in: sessionIds } };

    const [total, inbound, outbound, ai, keyword, manual, last24total, last24in, last24out, monthTotal, monthReplies, distinctChatRows] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.count({ where: { ...where, direction: 'in' } }),
      prisma.whatsAppMessage.count({ where: { ...where, direction: 'out' } }),
      prisma.whatsAppMessage.count({ where: { ...where, replyKind: 'ai' } }),
      prisma.whatsAppMessage.count({ where: { ...where, replyKind: 'keyword' } }),
      prisma.whatsAppMessage.count({ where: { ...where, replyKind: 'manual' } }),
      prisma.whatsAppMessage.count({ where: { ...where, timestamp: { gte: dayAgo } } }),
      prisma.whatsAppMessage.count({ where: { ...where, direction: 'in', timestamp: { gte: dayAgo } } }),
      prisma.whatsAppMessage.count({ where: { ...where, direction: 'out', timestamp: { gte: dayAgo } } }),
      prisma.whatsAppMessage.count({ where: { ...where, timestamp: { gte: monthStart } } }),
      prisma.whatsAppMessage.count({ where: { ...where, direction: 'out', timestamp: { gte: monthStart } } }),
      prisma.whatsAppMessage.findMany({ where, select: { chatId: true }, distinct: ['chatId'] }),
    ]);

    type RecentRow = { chatId: string; lastBody: string; lastDirection: string; timestamp: Date };
    const recentChats = sessionIds.length > 0
      ? await prisma.$queryRaw<RecentRow[]>`
          SELECT DISTINCT ON ("chatId") "chatId", body as "lastBody", direction as "lastDirection", timestamp
          FROM "WhatsAppMessage"
          WHERE "sessionId" = ANY(${sessionIds}::text[])
          ORDER BY "chatId", timestamp DESC
          LIMIT 5
        `
      : [];

    return {
      sessions: sessions.length,
      totalChats: distinctChatRows.length,
      totals: { all: total, inbound, outbound, ai, keyword, manual },
      last24h: { all: last24total, inbound: last24in, outbound: last24out },
      thisMonth: { all: monthTotal, replies: monthReplies },
      recentChats: recentChats.map((c) => ({
        chatId: c.chatId,
        lastBody: c.lastBody,
        lastDirection: c.lastDirection,
        timestamp: c.timestamp,
      })),
    };
  }

  async listMessages(userId: string, sessionId: string, chatId: string, limit = 100) {
    const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
    if (!session) return null;
    const messages = await prisma.whatsAppMessage.findMany({
      where: { sessionId, chatId, userId: session.userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return [...messages].reverse().map((m) => ({
      id: m.id,
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
