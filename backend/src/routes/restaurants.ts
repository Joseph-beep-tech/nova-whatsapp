import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import Restaurant from '../models/Restaurant';
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
function toClient(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, id: obj._id?.toString(), _id: undefined, __v: undefined };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/restaurants
router.get('/', async (_req: Request, res: Response) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });
    res.json(restaurants.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/restaurants/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(toClient(r));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/restaurants  (protected)
router.post('/', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/restaurants/${req.file.filename}`;
    if (typeof data.features === 'string') {
      try { data.features = JSON.parse(data.features); } catch { data.features = []; }
    }
    if (typeof data.location === 'string') {
      try { data.location = JSON.parse(data.location); } catch { delete data.location; }
    }
    const restaurant = await Restaurant.create(data);
    res.status(201).json(toClient(restaurant));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/restaurants/:id  (protected)
router.put('/:id', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/restaurants/${req.file.filename}`;
    if (typeof data.features === 'string') {
      try { data.features = JSON.parse(data.features); } catch { data.features = []; }
    }
    // Coerce numeric strings
    ['deliveryFee','deliveryTimeMinutesMin','deliveryTimeMinutesMax','minOrder','rating','reviewCount'].forEach((k) => {
      if (data[k] !== undefined) data[k] = Number(data[k]);
    });
    if (data.isOpen !== undefined) data.isOpen = String(data.isOpen) === 'true';
    if (data.isPromoted !== undefined) data.isPromoted = String(data.isPromoted) === 'true';

    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(toClient(restaurant));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/restaurants/:id/toggle  — quick open/close toggle (protected)
router.patch('/:id/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    r.isOpen = !r.isOpen;
    await r.save();
    res.json(toClient(r));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/restaurants/:id  (protected)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const r = await Restaurant.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    // Clean up image
    if (r.imageUrl) {
      const imgPath = path.join(process.cwd(), r.imageUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Serve uploaded images statically (registered in index.ts)
export default router;
