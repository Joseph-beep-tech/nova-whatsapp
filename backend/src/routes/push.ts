import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

// POST /api/push/subscribe  (admin portal — registers this browser/device for push notifications)
router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });

    await prisma.pushSubscription.upsert({
      where: { token },
      update: { userId: req.userId!, platform: platform || 'web' },
      create: { userId: req.userId!, token, platform: platform || 'web' },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/push/subscribe  (logout cleanup)
router.delete('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });
    await prisma.pushSubscription.deleteMany({ where: { token } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
