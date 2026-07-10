/**
 * WhatsApp inbox — persistence, chat/lead queries, and AI-reply dispatch.
 *
 * Replaces the in-process runtime the old whatsapp-web.js engine used to
 * keep: baileys-api is now a separate service, so every call here re-reads
 * Postgres rather than consulting an in-memory client object.
 */

import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/credentialsCrypto';
import { novaGoHandler } from '../modules/whatsapp/novagoConversationHandler';

const WA_API_URL = (process.env.WHATSAPP_API_URL || '').replace(/\/$/, '');

type ReplyKind = 'ai' | 'keyword' | 'manual' | null;

export interface PersistMessageInput {
  userId: string | null;
  sessionId: string;
  chatId: string;
  isGroup: boolean;
  fromMe: boolean;
  direction: 'in' | 'out';
  author: string | null;
  body: string;
  hasMedia: boolean;
  messageId: string | null;
  replyKind: ReplyKind;
  timestamp: Date;
}

export async function persistMessage(data: PersistMessageInput): Promise<void> {
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
    console.error(`[whatsappInbox][${data.sessionId}] persist message failed:`, err);
  }
}

export async function sendViaBaileys(sessionId: string, chatId: string, text: string): Promise<boolean> {
  if (!WA_API_URL) return false;
  try {
    const resp = await fetch(`${WA_API_URL}/client/sendMessage/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.WHATSAPP_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, contentType: 'string', content: text }),
    });
    return resp.ok;
  } catch (err) {
    console.error(`[whatsappInbox][${sessionId}] send failed:`, err);
    return false;
  }
}

export async function sendAndLog(args: {
  userId: string | null;
  sessionId: string;
  chatId: string;
  text: string;
  replyKind: 'ai' | 'manual';
  isGroup: boolean;
}): Promise<boolean> {
  const ok = await sendViaBaileys(args.sessionId, args.chatId, args.text);
  if (!ok) return false;
  await persistMessage({
    userId: args.userId,
    sessionId: args.sessionId,
    chatId: args.chatId,
    isGroup: args.isGroup,
    fromMe: true,
    direction: 'out',
    author: null,
    body: args.text,
    hasMedia: false,
    messageId: null,
    replyKind: args.replyKind,
    timestamp: new Date(),
  });
  return true;
}

export async function isAiPaused(sessionId: string, chatId: string): Promise<boolean> {
  const state = await prisma.whatsAppChatState.findUnique({
    where: { sessionId_chatId: { sessionId, chatId } },
  });
  return !!state?.aiPaused;
}

export async function setAiPaused(sessionId: string, chatId: string, paused: boolean): Promise<void> {
  await prisma.whatsAppChatState.upsert({
    where: { sessionId_chatId: { sessionId, chatId } },
    create: { sessionId, chatId, aiPaused: paused },
    update: { aiPaused: paused },
  });
}

export async function getOrCreateLead(userId: string | null, sessionId: string, chatId: string) {
  const phone = chatId.endsWith('@s.whatsapp.net') ? chatId.replace('@s.whatsapp.net', '') : null;
  let lead = await prisma.whatsAppLead.findFirst({ where: { sessionId, chatId } });
  if (!lead) {
    lead = await prisma.whatsAppLead.create({
      data: { userId, sessionId, chatId, phone, source: 'whatsapp' },
    });
  } else if (!lead.phone && phone) {
    lead = await prisma.whatsAppLead.update({ where: { id: lead.id }, data: { phone } });
  }
  return lead;
}

export async function respondAsRestaurantAI(args: {
  userId: string;
  sessionId: string;
  restaurantId: string;
  chatId: string;
  body: string;
  isGroup: boolean;
}): Promise<void> {
  const { userId, sessionId, restaurantId, chatId, body, isGroup } = args;

  try {
    const creds = await prisma.aICredentials.findFirst({ where: { userId } });
    // No route in this codebase currently writes a per-user AICredentials.openaiApiKey,
    // so that table is empty in practice — fall back to the platform-wide key every
    // other AI feature here already relies on, rather than silently never replying.
    const apiKey = creds?.openaiApiKey ? decrypt(creds.openaiApiKey) : (process.env.OPENAI_API_KEY || '');
    if (!apiKey) {
      console.warn(`[whatsappInbox][${sessionId}] no OpenAI key available for user ${userId}`);
      return;
    }

    const lead = await getOrCreateLead(userId, sessionId, chatId);

    const history = await prisma.whatsAppMessage.findMany({
      where: { sessionId, chatId },
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

    const customerPhone = chatId.endsWith('@s.whatsapp.net') ? chatId.replace('@s.whatsapp.net', '') : chatId;

    const reply = await novaGoHandler.handleMessage({
      restaurantId,
      sessionId,
      chatId,
      customerPhone,
      messageBody: body,
      apiKey,
      priorHistory,
    });

    if (reply) {
      await sendAndLog({ userId, sessionId, chatId, text: reply, replyKind: 'ai', isGroup });
      await prisma.whatsAppLead.update({
        where: { id: lead.id },
        data: { turns: { increment: 1 }, lastInteractionAt: new Date() },
      }).catch(() => {});
    }
  } catch (err) {
    console.error(`[whatsappInbox][${sessionId}] NovaGo handler error:`, err);
  }
}

export async function listChats(userId: string, sessionId: string) {
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

  const chatIds = chats.map((c) => c.chatId);
  const states = chatIds.length
    ? await prisma.whatsAppChatState.findMany({ where: { sessionId, chatId: { in: chatIds } } })
    : [];
  const pausedByChat = new Map(states.map((s) => [s.chatId, s.aiPaused]));

  return chats.map((c) => ({
    chatId: c.chatId,
    isGroup: typeof c.chatId === 'string' && c.chatId.endsWith('@g.us'),
    aiPaused: pausedByChat.get(c.chatId) || false,
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

export async function listMessages(userId: string, sessionId: string, chatId: string, limit = 100) {
  const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
  if (!session) return null;
  const messages = await prisma.whatsAppMessage.findMany({
    where: { sessionId, chatId },
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

export async function getLead(userId: string, sessionId: string, chatId: string) {
  const session = await prisma.whatsAppSession.findFirst({ where: { sessionId, userId } });
  if (!session) return null;
  return prisma.whatsAppLead.findFirst({ where: { sessionId, chatId } });
}

export async function listLeads(userId: string, opts: { sessionId?: string; limit?: number } = {}) {
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
