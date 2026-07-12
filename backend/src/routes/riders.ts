import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

function sanitize<T extends { password?: string | null }>(rider: T): Omit<T, 'password'> {
  const { password, ...rest } = rider;
  return rest;
}

// GET /api/riders
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await prisma.rider.findMany({ orderBy: { name: 'asc' } });
    res.json(riders.map(sanitize));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/available
router.get('/available', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await prisma.rider.findMany({ where: { status: 'available' } });
    res.json(riders.map(sanitize));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/riders/login  (public — used by the rider mobile app)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const rider = await prisma.rider.findFirst({ where: { phone } });
    if (!rider || !rider.password) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const match = await bcrypt.compare(password, rider.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const token = jwt.sign(
      { userId: rider.id, role: 'rider' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({ token, rider: sanitize(rider) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/me  (rider app — "who am I")
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rider = await prisma.rider.findUnique({ where: { id: req.userId } });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json(sanitize(rider));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rider = await prisma.rider.findUnique({ where: { id: req.params.id } });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json(sanitize(rider));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/riders  (protected — admin onboarding a new rider)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, status, vehicleType, password } = req.body;
    const rider = await prisma.rider.create({
      data: {
        name: name || '',
        phone: phone || '',
        email: email || null,
        status: status || 'offline',
        vehicleType: vehicleType || 'motorcycle',
        password: password ? await bcrypt.hash(password, 10) : null,
      },
    });
    res.status(201).json(sanitize(rider));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/riders/:id  (protected)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, status, vehicleType, password } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (status !== undefined) data.status = status;
    if (vehicleType !== undefined) data.vehicleType = vehicleType;
    if (password) data.password = await bcrypt.hash(password, 10);

    const rider = await prisma.rider.update({ where: { id: req.params.id }, data });
    res.json(sanitize(rider));
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/riders/:id/status
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const rider = await prisma.rider.update({ where: { id: req.params.id }, data: { status } });
    res.json(sanitize(rider));
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/riders/:id/location  (called by the rider app — must be the rider themself)
router.patch('/:id/location', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId !== req.params.id) {
      return res.status(403).json({ message: 'Cannot update another rider\'s location' });
    }
    const { lat, lng } = req.body;
    await prisma.rider.update({
      where: { id: req.params.id },
      data: { currentLat: Number(lat), currentLng: Number(lng) },
    });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/riders/:id — hard delete (schema has no isActive)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.rider.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
});

export default router;
