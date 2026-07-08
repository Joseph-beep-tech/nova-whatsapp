import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { getVoiceWebhookUrl, getTwimlBridgeUrl, isPublicBaseUrlConfigured } from '../utils/publicUrl';
import { twilioService, TwilioNotConfiguredError } from '../services/twilioService';
import { decrypt } from '../utils/credentialsCrypto';
import fs from 'fs';
import path from 'path';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// Helper to read stored credentials from file
function getStoredCredentials(userId: string): Record<string, string> {
  const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'credentials');
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fp = path.join(DATA_DIR, `${safe}.json`);
  if (fs.existsSync(fp)) {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  }
  return {};
}

async function generateConfig(phoneNumber: string, userId: string) {
  let projectSlug = '';
  try {
    const storedCreds = getStoredCredentials(userId);
    const rawKey = storedCreds.openaiProjectId || '';
    if (rawKey) {
      projectSlug = rawKey.startsWith('proj_') ? rawKey : `proj_${rawKey}`;
    }
  } catch (_) { /* ignore */ }

  if (!projectSlug) {
    const hash = crypto.createHash('md5').update(`${userId}-${phoneNumber}-${Date.now()}`).digest('hex');
    projectSlug = `proj_${hash.slice(0, 20)}`;
  }

  return {
    sipUri: `sip:${projectSlug}@sip.api.openai.com;transport=tls`,
    webhookUrl: getVoiceWebhookUrl(userId),
  };
}

// Get all phone numbers for the user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(phoneNumbers);
  } catch (error) {
    console.error('[PhoneNumbers GET]', error);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

// Request a new phone number
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, label } = req.body;

    if (!phoneNumber || !label) {
      return res.status(400).json({ error: 'Phone number and label are required' });
    }

    const newPhoneNumber = await prisma.phoneNumber.create({
      data: {
        userId: req.userId!,
        number: phoneNumber,
        label,
        isActive: false,
      },
    });

    res.status(201).json(newPhoneNumber);
  } catch (error) {
    console.error('[PhoneNumbers POST]', error);
    res.status(500).json({ error: 'Failed to create phone number request' });
  }
});

// Update phone number assignment
router.post('/assign/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Phone number not found' });

    const { isActive } = req.body;
    const update: any = {};
    if (isActive !== undefined) update.isActive = !!isActive;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    const phoneNumber = await prisma.phoneNumber.update({
      where: { id: req.params?.id },
      data: update,
    });

    res.json(phoneNumber);
  } catch (error) {
    console.error('[PhoneNumbers ASSIGN]', error);
    res.status(500).json({ error: 'Failed to update phone number' });
  }
});

// Status check
router.get('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!phone) return res.status(404).json({ error: 'not_found' });

    const checks = {
      isActive: phone.isActive,
      hasWebhookUrl: isPublicBaseUrlConfigured(),
      hasSipUri: true,
      publicBaseUrlConfigured: isPublicBaseUrlConfigured(),
    };
    const ready = checks.isActive && checks.publicBaseUrlConfigured;

    res.json({
      ready,
      checks,
      webhookUrl: getVoiceWebhookUrl(phone.userId),
      sipUri: null,
      twimlUrl: getTwimlBridgeUrl(phone.id),
      promptName: null,
    });
  } catch (err) {
    console.error('[PhoneNumbers STATUS]', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Re-generate config (no-op in simplified schema, returns current record)
router.post('/:id/refresh-config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!phone) return res.status(404).json({ error: 'not_found' });
    res.json(phone);
  } catch (err) {
    console.error('[PhoneNumbers REFRESH]', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Twilio: report whether the user has configured Twilio credentials
router.get('/twilio/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await twilioService.hasCredentials(req.userId!);
    res.json({ configured: ok });
  } catch (err) {
    res.json({ configured: false });
  }
});

// Twilio: search available numbers
router.post('/twilio/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { country, areaCode, contains, type } = req.body || {};
    const numbers = await twilioService.searchAvailable(req.userId!, {
      country: country || 'US',
      areaCode,
      contains,
      type,
    });
    res.json(numbers);
  } catch (err: any) {
    if (err instanceof TwilioNotConfiguredError) {
      return res.status(412).json({
        error: 'twilio_not_configured',
        message: 'Save your Twilio Account SID + Auth Token in AI Credentials first.',
      });
    }
    console.error('[twilio/search]', err);
    res.status(500).json({ error: 'twilio_search_failed', message: err.message });
  }
});

// Twilio: purchase a number
router.post('/twilio/purchase', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, label } = req.body || {};
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

    const localConfig = await generateConfig(phoneNumber, req.userId!);

    const draft = await prisma.phoneNumber.create({
      data: {
        userId: req.userId!,
        number: phoneNumber,
        label: label || `Twilio ${phoneNumber}`,
        isActive: false,
      },
    });

    try {
      const twimlUrl = getTwimlBridgeUrl(draft.id);
      const statusUrl = `${getVoiceWebhookUrl(req.userId!).replace(/\/webhook\/.*/, '')}/status/${draft.id}`;
      const purchased = await twilioService.purchase(req.userId!, {
        phoneNumber,
        voiceUrl: twimlUrl,
        statusCallback: statusUrl,
        friendlyName: label || `Nova ${phoneNumber}`,
      });

      const updated = await prisma.phoneNumber.update({
        where: { id: draft.id },
        data: { isActive: true },
      });

      res.status(201).json({
        ok: true,
        twilio: purchased,
        phoneNumber: updated,
      });
    } catch (twilioErr: any) {
      await prisma.phoneNumber.delete({ where: { id: draft.id } });
      throw twilioErr;
    }
  } catch (err: any) {
    if (err instanceof TwilioNotConfiguredError) {
      return res.status(412).json({
        error: 'twilio_not_configured',
        message: 'Save your Twilio Account SID + Auth Token in AI Credentials first.',
      });
    }
    console.error('[twilio/purchase]', err);
    res.status(500).json({ error: 'twilio_purchase_failed', message: err.message });
  }
});

// Twilio: list numbers already owned
router.get('/twilio/owned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const owned = await twilioService.listOwned(req.userId!);
    res.json(owned);
  } catch (err: any) {
    if (err instanceof TwilioNotConfiguredError) return res.status(412).json({ error: 'twilio_not_configured' });
    console.error('[twilio/owned]', err);
    res.status(500).json({ error: 'twilio_list_failed', message: err.message });
  }
});

// Twilio: sync config
router.post('/:id/twilio-sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });
    if (!phone) return res.status(404).json({ error: 'not_found' });
    const twimlUrl = getTwimlBridgeUrl(phone.id);
    const statusUrl = `${getVoiceWebhookUrl(req.userId!).replace(/\/webhook\/.*/, '')}/status/${phone.id}`;
    const updated = await twilioService.syncConfig(req.userId!, phone.number, twimlUrl, statusUrl);
    if (!updated) return res.status(404).json({ error: 'not_owned_on_twilio' });
    res.json({ ok: true, twilio: updated });
  } catch (err: any) {
    if (err instanceof TwilioNotConfiguredError) return res.status(412).json({ error: 'twilio_not_configured' });
    console.error('[twilio-sync]', err);
    res.status(500).json({ error: 'twilio_sync_failed', message: err.message });
  }
});

// Delete a phone number
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: req.params?.id, userId: req.userId },
    });

    if (!phone) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    await prisma.phoneNumber.delete({ where: { id: req.params?.id } });
    res.json({ message: 'Phone number deleted' });
  } catch (error) {
    console.error('[PhoneNumbers DELETE]', error);
    res.status(500).json({ error: 'Failed to delete phone number' });
  }
});

export default router;
