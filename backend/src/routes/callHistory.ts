import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
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

    const where: any = { userId: req.userId };
    if (status && ['completed', 'failed', 'ongoing'].includes(status as string)) {
      where.status = status;
    }

    const calls = await prisma.voiceCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: Number(offset),
      take: Number(limit),
    });

    const total = await prisma.voiceCall.count({ where });

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

    const [totalCalls, monthCalls] = await Promise.all([
      prisma.voiceCall.count({ where: { userId: req.userId } }),
      prisma.voiceCall.count({ where: { userId: req.userId, createdAt: { gte: monthStart } } }),
    ]);

    // Aggregate duration with raw SQL
    const durationResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM(duration), 0)::bigint as total
      FROM "VoiceCall"
      WHERE "userId" = ${req.userId}
    `;

    const monthDurationResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM(duration), 0)::bigint as total
      FROM "VoiceCall"
      WHERE "userId" = ${req.userId}
        AND "createdAt" >= ${monthStart}
    `;

    res.json({
      totalCalls,
      callsThisMonth: monthCalls,
      totalDuration: Number(durationResult[0]?.total ?? 0),
      monthDuration: Number(monthDurationResult[0]?.total ?? 0),
    });
  } catch (error) {
    console.error('[CallHistory STATS]', error);
    res.status(500).json({ error: 'Failed to fetch call stats' });
  }
});

// POST / — create a new call record (call started)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, callSid } = req.body;

    const call = await prisma.voiceCall.create({
      data: {
        userId: req.userId,
        from: phoneNumber || 'browser',
        to: 'local',
        status: 'ongoing',
        duration: 0,
      },
    });

    res.status(201).json(call);
  } catch (error) {
    console.error('[CallHistory POST]', error);
    res.status(500).json({ error: 'Failed to create call record' });
  }
});

// PUT /:id — update a call record
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { duration, status } = req.body;

    const call = await prisma.voiceCall.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const updateData: any = {};
    if (duration !== undefined) updateData.duration = duration;
    if (status) updateData.status = status;

    const updated = await prisma.voiceCall.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(updated);
  } catch (error) {
    console.error('[CallHistory PUT]', error);
    res.status(500).json({ error: 'Failed to update call record' });
  }
});

// GET /:id — single call detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const call = await prisma.voiceCall.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

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
