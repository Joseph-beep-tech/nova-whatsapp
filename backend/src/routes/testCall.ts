import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/credentialsCrypto';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// Helper to read credentials from file
function getDecryptedCredentials(userId: string): Record<string, string> {
  const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'credentials');
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fp = path.join(DATA_DIR, `${safe}.json`);
  if (!fs.existsSync(fp)) return {};
  const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.includes(':')) {
      result[k] = decrypt(v);
    } else if (typeof v === 'string') {
      result[k] = v;
    }
  }
  return result;
}

// POST /api/test-call/session - Create an OpenAI Realtime session and return ephemeral key
router.post('/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { promptId } = req.body;

    // Get user's OpenAI API key from Prisma or file storage
    let apiKey = '';
    const creds = await prisma.aICredentials.findUnique({ where: { userId: req.userId } });
    if (creds?.openaiApiKey) {
      apiKey = decrypt(creds.openaiApiKey);
    }

    if (!apiKey) {
      // Fallback to file storage
      const fileCreds = getDecryptedCredentials(req.userId!);
      apiKey = fileCreds.openaiApiKey || '';
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key not configured. Go to AI Credentials to set it up.' });
    }

    // Get prompt instructions if provided
    let instructions = 'You are a helpful voice assistant. Be concise and friendly.';
    if (promptId) {
      const prompt = await prisma.prompt.findFirst({
        where: { id: promptId, userId: req.userId },
      });
      if (prompt) {
        instructions = prompt.content;
      }
    }

    // Create an ephemeral token from OpenAI Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse',
        instructions,
        input_audio_transcription: {
          model: 'whisper-1',
        },
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      console.error('[TestCall] OpenAI session error:', response.status, errorData);
      return res.status(response.status).json({
        error: errorData?.error?.message || `OpenAI API error (${response.status})`,
      });
    }

    const data: any = await response.json();
    console.log('[TestCall] Session created successfully');

    res.json({
      clientSecret: data.client_secret?.value,
      sessionId: data.id,
      expiresAt: data.client_secret?.expires_at,
    });
  } catch (error: any) {
    console.error('[TestCall] Error:', error);
    res.status(500).json({ error: 'Failed to create voice session: ' + error.message });
  }
});

export default router;
