import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import VoiceCall from '../models/VoiceCall';
import { authMiddleware } from '../middleware/auth';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
  query: any;
}

const router = Router();

// GET / — list call history for the authenticated user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    const filter: any = { userId: req.userId };
    if (status && ['completed', 'failed', 'ongoing'].includes(status as string)) {
      filter.status = status;
    }

    const calls = await VoiceCall.find(filter)
      .populate('promptId', 'name')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await VoiceCall.countDocuments(filter);

    res.json({ calls, total });
  } catch (error) {
    console.error('[CallHistory GET]', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// GET /stats — call stats for dashboard
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCalls, monthCalls, totalDuration, monthDuration] = await Promise.all([
      VoiceCall.countDocuments({ userId: req.userId }),
      VoiceCall.countDocuments({ userId: req.userId, createdAt: { $gte: monthStart } }),
      VoiceCall.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
        { $group: { _id: null, total: { $sum: '$duration' } } },
      ]),
      VoiceCall.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$duration' } } },
      ]),
    ]);

    res.json({
      totalCalls,
      callsThisMonth: monthCalls,
      totalDuration: totalDuration[0]?.total || 0,
      monthDuration: monthDuration[0]?.total || 0,
    });
  } catch (error) {
    console.error('[CallHistory STATS]', error);
    res.status(500).json({ error: 'Failed to fetch call stats' });
  }
});

// POST / — create a new call record (call started)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, promptId, callSid } = req.body;

    const call = await VoiceCall.create({
      userId: req.userId,
      phoneNumber: phoneNumber || 'browser',
      promptId: promptId || undefined,
      callSid: callSid || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'ongoing',
      duration: 0,
      cost: 0,
    });

    res.status(201).json(call);
  } catch (error) {
    console.error('[CallHistory POST]', error);
    res.status(500).json({ error: 'Failed to create call record' });
  }
});

// PUT /:id — update a call record (call ended or in progress)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { duration, cost, status, transcript } = req.body;

    const call = await VoiceCall.findOne({ _id: req.params.id, userId: req.userId });
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (duration !== undefined) call.duration = duration;
    if (cost !== undefined) call.cost = cost;
    if (status) call.status = status;
    if (transcript) call.transcript = transcript;

    await call.save();
    res.json(call);
  } catch (error) {
    console.error('[CallHistory PUT]', error);
    res.status(500).json({ error: 'Failed to update call record' });
  }
});

// GET /:id — single call detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const call = await VoiceCall.findOne({ _id: req.params.id, userId: req.userId })
      .populate('promptId', 'name');

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json(call);
  } catch (error) {
    console.error('[CallHistory GET/:id]', error);
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

export default router;
