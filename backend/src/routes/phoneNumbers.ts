import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import PhoneNumber from '../models/PhoneNumber';
import Prompt from '../models/Prompt';
import AICredentials from '../models/AICredentials';
import { authMiddleware } from '../middleware/auth';
import { getVoiceWebhookUrl, getTwimlBridgeUrl, isPublicBaseUrlConfigured } from '../utils/publicUrl';
import { twilioService, TwilioNotConfiguredError } from '../services/twilioService';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

/**
 * Generate the SIP URI + webhook URL for a phone number.
 *
 * The SIP URI uses the user's OpenAI Project ID when available so it routes
 * to *their* OpenAI project. The webhook URL points to THIS backend (driven
 * by PUBLIC_BASE_URL) so OpenAI / Twilio can actually reach our handler.
 */
async function generateConfig(phoneNumber: string, userId: string) {
  // Try to use the user's real OpenAI project id
  let projectSlug = '';
  try {
    const creds = await AICredentials.findOne({ userId });
    if (creds?.openaiProjectId) {
      projectSlug = creds.openaiProjectId.startsWith('proj_')
        ? creds.openaiProjectId
        : `proj_${creds.openaiProjectId}`;
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
    const phoneNumbers = await PhoneNumber.find({ userId: req.userId })
      .populate('promptId', 'name')
      .sort({ createdAt: -1 });
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

    const config = await generateConfig(phoneNumber, req.userId!);

    const newPhoneNumber = new PhoneNumber({
      userId: req.userId,
      phoneNumber,
      label,
      status: 'pending',
      sipUri: config.sipUri,
      webhookUrl: config.webhookUrl,
      noiseFilter: false,
    });

    await newPhoneNumber.save();
    res.status(201).json(newPhoneNumber);
  } catch (error) {
    console.error('[PhoneNumbers POST]', error);
    res.status(500).json({ error: 'Failed to create phone number request' });
  }
});

// Update phone number: assign/release prompt, toggle noise filter.
// Keeps Prompt.phoneNumber and Prompt.status in sync with PhoneNumber.promptId
// so the Prompts page and the Phone Numbers page agree.
router.post('/assign/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { promptId, noiseFilter } = req.body;
    const update: Record<string, any> = {};

    // Find the existing record first so we can sync the *previous* prompt too.
    const existing = await PhoneNumber.findOne({ _id: req.params?.id, userId: req.userId });
    if (!existing) return res.status(404).json({ error: 'Phone number not found' });

    if (promptId !== undefined) {
      if (promptId === null || promptId === '') {
        update.promptId = null;
        update.status = 'unassigned';
        // Sync: clear the prompt's phoneNumber (only if it currently points to this one)
        if (existing.promptId) {
          await Prompt.updateOne(
            { _id: existing.promptId, userId: req.userId, phoneNumber: existing.phoneNumber },
            { $set: { phoneNumber: '', status: 'draft' } }
          );
        }
      } else {
        update.promptId = promptId;
        update.status = 'assigned';
        // Sync: bind the prompt to this number, mark it active.
        // Also clear the previous prompt if there was one.
        if (existing.promptId && String(existing.promptId) !== String(promptId)) {
          await Prompt.updateOne(
            { _id: existing.promptId, userId: req.userId, phoneNumber: existing.phoneNumber },
            { $set: { phoneNumber: '', status: 'draft' } }
          );
        }
        await Prompt.updateOne(
          { _id: promptId, userId: req.userId },
          { $set: { phoneNumber: existing.phoneNumber, status: 'active' } }
        );
      }
    }

    if (noiseFilter !== undefined) update.noiseFilter = !!noiseFilter;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    const phoneNumber = await PhoneNumber.findOneAndUpdate(
      { _id: req.params?.id, userId: req.userId },
      { $set: update },
      { new: true }
    ).populate('promptId', 'name');

    res.json(phoneNumber);
  } catch (error) {
    console.error('[PhoneNumbers ASSIGN]', error);
    res.status(500).json({ error: 'Failed to update phone number' });
  }
});

/**
 * Report whether a phone number is fully wired for incoming calls.
 * Powers the "Ready for calls" badge on the frontend.
 */
