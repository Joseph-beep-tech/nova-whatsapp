/**
 * Voice webhook routes — the public endpoints that providers (OpenAI Realtime,
 * Twilio) hit when an inbound call arrives. These routes are unauthenticated
 * by design (they're called by external services) but DO validate that the
 * called number belongs to a known user/prompt.
 *
 * Endpoint shapes:
 *  - GET  /api/v1/voice/health
 *  - POST /api/v1/voice/webhook/user/:userId      ← OpenAI Realtime incoming-call webhook
 *  - POST /api/v1/voice/twiml/:phoneNumberId      ← Twilio Voice URL (returns TwiML XML)
 *  - POST /api/v1/voice/status/:phoneNumberId     ← Twilio Status Callback (call lifecycle)
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import PhoneNumber from '../models/PhoneNumber';
import VoiceCall from '../models/VoiceCall';
import { getPublicBaseUrl } from '../utils/publicUrl';

const router = Router();

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'verse';

function normalize(phone: string): string {
  return (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
}

async function resolveCalledNumber(userId: string, called: string) {
  const target = normalize(called);
  if (!target) return null;
  if (!mongoose.isValidObjectId(userId)) return null;
  // Match against either the stored value or its + variant
  return PhoneNumber.findOne({
    userId,
    $or: [{ phoneNumber: target }, { phoneNumber: `+${target}` }],
  }).populate<{ promptId: { _id: any; name: string; content: string } | null }>('promptId', 'name content');
}

function buildInstructions(promptContent: string | undefined | null): string {
  const base = (promptContent || '').trim() ||
    'You are a helpful, professional voice assistant. Be warm, concise, and stay strictly within scope.';
  return [
    'You are answering an incoming phone call. Speak naturally and conversationally.',
    'Stay STRICTLY within the BUSINESS CONTEXT below. Politely redirect off-topic questions back to what the business offers.',
    'Open with a warm greeting + one-sentence introduction. Collect details one at a time (name, then reason for calling). Keep replies short — this is a phone call.',
    '',
    '----- BUSINESS CONTEXT START -----',
    base,
    '----- BUSINESS CONTEXT END -----',
  ].join('\n');
}

// Health probe
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'voice-webhook',
    publicBaseUrl: getPublicBaseUrl(),
    realtimeModel: REALTIME_MODEL,
  });
});

/**
 * OpenAI Realtime incoming-call webhook.
 *
 * Called by OpenAI when a call lands on the SIP endpoint. Returns the
 * conversation config to use for the call. Body shape varies by OpenAI's
 * webhook contract — we accept either {to, from, call_id} or {data:{...}}.
 */
router.post('/webhook/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const data: Record<string, any> = req.body?.data || req.body || {};
    const called: string = data.to || data.called || data.dialed || (req.query.to as string) || '';
    const caller: string = data.from || data.caller || (req.query.from as string) || 'unknown';
    const callSid: string = data.call_id || data.callSid || data.id || `oa_${Date.now()}`;

    const phone = await resolveCalledNumber(userId, called);
    if (!phone) {
      console.warn(`[voice][${userId}] No phone number record matched "${called}"`);
      return res.status(404).json({ error: 'phone_number_not_provisioned', called });
    }
    if (!phone.promptId) {
      console.warn(`[voice][${userId}] Phone ${called} has no prompt assigned`);
      return res.status(409).json({ error: 'no_prompt_assigned', called });
    }

    const prompt = phone.promptId as any;

    // Log the call (status: ongoing). Cost/duration filled in by status callback.
    try {
      await VoiceCall.create({
        userId,
        phoneNumber: caller,
        promptId: prompt._id,
        status: 'ongoing',
        callSid,
      });
    } catch (err: any) {
      // duplicate callSid is fine — it just means we've seen this call
      if (err?.code !== 11000) console.error('[voice][log] failed:', err);
    }

    res.json({
      type: 'conversation',
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      modalities: ['audio', 'text'],
      instructions: buildInstructions(prompt.content),
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
      metadata: {
        userId,
        promptId: String(prompt._id),
        promptName: prompt.name,
        called,
        caller,
      },
    });
  } catch (err: any) {
    console.error('[voice][webhook] error:', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * Twilio Voice URL handler — returns TwiML.
 *
 * The simplest setup is to bridge the call into OpenAI's SIP endpoint via <Dial><Sip>.
 * We embed a callback URL OpenAI can use to fetch this prompt's instructions.
 */
router.post('/twiml/:phoneNumberId', async (req: Request, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.phoneNumberId)) {
      res.type('text/xml').status(404).send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid number.</Say><Hangup/></Response>'
      );
      return;
    }
    const phone = await PhoneNumber.findById(req.params.phoneNumberId).populate<{ promptId: { _id: any; name: string } | null }>('promptId', 'name');
    if (!phone) {
      res.type('text/xml').status(404).send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not provisioned.</Say><Hangup/></Response>'
      );
      return;
    }
    if (!phone.promptId) {
      res.type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number has no prompt assigned. Please assign one in the dashboard.</Say><Hangup/></Response>'
      );
      return;
    }

    const sipUri = phone.sipUri || `sip:proj_default@sip.api.openai.com;transport=tls`;
    const callerId = (req.body.From || req.body.from || '').toString();
    const callSid = (req.body.CallSid || `tw_${Date.now()}`).toString();

    try {
      await VoiceCall.create({
        userId: phone.userId,
        phoneNumber: callerId || 'unknown',
        promptId: (phone.promptId as any)._id,
        status: 'ongoing',
        callSid,
      });
    } catch (err: any) {
      if (err?.code !== 11000) console.error('[voice][twiml log] failed:', err);
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `  <Dial answerOnBridge="true">`,
      `    <Sip>${sipUri}</Sip>`,
      '  </Dial>',
      '</Response>',
    ].join('\n');
    res.type('text/xml').send(xml);
  } catch (err: any) {
    console.error('[voice][twiml] error:', err);
    res.type('text/xml').status(500).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say><Hangup/></Response>'
    );
  }
});

/**
 * Twilio Status Callback — closes the VoiceCall record when the call ends.
 */
router.post('/status/:phoneNumberId', async (req: Request, res: Response) => {
  try {
    const callSid = (req.body.CallSid || '').toString();
    const callStatus = (req.body.CallStatus || '').toString().toLowerCase();
    const duration = parseInt((req.body.CallDuration || '0').toString(), 10) || 0;
    if (!callSid) return res.json({ ok: true });

    const status = ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)
      ? (callStatus === 'completed' ? 'completed' : 'failed')
      : 'ongoing';

    await VoiceCall.updateOne(
      { callSid },
      { $set: { status, duration } }
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[voice][status] error:', err);
    res.status(500).json({ error: 'status_failed' });
  }
});

export default router;
