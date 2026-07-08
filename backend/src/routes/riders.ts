import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/riders
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await prisma.rider.findMany({ orderBy: { name: 'asc' } });
    res.json(riders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/available
router.get('/available', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await prisma.rider.findMany({ where: { status: 'available' } });
    res.json(riders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rider = await prisma.rider.findUnique({ where: { id: req.params.id } });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json(rider);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/riders  (protected)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, status, vehicleType } = req.body;
    const rider = await prisma.rider.create({
      data: {
        name: name || '',
        phone: phone || '',
        email: email || null,
        status: status || 'offline',
        vehicleType: vehicleType || 'motorcycle',
      },
    });
    res.status(201).json(rider);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/riders/:id  (protected)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, status, vehicleType } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (status !== undefined) data.status = status;
    if (vehicleType !== undefined) data.vehicleType = vehicleType;

    const rider = await prisma.rider.update({ where: { id: req.params.id }, data });
    res.json(rider);
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
    res.json(rider);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/riders/:id/location  (called by rider app)
router.patch('/:id/location', async (req: Request, res: Response) => {
  try {
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
