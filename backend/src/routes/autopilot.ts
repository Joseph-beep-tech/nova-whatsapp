import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
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
    const autopilot = await prisma.autopilot.findFirst({ where: { userId: req.userId } });

    if (!autopilot) {
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

    const config = (autopilot.config as Record<string, any>) || {};
    res.json({
      configured: true,
      id: autopilot.id,
      userId: autopilot.userId,
      enabled: autopilot.isEnabled,
      autoReply: config.autoReply ?? true,
      replyToGroups: config.replyToGroups ?? false,
      replyDelaySeconds: config.replyDelaySeconds ?? 5,
      keywordTriggers: config.keywordTriggers ?? [],
      excludedKeywords: config.excludedKeywords ?? [],
      businessHoursOnly: config.businessHoursOnly ?? false,
      startTime: config.startTime ?? '09:00',
      endTime: config.endTime ?? '18:00',
      timezone: config.timezone ?? 'Africa/Nairobi',
      promptId: config.promptId ?? null,
      createdAt: autopilot.createdAt,
      updatedAt: autopilot.updatedAt,
    });
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

    const existing = await prisma.autopilot.findFirst({ where: { userId: req.userId } });
    const existingConfig = (existing?.config as Record<string, any>) || {};

    const newConfig: Record<string, any> = { ...existingConfig };
    if (autoReply !== undefined) newConfig.autoReply = autoReply;
    if (replyToGroups !== undefined) newConfig.replyToGroups = replyToGroups;
    if (replyDelaySeconds !== undefined) newConfig.replyDelaySeconds = replyDelaySeconds;
    if (keywordTriggers !== undefined) newConfig.keywordTriggers = keywordTriggers;
    if (excludedKeywords !== undefined) newConfig.excludedKeywords = excludedKeywords;
    if (businessHoursOnly !== undefined) newConfig.businessHoursOnly = businessHoursOnly;
    if (startTime !== undefined) newConfig.startTime = startTime;
    if (endTime !== undefined) newConfig.endTime = endTime;
    if (timezone !== undefined) newConfig.timezone = timezone;
    if (promptId !== undefined) newConfig.promptId = promptId || null;

    const isEnabledVal = enabled !== undefined ? enabled : (existing?.isEnabled ?? false);

    let autopilot;
    if (!existing) {
      autopilot = await prisma.autopilot.create({
        data: {
          userId: req.userId!,
          isEnabled: isEnabledVal,
          config: newConfig,
        },
      });
    } else {
      autopilot = await prisma.autopilot.update({
        where: { id: existing.id },
        data: { isEnabled: isEnabledVal, config: newConfig },
      });
    }

    const config = (autopilot.config as Record<string, any>) || {};
    res.json({
      configured: true,
      id: autopilot.id,
      userId: autopilot.userId,
      enabled: autopilot.isEnabled,
      autoReply: config.autoReply ?? true,
      replyToGroups: config.replyToGroups ?? false,
      replyDelaySeconds: config.replyDelaySeconds ?? 5,
      keywordTriggers: config.keywordTriggers ?? [],
      excludedKeywords: config.excludedKeywords ?? [],
      businessHoursOnly: config.businessHoursOnly ?? false,
      startTime: config.startTime ?? '09:00',
      endTime: config.endTime ?? '18:00',
      timezone: config.timezone ?? 'Africa/Nairobi',
      promptId: config.promptId ?? null,
      createdAt: autopilot.createdAt,
      updatedAt: autopilot.updatedAt,
    });
  } catch (error) {
    console.error('[Autopilot POST]', error);
    res.status(500).json({ error: 'Failed to save autopilot settings' });
  }
});

// POST /toggle — quick enable/disable
router.post('/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const autopilot = await prisma.autopilot.findFirst({ where: { userId: req.userId } });
    if (!autopilot) {
      return res.status(400).json({ error: 'Configure autopilot settings first before toggling' });
    }

    const updated = await prisma.autopilot.update({
      where: { id: autopilot.id },
      data: { isEnabled: !autopilot.isEnabled },
    });

    res.json({
      enabled: updated.isEnabled,
      message: updated.isEnabled ? 'Autopilot enabled' : 'Autopilot disabled',
    });
  } catch (error) {
    console.error('[Autopilot TOGGLE]', error);
    res.status(500).json({ error: 'Failed to toggle autopilot' });
  }
});

export default router;
