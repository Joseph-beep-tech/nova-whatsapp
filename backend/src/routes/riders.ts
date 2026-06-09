import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import Rider from '../models/Rider';

const router = Router();

function toClient(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString(),
    _id: undefined,
    __v: undefined,
    currentOrderId: obj.currentOrderId?.toString(),
  };
}

// GET /api/riders
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await Rider.find({ isActive: true }).sort({ name: 1 });
    res.json(riders.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/available
router.get('/available', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const riders = await Rider.find({ status: 'available', isActive: true });
    res.json(riders.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/riders/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rider = await Rider.findById(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json(toClient(rider));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/riders  (protected)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rider = await Rider.create(req.body);
    res.status(201).json(toClient(rider));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/riders/:id  (protected)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rider = await Rider.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rider) return res.status(404).json({ message: 'Not found' });
    res.json(toClient(rider));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/riders/:id/status
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const rider = await Rider.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!rider) return res.status(404).json({ message: 'Not found' });
    res.json(toClient(rider));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/riders/:id/location  (called by rider app)
router.patch('/:id/location', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const rider = await Rider.findByIdAndUpdate(
      req.params.id,
      { currentLocation: { lat, lng } },
      { new: true }
    );
    if (!rider) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/riders/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Rider.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
