import { Router, Request, Response } from 'express';
import Prompt from '../models/Prompt';
import PhoneNumber from '../models/PhoneNumber';
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
    const prompts = await Prompt.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Get single prompt
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prompt = await Prompt.findOne({ _id: req.params?.id, userId: req.userId });
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
    const { name, description, content, phoneNumber } = req.body;

    const prompt = new Prompt({
      userId: req.userId,
      name,
      description,
      content,
      phoneNumber,
    });

    await prompt.save();
    res.status(201).json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// Update prompt. If phoneNumber changes, mirror the binding into the matching
// PhoneNumber.promptId so the Phone Numbers page agrees.
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const before = await Prompt.findOne({ _id: req.params?.id, userId: req.userId });
    if (!before) return res.status(404).json({ error: 'Prompt not found' });

    const prompt = await Prompt.findOneAndUpdate(
      { _id: req.params?.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    // Sync assignment: if the prompt's phoneNumber field changed, update the
    // PhoneNumber.promptId on both the new and old numbers.
    if ('phoneNumber' in (req.body || {})) {
      const newNumber = (req.body.phoneNumber || '').toString();
      const oldNumber = (before.phoneNumber || '').toString();
      if (oldNumber && oldNumber !== newNumber) {
        // Detach prompt from old number
        await PhoneNumber.updateOne(
          { userId: req.userId, phoneNumber: oldNumber, promptId: prompt._id },
          { $set: { promptId: null, status: 'unassigned' } }
        );
      }
      if (newNumber) {
        // Detach any other prompt currently bound to the new number, then attach this one
        const target = await PhoneNumber.findOne({ userId: req.userId, phoneNumber: newNumber });
        if (target) {
          if (target.promptId && String(target.promptId) !== String(prompt._id)) {
            await Prompt.updateOne(
              { _id: target.promptId, userId: req.userId },
              { $set: { phoneNumber: '', status: 'draft' } }
            );
          }
          target.promptId = prompt._id as any;
          target.status = 'assigned';
          await target.save();
        }
      }
    }

    res.json(prompt);
  } catch (error) {
    console.error('[Prompts PUT]', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Delete prompt
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prompt = await Prompt.findOneAndDelete({
      _id: req.params?.id,
      userId: req.userId,
    });

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ message: 'Prompt deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

export default router;
