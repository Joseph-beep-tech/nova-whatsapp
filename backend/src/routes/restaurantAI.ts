/**
 * /api/restaurant-ai/knowledge  — CRUD for RAG knowledge base docs
 * /api/restaurant-ai/config      — per-restaurant AI configuration
 * /api/restaurant-ai/interactions — AI interaction logs
 * /api/restaurant-ai/reservations — restaurant reservations
 */
import { Router, Request, Response } from 'express';
import { authMiddleware as authenticate } from '../middleware/auth';
import KnowledgeBase, { KBDocType } from '../models/KnowledgeBase';
import RestaurantAIConfig from '../models/RestaurantAIConfig';
import AIInteractionLog from '../models/AIInteractionLog';
import Reservation from '../models/Reservation';
import OpenAI from 'openai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// Lazy singleton — instantiated on first use so dotenv has already run
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

// ── File upload setup ─────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'kb');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  const resp = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });
  return resp.data.map((d) => d.embedding);
}

async function processKBDoc(docId: string): Promise<void> {
  const doc = await KnowledgeBase.findById(docId);
  if (!doc) return;
  try {
    const chunks = chunkText(doc.rawContent);
    const embeddings = await embedChunks(chunks);
    doc.chunks = chunks.map((text, i) => ({
      chunkIndex: i,
      text,
      embedding: embeddings[i],
      tokens: text.split(' ').length,
    }));
    doc.wordCount = doc.rawContent.split(' ').length;
    doc.status = 'active';
    doc.vectorisedAt = new Date();
    await doc.save();
  } catch (err: any) {
    doc.status = 'error';
    doc.errorMessage = err.message;
    await doc.save();
  }
}

// ── KNOWLEDGE BASE ────────────────────────────────────────────────────────────

