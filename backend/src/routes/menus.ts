import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import MenuItem from '../models/MenuItem';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'menu');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `menu-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

function toClient(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, id: obj._id?.toString(), _id: undefined, __v: undefined };
}

// GET /api/menus/restaurant/:restaurantId
router.get('/restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const items = await MenuItem.find({ restaurantId: req.params.restaurantId })
      .sort({ sortOrder: 1, createdAt: 1 });
    res.json(items.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/menus/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(toClient(item));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/menus  (protected)
router.post('/', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/menu/${req.file.filename}`;
    if (typeof data.allergens === 'string') {
      try { data.allergens = JSON.parse(data.allergens); } catch { data.allergens = []; }
    }
    ['price','prepTimeMinutes','sortOrder','calories'].forEach((k) => {
      if (data[k] !== undefined) data[k] = Number(data[k]);
    });
    ['isAvailable','isVegetarian','isFeatured'].forEach((k) => {
      if (data[k] !== undefined) data[k] = String(data[k]) === 'true';
    });
    const item = await MenuItem.create(data);
    res.status(201).json(toClient(item));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/menus/:id  (protected)
router.put('/:id', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/menu/${req.file.filename}`;
    if (typeof data.allergens === 'string') {
      try { data.allergens = JSON.parse(data.allergens); } catch {}
    }
    ['price','prepTimeMinutes','sortOrder','calories'].forEach((k) => {
      if (data[k] !== undefined) data[k] = Number(data[k]);
    });
    ['isAvailable','isVegetarian','isFeatured'].forEach((k) => {
      if (data[k] !== undefined) data[k] = String(data[k]) === 'true';
    });
    const item = await MenuItem.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(toClient(item));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/menus/:id/availability
router.patch('/:id/availability', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { isAvailable } = req.body;
    const item = await MenuItem.findByIdAndUpdate(req.params.id, { isAvailable }, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(toClient(item));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/menus/:id  (protected)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.imageUrl) {
      const p = path.join(process.cwd(), item.imageUrl);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
