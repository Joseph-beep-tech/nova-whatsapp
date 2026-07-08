import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// Get all prompts
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prompts = await prisma.prompt.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Get single prompt
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prompt = await prisma.prompt.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// Create prompt
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, content } = req.body;

    const prompt = await prisma.prompt.create({
      data: {
        userId: req.userId!,
        name,
        content: content || '',
      },
    });

    res.status(201).json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// Update prompt
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.prompt.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Prompt not found' });

    const { name, content, isDefault } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const prompt = await prisma.prompt.update({
      where: { id: req.params?.id },
      data: updateData,
    });

    res.json(prompt);
  } catch (error) {
    console.error('[Prompts PUT]', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Delete prompt
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prompt = await prisma.prompt.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    await prisma.prompt.delete({ where: { id: req.params?.id } });
    res.json({ message: 'Prompt deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

export default router;