// GET /api/restaurant-ai/knowledge/:restaurantId
router.get('/knowledge/:restaurantId', async (req: Request, res: Response) => {
  try {
    const docs = await KnowledgeBase.find({
      restaurantId: req.params.restaurantId,
      status: { $ne: 'archived' },
    }).select('-chunks').sort({ createdAt: -1 });
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurant-ai/knowledge  — create from raw text or file
router.post('/knowledge', upload.single('file'), async (req: Request, res: Response) => {
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
      // If text/plain just read it; for PDF in production you'd call a parser
      if (req.file.mimetype === 'text/plain') {
        rawContent = fs.readFileSync(req.file.path, 'utf-8');
      } else if (!rawContent) {
        rawContent = `[File: ${req.file.originalname}] - Content extraction pending.`;
      }
    }

    if (!rawContent.trim()) {
      return res.status(400).json({ message: 'Content or file is required' });
    }

    const doc = await KnowledgeBase.create({
      restaurantId,
      title,
      docType: (docType as KBDocType) || 'general',
      rawContent,
      fileUrl,
      fileName,
      mimeType,
      wordCount: rawContent.split(' ').length,
      status: 'processing',
      createdBy: (req as any).user._id,
    });

    // Process async (embed in background)
    processKBDoc(doc._id.toString()).catch(console.error);

    res.status(201).json({ ...doc.toObject(), chunks: undefined });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/restaurant-ai/knowledge/:id
router.put('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const { title, docType, rawContent } = req.body;
    const doc = await KnowledgeBase.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (title) doc.title = title;
    if (docType) doc.docType = docType;
    if (rawContent && rawContent !== doc.rawContent) {
      doc.rawContent = rawContent;
      doc.status = 'processing';
      doc.chunks = [];
      await doc.save();
      processKBDoc(doc._id.toString()).catch(console.error);
    } else {
      await doc.save();
    }
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/restaurant-ai/knowledge/:id
router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    await KnowledgeBase.findByIdAndUpdate(req.params.id, { status: 'archived' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurant-ai/knowledge/:id/reprocess
router.post('/knowledge/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const doc = await KnowledgeBase.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    doc.status = 'processing';
    doc.errorMessage = undefined;
    await doc.save();
    processKBDoc(doc._id.toString()).catch(console.error);
    res.json({ message: 'Reprocessing started' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurant-ai/knowledge/query — RAG search (test endpoint)
router.post('/knowledge/query', async (req: Request, res: Response) => {
  try {
    const { restaurantId, query, topK = 5 } = req.body;
    if (!restaurantId || !query) {
      return res.status(400).json({ message: 'restaurantId and query required' });
    }
    const [queryEmbed] = await embedChunks([query]);
    const docs = await KnowledgeBase.find({ restaurantId, status: 'active' });

    type ScoredChunk = { docId: string; title: string; docType: string; text: string; score: number };
    const scored: ScoredChunk[] = [];

    for (const doc of docs) {
      // Pull embeddings (excluded by default)
      const fullDoc = await KnowledgeBase.findById(doc._id);
      if (!fullDoc) continue;
      for (const chunk of fullDoc.chunks) {
        if (!chunk.embedding || chunk.embedding.length === 0) continue;
        // cosine similarity
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < queryEmbed.length; i++) {
          dot += queryEmbed[i] * chunk.embedding[i];
          magA += queryEmbed[i] ** 2;
          magB += chunk.embedding[i] ** 2;
        }
        const score = dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
        scored.push({ docId: String(doc._id), title: doc.title, docType: doc.docType, text: chunk.text, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    res.json({ results: scored.slice(0, topK) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── AI CONFIG ──────────────────────────────────────────────────────────────────

// GET /api/restaurant-ai/config/:restaurantId
router.get('/config/:restaurantId', async (req: Request, res: Response) => {
  try {
    let config = await RestaurantAIConfig.findOne({ restaurantId: req.params.restaurantId });
    if (!config) {
      config = await RestaurantAIConfig.create({
        restaurantId: req.params.restaurantId,
      });
    }
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/restaurant-ai/config/:restaurantId
router.put('/config/:restaurantId', async (req: Request, res: Response) => {
  try {
    const config = await RestaurantAIConfig.findOneAndUpdate(
      { restaurantId: req.params.restaurantId },
      { ...req.body, updatedBy: (req as any).user._id },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── AI INTERACTION LOGS ────────────────────────────────────────────────────────

// GET /api/restaurant-ai/interactions/:restaurantId
router.get('/interactions/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { channel, intent, page = 1, limit = 50 } = req.query;
    const filter: Record<string, any> = { restaurantId: req.params.restaurantId };
    if (channel) filter.channel = channel;
    if (intent) filter.intent = intent;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AIInteractionLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AIInteractionLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/restaurant-ai/interactions/:restaurantId/stats
router.get('/interactions/:restaurantId/stats', async (req: Request, res: Response) => {
  try {
    const rid = req.params.restaurantId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, escalated, byChannel, byIntent] = await Promise.all([
      AIInteractionLog.countDocuments({ restaurantId: rid, createdAt: { $gte: since } }),
      AIInteractionLog.countDocuments({ restaurantId: rid, wasEscalated: true, createdAt: { $gte: since } }),
      AIInteractionLog.aggregate([
        { $match: { restaurantId: new (require('mongoose').Types.ObjectId)(rid), createdAt: { $gte: since } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      AIInteractionLog.aggregate([
        { $match: { restaurantId: new (require('mongoose').Types.ObjectId)(rid), createdAt: { $gte: since } } },
        { $group: { _id: '$intent', count: { $sum: 1 } } },
      ]),
    ]);
    res.json({ total, escalated, byChannel, byIntent });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── RESERVATIONS ───────────────────────────────────────────────────────────────

// GET /api/restaurant-ai/reservations/:restaurantId
router.get('/reservations/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { status, date } = req.query;
    const filter: Record<string, any> = { restaurantId: req.params.restaurantId };
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date as string);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }
    const reservations = await Reservation.find(filter).sort({ date: 1, timeSlot: 1 });
    res.json(reservations);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurant-ai/reservations
router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const reservation = await Reservation.create(req.body);
    res.status(201).json(reservation);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/restaurant-ai/reservations/:id
router.put('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reservation) return res.status(404).json({ message: 'Not found' });
    res.json(reservation);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/restaurant-ai/reservations/:id
router.delete('/reservations/:id', async (req: Request, res: Response) => {
  try {
    await Reservation.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
