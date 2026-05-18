/**
 * Usage Tracking API
 *
 * Provides per-user usage metrics for billing:
 * - WhatsApp messages per day/month/total
 * - Voice session minutes per month/total
 * - Voice session count
 *
 * Auth: API key in x-api-key header.
 *
 * Routes:
 * - GET /service/usage?identifier=X&period=month
 */

import { Router, Request, Response } from 'express';
import { stateManager } from '../utils/stateManager';
import { config } from '../shared/config';

const router = Router();

// ---------------------------------------------------------------------------
// API key validation middleware
// ---------------------------------------------------------------------------

function validateApiKey(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Usage endpoint
// ---------------------------------------------------------------------------

router.get('/', validateApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = req.query.identifier as string;
    const period = (req.query.period as string) || 'month';

    if (!identifier) {
      res.status(400).json({ error: 'identifier query parameter required' });
      return;
    }

    // Fetch WA message usage
    const waUsage = (await stateManager.getConfig(`wa_usage_${identifier}`) as Record<string, unknown>) || {};

    // Fetch voice usage (tracked by spaoEventHandler)
    const voiceUsage = (await stateManager.getConfig(`spao_usage_${identifier}`) as Record<string, unknown>) || {};

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);

    let waMessages: number;
    let voiceSeconds: number;

    if (period === 'day' || period === 'today') {
      waMessages = (waUsage[`messages_${today}`] as number) || 0;
      // Voice usage doesn't track daily — use monthly
      voiceSeconds = (voiceUsage[`voiceSeconds_${monthKey}`] as number) || 0;
    } else {
      // Default: month
      waMessages = (waUsage[`messages_${monthKey}`] as number) || 0;
      voiceSeconds = (voiceUsage[`voiceSeconds_${monthKey}`] as number) || 0;
    }

    const voiceSessions = (voiceUsage.voiceSessionsTotal as number) || 0;

    res.json({
      success: true,
      identifier,
      period,
      periodKey: period === 'day' ? today : monthKey,
      usage: {
        waMessages,
        waMessagesTotal: (waUsage.messagesTotal as number) || 0,
        voiceMinutes: Math.ceil(voiceSeconds / 60),
        voiceMinutesTotal: Math.ceil(((voiceUsage.voiceTotalSeconds as number) || 0) / 60),
        voiceSessions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
