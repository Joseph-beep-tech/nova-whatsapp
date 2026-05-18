import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import AICredentials from '../models/AICredentials';
import Prompt from '../models/Prompt';
import crypto from 'crypto';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// --- Decrypt credentials (same logic as credentials route) ---

function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'secret';
  return crypto.scryptSync(secret, 'azizi-salt', 32);
}

function decrypt(encoded: string): string {
  if (!encoded || !encoded.includes(':')) return encoded;
  try {
    const [ivHex, authTagHex, dataHex] = encoded.split(':');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

// POST /api/test-call/session - Create an OpenAI Realtime session and return ephemeral key
router.post('/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { promptId } = req.body;

    // Get user's OpenAI API key
    const creds = await AICredentials.findOne({ userId: req.userId });
    if (!creds || !creds.openaiApiKey) {
      return res.status(400).json({ error: 'OpenAI API key not configured. Go to AI Credentials to set it up.' });
    }

    const apiKey = decrypt(creds.openaiApiKey);
    if (!apiKey) {
      return res.status(400).json({ error: 'Failed to decrypt OpenAI API key. Please re-save your credentials.' });
    }

    // Get prompt instructions if provided
    let instructions = 'You are a helpful voice assistant. Be concise and friendly.';
    if (promptId) {
      const prompt = await Prompt.findOne({ _id: promptId, userId: req.userId });
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
