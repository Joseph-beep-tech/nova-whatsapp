/**
 * /api/restaurant-ai/knowledge  — CRUD for RAG knowledge base docs
 * /api/restaurant-ai/config      — per-restaurant AI configuration
 * /api/restaurant-ai/interactions — AI interaction logs
 * /api/restaurant-ai/reservations — restaurant reservations
 */
import { Router, Request, Response } from 'express';
import { authMiddleware as authenticate } from '../middleware/auth';
import { KBDocType } from '../models/KnowledgeBase';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authenticate);

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'kb');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function chunkText(text: string, maxTokens = 400): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).split(' ').length > maxTokens) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const resp = await getOpenAI().embeddings.create({ model: 'text-embedding-3-small', input: chunks });
  return resp.data.map((d) => d.embedding);
}

async function processKBDoc(docId: string): Promise<void> {
  const doc = await prisma.knowledgeBase.findUnique({ where: { id: docId } });
  if (!doc) return;
  try {
    const chunks = chunkText(doc.rawContent);
    const embeddings = await embedChunks(chunks);
    const kbChunks = chunks.map((text, i) => ({
      chunkIndex: i, text, embedding: embeddings[i], tokens: text.split(' ').length,
    }));
    await prisma.knowledgeBase.update({
      where: { id: docId },
      data: {
        chunks: kbChunks as unknown as Prisma.InputJsonValue,
        wordCount: doc.rawContent.split(' ').length,
        status: 'active',
        vectorisedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.knowledgeBase.update({ where: { id: docId }, data: { status: 'error', errorMessage: msg } });
  }
}

// ── KNOWLEDGE BASE ─────────────────────────────────────────────────────────────

router.get('/knowledge/:restaurantId', async (req: Request, res: Response) => {
  try {
    const docs = await prisma.knowledgeBase.findMany({
      where: { restaurantId: req.params.restaurantId, status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, restaurantId: true, title: true, docType: true, status: true,
        wordCount: true, fileUrl: true, fileName: true, mimeType: true,
        errorMessage: true, vectorisedAt: true, createdBy: true, createdAt: true, updatedAt: true,
      },
    });
    res.json(docs);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/knowledge', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, title, docType, content } = req.body;
    if (!restaurantId || !title) {
      return res.status(400).json({ message: 'restaurantId and title are required' });
    }

    let rawContent = content || '';
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      fileUrl = `/uploads/kb/${req.file.filename}`;
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
      if (req.file.mimetype === 'text/plain') {
        rawContent = fs.readFileSync(req.file.path, 'utf-8');
      } else if (!rawContent) {
        rawContent = `[File: ${req.file.originalname}] - Content extraction pending.`;
      }
    }

    if (!rawContent.trim()) return res.status(400).json({ message: 'Content or file is required' });

    const doc = await prisma.knowledgeBase.create({
      data: {
        restaurantId, title,
        docType: (docType as KBDocType) || 'general',
        rawContent, fileUrl, fileName, mimeType,
        wordCount: rawContent.split(' ').length,
        status: 'processing',
        createdBy: req.userId!,
      },
    });

    processKBDoc(doc.id).catch(console.error);
    const { chunks: _c, rawContent: _r, ...rest } = doc;
    res.status(201).json(rest);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const { title, docType, rawContent } = req.body;
    const doc = await prisma.knowledgeBase.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const updateData: Prisma.KnowledgeBaseUpdateInput = {};
    if (title) updateData.title = title;
    if (docType) updateData.docType = docType;
    if (rawContent && rawContent !== doc.rawContent) {
      updateData.rawContent = rawContent;
      updateData.status = 'processing';
      updateData.chunks = [] as unknown as Prisma.InputJsonValue;
    }
    const updated = await prisma.knowledgeBase.update({ where: { id: req.params.id }, data: updateData });
    if (rawContent && rawContent !== doc.rawContent) {
      processKBDoc(updated.id).catch(console.error);
    }
    res.json(updated);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    await prisma.knowledgeBase.update({ where: { id: req.params.id }, data: { status: 'archived' } });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/knowledge/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.knowledgeBase.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await prisma.knowledgeBase.update({
      where: { id: req.params.id },
      data: { status: 'processing', errorMessage: null },
    });
    processKBDoc(req.params.id).catch(console.error);
    res.json({ message: 'Reprocessing started' });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/knowledge/query', async (req: Request, res: Response) => {
  try {
    const { restaurantId, query, topK = 5 } = req.body;
    if (!restaurantId || !query) {
      return res.status(400).json({ message: 'restaurantId and query required' });
    }
    const [queryEmbed] = await embedChunks([query]);
    const docs = await prisma.knowledgeBase.findMany({ where: { restaurantId, status: 'active' } });

    type ScoredChunk = { docId: string; title: string; docType: string; text: string; score: number };
    const scored: ScoredChunk[] = [];

    for (const doc of docs) {
      const chunks = doc.chunks as unknown as Array<{ text: string; embedding?: number[]; chunkIndex: number }>;
      for (const chunk of chunks) {
        if (!chunk.embedding || chunk.embedding.length === 0) continue;
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < queryEmbed.length; i++) {
          dot += queryEmbed[i] * chunk.embedding[i];
          magA += queryEmbed[i] ** 2;
          magB += chunk.embedding[i] ** 2;
        }
        const score = dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
        scored.push({ docId: doc.id, title: doc.title, docType: doc.docType, text: chunk.text, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    res.json({ results: scored.slice(0, topK) });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ── AI CONFIG ──────────────────────────────────────────────────────────────────

router.get('/config/:restaurantId', async (req: Request, res: Response) => {
  try {
    let config = await prisma.restaurantAIConfig.findFirst({ where: { restaurantId: req.params.restaurantId } });
    if (!config) {
      config = await prisma.restaurantAIConfig.create({ data: { restaurantId: req.params.restaurantId } });
    }
    res.json(config);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/config/:restaurantId', async (req: AuthRequest, res: Response) => {
  try {
    const { upsellRules, voiceLanguages, ...rest } = req.body;
    const config = await prisma.restaurantAIConfig.upsert({
      where: { restaurantId: req.params.restaurantId },
      update: {
        ...rest,
        updatedBy: req.userId,
        ...(upsellRules !== undefined ? { upsellRules: upsellRules as Prisma.InputJsonValue } : {}),
        ...(voiceLanguages !== undefined ? { voiceLanguages } : {}),
      },
      create: {
        restaurantId: req.params.restaurantId,
        ...rest,
        updatedBy: req.userId,
        ...(upsellRules !== undefined ? { upsellRules: upsellRules as Prisma.InputJsonValue } : {}),
        ...(voiceLanguages !== undefined ? { voiceLanguages } : {}),
      },
    });
    res.json(config);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ── AI INTERACTION LOGS ────────────────────────────────────────────────────────

router.get('/interactions/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { channel, intent, page = 1, limit = 50 } = req.query;
    const where: Prisma.AIInteractionLogWhereInput = { restaurantId: req.params.restaurantId };
    if (channel) where.channel = channel as string;
    if (intent) where.intent = intent as string;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      prisma.aIInteractionLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.aIInteractionLog.count({ where }),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/interactions/:restaurantId/stats', async (req: Request, res: Response) => {
  try {
    const rid = req.params.restaurantId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where: Prisma.AIInteractionLogWhereInput = { restaurantId: rid, createdAt: { gte: since } };

    const [total, escalated, byChannelRaw, byIntentRaw] = await Promise.all([
      prisma.aIInteractionLog.count({ where }),
      prisma.aIInteractionLog.count({ where: { ...where, escalated: true } }),
      prisma.aIInteractionLog.groupBy({ by: ['channel'], where, _count: { channel: true } }),
      prisma.aIInteractionLog.groupBy({ by: ['intent'], where, _count: { intent: true } }),
    ]);

    const byChannel = byChannelRaw.map((r) => ({ _id: r.channel, count: r._count.channel }));
    const byIntent = byIntentRaw.map((r) => ({ _id: r.intent, count: r._count.intent }));
    res.json({ total, escalated, byChannel, byIntent });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ── RESERVATIONS ───────────────────────────────────────────────────────────────

router.get('/reservations/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { status, date } = req.query;
    const where: Prisma.ReservationWhereInput = { restaurantId: req.params.restaurantId };
    if (status) where.status = status as string;
    if (date) {
      const d = new Date(date as string);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }
    const reservations = await prisma.reservation.findMany({ where, orderBy: { date: 'asc' } });
    res.json(reservations);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const { restaurantId, customerName, date, partySize, customerPhone, customerEmail, notes, tableNumber } = req.body;
    const reservation = await prisma.reservation.create({
      data: { restaurantId, customerName, date: new Date(date), partySize: Number(partySize), customerPhone, customerEmail, notes, tableNumber },
    });
    res.status(201).json(reservation);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const { restaurantId: _r, id: _i, ...data } = req.body;
    if (data.date) data.date = new Date(data.date);
    if (data.partySize) data.partySize = Number(data.partySize);
    const reservation = await prisma.reservation.update({ where: { id: req.params.id }, data });
    res.json(reservation);
  } catch (err: unknown) {
    if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      return res.status(404).json({ message: 'Not found' });
    }
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/reservations/:id', async (req: Request, res: Response) => {
  try {
    await prisma.reservation.update({ where: { id: req.params.id }, data: { status: 'cancelled' } });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

router.get('/analytics/:restaurantId/popular-items', async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rid = req.params.restaurantId;

    type PopularRow = { name: string; totalQty: bigint; totalRevenue: number };
    const results = await prisma.$queryRaw<PopularRow[]>`
      SELECT
        item->>'name' as name,
        SUM((item->>'quantity')::int) as "totalQty",
        SUM((item->>'quantity')::int * (item->>'price')::float) as "totalRevenue"
      FROM "Order" o,
        jsonb_array_elements(o.items::jsonb) as item
      WHERE o."restaurantId" = ${rid}
        AND o."createdAt" >= ${since}
        AND o.status != 'cancelled'
      GROUP BY item->>'name'
      ORDER BY "totalQty" DESC
      LIMIT 10
    `;

    res.json(results.map((r) => ({ name: r.name, totalQty: Number(r.totalQty), totalRevenue: Number(r.totalRevenue) })));
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/analytics/:restaurantId/demand', async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rid = req.params.restaurantId;

    type DemandRow = { hour: number; dayOfWeek: number; orders: bigint; revenue: number };
    const results = await prisma.$queryRaw<DemandRow[]>`
      SELECT
        EXTRACT(HOUR FROM "createdAt")::int as hour,
        EXTRACT(DOW FROM "createdAt")::int as "dayOfWeek",
        COUNT(*)::int as orders,
        COALESCE(SUM(total), 0)::float as revenue
      FROM "Order"
      WHERE "restaurantId" = ${rid}
        AND "createdAt" >= ${since}
        AND status != 'cancelled'
      GROUP BY EXTRACT(HOUR FROM "createdAt"), EXTRACT(DOW FROM "createdAt")
      ORDER BY "dayOfWeek", hour
    `;

    res.json(results.map((r) => ({ hour: Number(r.hour), dayOfWeek: Number(r.dayOfWeek), orders: Number(r.orders), revenue: Number(r.revenue) })));
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/analytics/:restaurantId/customers', async (req: Request, res: Response) => {
  try {
    const rid = req.params.restaurantId;
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    type CLVRow = { phone: string; customerName: string; orderCount: bigint; totalSpend: number; avgOrderValue: number; firstOrder: Date; lastOrder: Date };
    type NVRRow = { total: bigint; returning: bigint };

    const [clvData, newVsReturning] = await Promise.all([
      prisma.$queryRaw<CLVRow[]>`
        SELECT
          "customerPhone" as phone,
          MAX("customerName") as "customerName",
          COUNT(*) as "orderCount",
          COALESCE(SUM(total), 0)::float as "totalSpend",
          COALESCE(AVG(total), 0)::float as "avgOrderValue",
          MIN("createdAt") as "firstOrder",
          MAX("createdAt") as "lastOrder"
        FROM "Order"
        WHERE "restaurantId" = ${rid}
          AND status != 'cancelled'
          AND "customerPhone" IS NOT NULL
          AND "customerPhone" != ''
        GROUP BY "customerPhone"
        ORDER BY "totalSpend" DESC
        LIMIT 20
      `,
      prisma.$queryRaw<NVRRow[]>`
        WITH customer_orders AS (
          SELECT "customerPhone", COUNT(*) as order_count
          FROM "Order"
          WHERE "restaurantId" = ${rid}
            AND "createdAt" >= ${since30}
            AND status != 'cancelled'
          GROUP BY "customerPhone"
        )
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) as returning
        FROM customer_orders
      `,
    ]);

    const nvr = newVsReturning[0] || { total: 0n, returning: 0n };
    const total = Number(nvr.total);
    const returning = Number(nvr.returning);
    res.json({
      topCustomers: clvData.map((r) => ({
        phone: r.phone,
        customerName: r.customerName,
        orderCount: Number(r.orderCount),
        totalSpend: Number(r.totalSpend),
        avgOrderValue: Number(r.avgOrderValue),
        firstOrder: r.firstOrder,
        lastOrder: r.lastOrder,
      })),
      last30Days: {
        uniqueCustomers: total,
        returningCustomers: returning,
        newCustomers: total - returning,
        retentionRate: total > 0 ? Math.round((returning / total) * 100) : 0,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