router.get('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params?.id, userId: req.userId })
      .populate<{ promptId: any }>('promptId', 'name');
    if (!phone) return res.status(404).json({ error: 'not_found' });

    const checks = {
      hasPrompt: Boolean(phone.promptId),
      hasWebhookUrl: Boolean(phone.webhookUrl),
      hasSipUri: Boolean(phone.sipUri),
      publicBaseUrlConfigured: isPublicBaseUrlConfigured(),
    };
    const ready = checks.hasPrompt && checks.hasWebhookUrl && checks.hasSipUri;

    res.json({
      ready,
      checks,
      webhookUrl: phone.webhookUrl,
      sipUri: phone.sipUri,
      twimlUrl: getTwimlBridgeUrl(String(phone._id)),
      promptName: phone.promptId ? (phone.promptId as any).name : null,
    });
  } catch (err) {
    console.error('[PhoneNumbers STATUS]', err);
    res.status(500).json({ error: 'failed' });
  }
});

/**
 * Re-generate the SIP URI + webhook URL for an existing number using the
 * current PUBLIC_BASE_URL and OpenAI project id. Useful after changing env.
 */
router.post('/:id/refresh-config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params?.id, userId: req.userId });
    if (!phone) return res.status(404).json({ error: 'not_found' });
    const config = await generateConfig(phone.phoneNumber, req.userId!);
    phone.sipUri = config.sipUri;
    phone.webhookUrl = config.webhookUrl;
    await phone.save();
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

// Twilio: search Twilio inventory for available numbers
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

// Twilio: purchase a number AND register it in our PhoneNumber collection
router.post('/twilio/purchase', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, label } = req.body || {};
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

    // Pre-build our records first so we can use a real PhoneNumber._id in the
    // TwiML callback URL we hand to Twilio. Doing this before the purchase keeps
    // our DB consistent even if Twilio rejects the request mid-flight.
    const localConfig = await generateConfig(phoneNumber, req.userId!);
    const draft = await PhoneNumber.create({
      userId: req.userId,
      phoneNumber,
      label: label || `Twilio ${phoneNumber}`,
      status: 'pending',
      sipUri: localConfig.sipUri,
      webhookUrl: localConfig.webhookUrl,
      noiseFilter: false,
    });

    try {
      const twimlUrl = getTwimlBridgeUrl(String(draft._id));
      const statusUrl = `${getVoiceWebhookUrl(req.userId!).replace(/\/webhook\/.*/, '')}/status/${draft._id}`;
      const purchased = await twilioService.purchase(req.userId!, {
        phoneNumber,
        voiceUrl: twimlUrl,
        statusCallback: statusUrl,
        friendlyName: label || `Nova ${phoneNumber}`,
      });
      // Promote the draft to "unassigned" (purchased but no prompt yet)
      draft.status = 'unassigned';
      draft.label = label || draft.label;
      await draft.save();
      res.status(201).json({
        ok: true,
        twilio: purchased,
        phoneNumber: draft,
      });
    } catch (twilioErr: any) {
      // Rollback the draft if Twilio refused
      await PhoneNumber.deleteOne({ _id: draft._id });
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

// Twilio: list numbers the user already owns on Twilio
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

// Twilio: push our current TwiML/status URLs to Twilio for an existing number
router.post('/:id/twilio-sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params?.id, userId: req.userId });
    if (!phone) return res.status(404).json({ error: 'not_found' });
    const twimlUrl = getTwimlBridgeUrl(String(phone._id));
    const statusUrl = `${getVoiceWebhookUrl(req.userId!).replace(/\/webhook\/.*/, '')}/status/${phone._id}`;
    const updated = await twilioService.syncConfig(req.userId!, phone.phoneNumber, twimlUrl, statusUrl);
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
    const phoneNumber = await PhoneNumber.findOneAndDelete({
      _id: req.params?.id,
      userId: req.userId,
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    res.json({ message: 'Phone number deleted' });
  } catch (error) {
    console.error('[PhoneNumbers DELETE]', error);
    res.status(500).json({ error: 'Failed to delete phone number' });
  }
});

export default router;
