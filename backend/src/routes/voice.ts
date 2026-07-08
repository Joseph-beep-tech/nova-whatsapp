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
import { prisma } from '../lib/prisma';
import { getPublicBaseUrl } from '../utils/publicUrl';
import { buildVoiceInstructions, logVoiceInteraction } from '../modules/whatsapp/novagoVoiceHandler';

const router = Router();

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'verse';

function normalize(phone: string): string {
  return (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
}

async function resolveCalledNumber(userId: string, called: string) {
  const target = normalize(called);
  if (!target) return null;
  return prisma.phoneNumber.findFirst({
    where: {
      userId,
      OR: [{ phoneNumber: target }, { phoneNumber: `+${target}` }],
    },
  });
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
    const data = (req.body?.data || req.body || {}) as Record<string, string>;
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

    const prompt = await prisma.prompt.findUnique({ where: { id: phone.promptId } });

    // Log the call (status: ongoing). Cost/duration filled in by status callback.
    try {
      await prisma.voiceCall.create({ data: {
        userId, phoneNumber: caller, promptId: phone.promptId, status: 'ongoing', callSid,
        from: caller, to: called,
      } });
    } catch (err: unknown) {
      console.error('[voice][log] failed:', err);
    }

    res.json({
      type: 'conversation',
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      modalities: ['audio', 'text'],
      instructions: buildInstructions(prompt?.content),
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
      metadata: {
        userId,
        promptId: phone.promptId,
        promptName: prompt?.name,
        called,
        caller,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][webhook] error:', err);
    res.status(500).json({ error: 'internal_error', message: msg });
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
    const phone = await prisma.phoneNumber.findUnique({ where: { id: req.params.phoneNumberId } });
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
      await prisma.voiceCall.create({ data: {
        userId: phone.userId,
        phoneNumber: callerId || 'unknown',
        promptId: phone.promptId,
        status: 'ongoing',
        callSid,
        from: callerId || 'unknown',
        to: phone.phoneNumber || phone.number,
      } });
    } catch (err: unknown) {
      console.error('[voice][twiml log] failed:', err);
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][twiml] error:', msg);
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

    await prisma.voiceCall.updateMany({ where: { callSid }, data: { status, duration } });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][status] error:', msg);
    res.status(500).json({ error: 'status_failed' });
  }
});

/**
 * Restaurant AI Voice — TwiML endpoint.
 *
 * Configure this as the Twilio Voice URL for a restaurant's phone number.
 * Bridges the call to OpenAI Realtime, passing the restaurantId in the SIP
 * headers so the webhook below can build grounded instructions.
 *
 * Twilio Voice URL: POST /api/v1/voice/restaurant/:restaurantId/twiml
 */
router.post('/restaurant/:restaurantId/twiml', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      res.type('text/xml').status(400).send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid restaurant.</Say><Hangup/></Response>'
      );
      return;
    }

    const callerId = (req.body.From || req.body.from || 'unknown').toString();
    const callSid  = (req.body.CallSid || `tw_${Date.now()}`).toString();
    const baseUrl  = getPublicBaseUrl();

    // Webhook URL for OpenAI Realtime to fetch instructions
    const webhookUrl = `${baseUrl}/api/v1/voice/restaurant/${restaurantId}/webhook`;
    const sipUri = `sip:proj_restaurant_${restaurantId}@sip.api.openai.com;transport=tls`;

    try {
      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (restaurant) {
        await prisma.voiceCall.create({ data: {
          userId: restaurant.ownerId,
          phoneNumber: callerId,
          status: 'ongoing',
          callSid,
          from: callerId,
          to: restaurantId,
        } });
      }
    } catch (err: unknown) {
      console.error('[voice][restaurant twiml] log failed:', err);
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `  <Dial answerOnBridge="true">`,
      `    <Sip>${sipUri}?webhook=${encodeURIComponent(webhookUrl)}&amp;caller=${encodeURIComponent(callerId)}</Sip>`,
      '  </Dial>',
      '</Response>',
    ].join('\n');
    res.type('text/xml').send(xml);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][restaurant twiml] error:', msg);
    res.type('text/xml').status(500).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please call again later.</Say><Hangup/></Response>'
    );
  }
});

/**
 * Restaurant AI Voice — OpenAI Realtime webhook.
 *
 * Called by OpenAI when a call hits the SIP endpoint. Returns grounded
 * instructions built from the restaurant's live DB data (menu, KB, customer history).
 *
 * POST /api/v1/voice/restaurant/:restaurantId/webhook
 */
router.post('/restaurant/:restaurantId/webhook', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const data = (req.body?.data || req.body || {}) as Record<string, string>;
    const callerPhone: string = (data.from || data.caller || (req.query.caller as string) || 'unknown').toString();
    const callSid: string = (data.call_id || data.callSid || `oa_${Date.now()}`).toString();
    const startMs = Date.now();

    const instructions = await buildVoiceInstructions(restaurantId, callerPhone);
    if (!instructions) {
      return res.status(404).json({ error: 'restaurant_not_found', restaurantId });
    }

    // Log the call (best-effort)
    logVoiceInteraction({
      restaurantId,
      callSid,
      callerPhone,
      summary: '(inbound restaurant voice call started)',
      latencyMs: Date.now() - startMs,
    });

    res.json({
      type: 'conversation',
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      modalities: ['audio', 'text'],
      instructions,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
      metadata: { restaurantId, callerPhone, callSid },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][restaurant webhook] error:', err);
    res.status(500).json({ error: 'internal_error', message: msg });
  }
});

/**
 * Restaurant AI Voice — status callback.
 * POST /api/v1/voice/restaurant/:restaurantId/status
 */
router.post('/restaurant/:restaurantId/status', async (req: Request, res: Response) => {
  try {
    const callSid    = (req.body.CallSid || '').toString();
    const callStatus = (req.body.CallStatus || '').toString().toLowerCase();
    const duration   = parseInt((req.body.CallDuration || '0').toString(), 10) || 0;
    if (callSid) {
      const status = callStatus === 'completed' ? 'completed' : 'failed';
      await prisma.voiceCall.updateMany({ where: { callSid }, data: { status, duration } });
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice][restaurant status] error:', msg);
    res.status(500).json({ error: 'status_failed' });
  }
});

export default router;
