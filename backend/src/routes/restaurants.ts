import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Image upload ──────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'restaurants');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `restaurant-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toClient(r: any) {
  return {
    ...r,
    id: r.id,
    // Expose location as nested object for backward compat
    location: r.locationLat != null && r.locationLng != null
      ? { lat: r.locationLat, lng: r.locationLng }
      : undefined,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/restaurants
router.get('/', async (_req: Request, res: Response) => {
  try {
    const restaurants = await prisma.restaurant.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(restaurants.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/restaurants/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(toClient(r));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurants  (protected)
router.post('/', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/restaurants/${req.file.filename}`;

    if (typeof data.features === 'string') {
      try { data.features = JSON.parse(data.features); } catch { data.features = []; }
    }

    // Flatten location
    if (typeof data.location === 'string') {
      try {
        const loc = JSON.parse(data.location);
        data.locationLat = loc.lat;
        data.locationLng = loc.lng;
      } catch { /* ignore */ }
      delete data.location;
    }

    // Coerce numerics
    ['deliveryFee', 'deliveryTimeMinutesMin', 'deliveryTimeMinutesMax', 'minOrder', 'rating', 'reviewCount'].forEach((k) => {
      if (data[k] !== undefined) data[k] = Number(data[k]);
    });
    if (data.isOpen !== undefined) data.isOpen = String(data.isOpen) === 'true';
    if (data.isPromoted !== undefined) data.isPromoted = String(data.isPromoted) === 'true';

    const restaurant = await prisma.restaurant.create({ data });
    res.status(201).json(toClient(restaurant));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/restaurants/:id  (protected)
router.put('/:id', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/restaurants/${req.file.filename}`;

    if (typeof data.features === 'string') {
      try { data.features = JSON.parse(data.features); } catch { data.features = []; }
    }

    // Flatten location
    if (typeof data.location === 'string') {
      try {
        const loc = JSON.parse(data.location);
        data.locationLat = loc.lat;
        data.locationLng = loc.lng;
      } catch { /* ignore */ }
      delete data.location;
    }

    ['deliveryFee', 'deliveryTimeMinutesMin', 'deliveryTimeMinutesMax', 'minOrder', 'rating', 'reviewCount'].forEach((k) => {
      if (data[k] !== undefined) data[k] = Number(data[k]);
    });
    if (data.isOpen !== undefined) data.isOpen = String(data.isOpen) === 'true';
    if (data.isPromoted !== undefined) data.isPromoted = String(data.isPromoted) === 'true';

    // Remove undefined fields
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data,
    });
    res.json(toClient(restaurant));
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Restaurant not found' });
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/restaurants/:id/toggle  — quick open/close toggle (protected)
router.patch('/:id/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ message: 'Not found' });
    const updated = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { isOpen: !r.isOpen },
    });
    res.json(toClient(updated));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/restaurants/:id  (protected)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ message: 'Not found' });

    await prisma.restaurant.delete({ where: { id: req.params.id } });

    if (r.imageUrl) {
      const imgPath = path.join(process.cwd(), r.imageUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
