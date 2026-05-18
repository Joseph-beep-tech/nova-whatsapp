import { Router, Request, Response } from 'express';
import Autopilot from '../models/Autopilot';
import { authMiddleware } from '../middleware/auth';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// GET — returns settings or defaults if not configured yet
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let autopilot = await Autopilot.findOne({ userId: req.userId }).populate('promptId', 'name');

    if (!autopilot) {
      // Return defaults — not saved yet
      return res.json({
        configured: false,
        enabled: false,
        autoReply: true,
        replyToGroups: false,
        replyDelaySeconds: 5,
        keywordTriggers: [],
        excludedKeywords: [],
        businessHoursOnly: false,
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Africa/Nairobi',
        promptId: null,
      });
    }

    res.json({ configured: true, ...autopilot.toObject() });
  } catch (error) {
    console.error('[Autopilot GET]', error);
    res.status(500).json({ error: 'Failed to fetch autopilot settings' });
  }
});

// POST — create or update
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      promptId,
      enabled,
      autoReply,
      replyToGroups,
      replyDelaySeconds,
      keywordTriggers,
      excludedKeywords,
      businessHoursOnly,
      startTime,
      endTime,
      timezone,
    } = req.body;

    let autopilot = await Autopilot.findOne({ userId: req.userId });

    const updates: any = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (autoReply !== undefined) updates.autoReply = autoReply;
    if (replyToGroups !== undefined) updates.replyToGroups = replyToGroups;
    if (replyDelaySeconds !== undefined) updates.replyDelaySeconds = replyDelaySeconds;
    if (keywordTriggers !== undefined) updates.keywordTriggers = keywordTriggers;
    if (excludedKeywords !== undefined) updates.excludedKeywords = excludedKeywords;
    if (businessHoursOnly !== undefined) updates.businessHoursOnly = businessHoursOnly;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (timezone !== undefined) updates.timezone = timezone;
    if (promptId !== undefined) updates.promptId = promptId || null;

    if (!autopilot) {
      autopilot = new Autopilot({ userId: req.userId, ...updates });
    } else {
      Object.assign(autopilot, updates);
    }

    await autopilot.save();

    // Re-fetch with populated prompt name
    const saved = await Autopilot.findById(autopilot._id).populate('promptId', 'name');
    res.json({ configured: true, ...saved!.toObject() });
  } catch (error) {
    console.error('[Autopilot POST]', error);
    res.status(500).json({ error: 'Failed to save autopilot settings' });
  }
});

// POST /toggle — quick enable/disable
router.post('/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const autopilot = await Autopilot.findOne({ userId: req.userId });
    if (!autopilot) {
      return res.status(400).json({ error: 'Configure autopilot settings first before toggling' });
    }

    autopilot.enabled = !autopilot.enabled;
    await autopilot.save();

    res.json({ enabled: autopilot.enabled, message: autopilot.enabled ? 'Autopilot enabled' : 'Autopilot disabled' });
  } catch (error) {
    console.error('[Autopilot TOGGLE]', error);
    res.status(500).json({ error: 'Failed to toggle autopilot' });
  }
});

export default router;
