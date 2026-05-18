import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import AICredentials from '../models/AICredentials';
import { encrypt, decrypt } from '../utils/credentialsCrypto';

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
  body: any;
  params: any;
}

const router = Router();

// --- Storage ---

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'credentials');
fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safe}.json`);
}

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

const EMPTY_RECORD: Record<string, string> = {
  openaiApiKey: '',
  openaiSigningSecret: '',
  openaiProjectId: '',
  gcpServiceAccount: '',
  gcpDriveFolderId: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
};

async function loadStored(userId: string): Promise<Record<string, string>> {
  if (isMongoConnected()) {
    const doc = await AICredentials.findOne({ userId });
    if (doc) {
      return {
        openaiApiKey: doc.openaiApiKey || '',
        openaiSigningSecret: doc.openaiSigningSecret || '',
        openaiProjectId: doc.openaiProjectId || '',
        gcpServiceAccount: typeof doc.gcpServiceAccount === 'object' && Object.keys(doc.gcpServiceAccount).length > 0
          ? JSON.stringify(doc.gcpServiceAccount)
          : (typeof doc.gcpServiceAccount === 'string' ? doc.gcpServiceAccount : ''),
        gcpDriveFolderId: doc.gcpDriveFolderId || '',
        twilioAccountSid: doc.twilioAccountSid || '',
        twilioAuthToken: doc.twilioAuthToken || '',
      };
    }
    return { ...EMPTY_RECORD };
  }

  const fp = filePath(userId);
  if (fs.existsSync(fp)) {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return {
      openaiApiKey: raw.openaiApiKey || '',
      openaiSigningSecret: raw.openaiSigningSecret || '',
      openaiProjectId: raw.openaiProjectId || '',
      gcpServiceAccount: raw.gcpServiceAccount || '',
      gcpDriveFolderId: raw.gcpDriveFolderId || '',
      twilioAccountSid: raw.twilioAccountSid || '',
      twilioAuthToken: raw.twilioAuthToken || '',
    };
  }
  return { ...EMPTY_RECORD };
}

async function saveStored(userId: string, data: Record<string, string>): Promise<void> {
  if (isMongoConnected()) {
    // For MongoDB, convert gcpServiceAccount JSON string back to object
    const toSave: Record<string, any> = { ...data };
    if (toSave.gcpServiceAccount && typeof toSave.gcpServiceAccount === 'string') {
      try {
        toSave.gcpServiceAccount = JSON.parse(toSave.gcpServiceAccount);
      } catch {
        // keep as string if not valid JSON
      }
    }
    await AICredentials.findOneAndUpdate(
      { userId },
      { $set: toSave },
      { upsert: true, new: true }
    );
    return;
  }

  const fp = filePath(userId);
  let existing: Record<string, any> = {};
  if (fs.existsSync(fp)) {
    existing = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  }
  const merged = { ...existing, ...data, userId, updatedAt: new Date().toISOString() };
  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
}

// Secret fields get encrypted; plain fields stored as-is
const SECRET_FIELDS = ['openaiApiKey', 'openaiSigningSecret', 'gcpServiceAccount', 'twilioAuthToken'];
const PLAIN_FIELDS = ['openaiProjectId', 'gcpDriveFolderId', 'twilioAccountSid'];
const ALL_FIELDS = [...SECRET_FIELDS, ...PLAIN_FIELDS];

// Group definitions for separate save endpoints
const OPENAI_FIELDS = ['openaiApiKey', 'openaiSigningSecret', 'openaiProjectId'];
const GCP_FIELDS = ['gcpServiceAccount', 'gcpDriveFolderId'];
const TWILIO_FIELDS = ['twilioAccountSid', 'twilioAuthToken'];

function encryptRecord(data: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of ALL_FIELDS) {
    if (SECRET_FIELDS.includes(field)) {
      result[field] = encrypt(data[field] || '');
    } else {
      result[field] = data[field] || '';
    }
  }
  return result;
}

function decryptRecord(data: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of ALL_FIELDS) {
    if (SECRET_FIELDS.includes(field)) {
      result[field] = decrypt(data[field] || '');
    } else {
      result[field] = data[field] || '';
    }
  }
  return result;
}

// --- Masking ---

function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 6) return '••••••';
  return value.slice(0, 3) + '•••' + value.slice(-3);
}

function maskJson(value: string): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    const masked: Record<string, any> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'string') {
        if (key === 'private_key' || key === 'private_key_id') {
          masked[key] = mask(val);
        } else {
          masked[key] = val; // show non-secret fields as-is
        }
      } else {
        masked[key] = val;
      }
    }
    return JSON.stringify(masked, null, 2);
  } catch {
    return mask(value);
  }
}

function isMasked(value: string): boolean {
  return value.includes('•');
}

// --- Validation ---

interface ValidationErrors {
  [field: string]: string;
}

function validate(data: Record<string, string>, fields: string[]): ValidationErrors {
  const errors: ValidationErrors = {};

  if (fields.includes('openaiApiKey') && data.openaiApiKey !== undefined) {
    const v = data.openaiApiKey;
    if (v && v.length < 10) {
      errors.openaiApiKey = 'API Key seems too short';
    }
  }

  if (fields.includes('openaiSigningSecret') && data.openaiSigningSecret !== undefined) {
    const v = data.openaiSigningSecret;
    if (v && v.length < 10) {
      errors.openaiSigningSecret = 'Signing Secret seems too short (minimum 10 characters)';
    }
  }

  if (fields.includes('openaiProjectId') && data.openaiProjectId !== undefined) {
    const v = data.openaiProjectId;
    if (v && !v.startsWith('proj_')) {
      errors.openaiProjectId = 'Project ID must start with "proj_"';
    }
  }

  if (fields.includes('gcpServiceAccount') && data.gcpServiceAccount !== undefined) {
    const v = data.gcpServiceAccount;
    if (v) {
      try {
        const parsed = JSON.parse(v);
        if (!parsed.type || !parsed.project_id || !parsed.private_key || !parsed.client_email) {
          errors.gcpServiceAccount = 'Service account JSON must contain type, project_id, private_key, and client_email fields';
        }
      } catch {
        errors.gcpServiceAccount = 'Invalid JSON format. Paste the full service account JSON file contents';
      }
    }
  }

  if (fields.includes('twilioAccountSid') && data.twilioAccountSid !== undefined) {
    const v = data.twilioAccountSid;
    if (v && !v.startsWith('AC')) {
      errors.twilioAccountSid = 'Twilio Account SID must start with "AC"';
    }
  }

  if (fields.includes('twilioAuthToken') && data.twilioAuthToken !== undefined) {
    const v = data.twilioAuthToken;
    if (v && v.length < 20) {
      errors.twilioAuthToken = 'Twilio Auth Token looks too short';
    }
  }

  if (fields.includes('gcpDriveFolderId') && data.gcpDriveFolderId !== undefined) {
    const v = data.gcpDriveFolderId;
    if (v && v.length < 10) {
      errors.gcpDriveFolderId = 'Folder ID seems too short';
    }
  }

  return errors;
}

// --- Helper to build response ---

function buildResponse(decrypted: Record<string, string>, fields: string[]) {
  const status: Record<string, boolean> = {};
  const masked: Record<string, string> = {};

  for (const field of fields) {
    const val = decrypted[field] || '';
    status[field] = val.length > 0;
    if (field === 'gcpServiceAccount') {
      masked[field] = maskJson(val);
    } else {
      masked[field] = mask(val);
    }
  }

  return { status, masked };
}

// --- Routes ---

// GET: returns masked values + status for ALL credentials
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const stored = await loadStored(userId);
    const decrypted = decryptRecord(stored);
    const response = buildResponse(decrypted, ALL_FIELDS);
    res.json(response);
  } catch (error) {
    console.error('[Credentials GET]', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// PUT /: save OpenAI credentials
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const input = req.body;

    const updates: Record<string, string> = {};
    for (const field of OPENAI_FIELDS) {
      const val = input[field];
      if (val && typeof val === 'string' && !isMasked(val)) {
        updates[field] = val.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid credentials provided', errors: {} });
    }

    const errors = validate(updates, OPENAI_FIELDS);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const stored = await loadStored(userId);
    const existing = decryptRecord(stored);

    for (const field of OPENAI_FIELDS) {
      if (updates[field] !== undefined) {
        existing[field] = updates[field];
      }
    }

    const encrypted = encryptRecord(existing);
    await saveStored(userId, encrypted);

    const response = buildResponse(existing, ALL_FIELDS);
    res.json({ message: 'OpenAI credentials saved successfully', ...response });
  } catch (error) {
    console.error('[Credentials PUT]', error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// PUT /twilio: save Twilio credentials
router.put('/twilio', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const input = req.body;

    const updates: Record<string, string> = {};
    for (const field of TWILIO_FIELDS) {
      const val = input[field];
      if (val && typeof val === 'string' && !isMasked(val)) {
        updates[field] = val.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid credentials provided', errors: {} });
    }

    const errors = validate(updates, TWILIO_FIELDS);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const stored = await loadStored(userId);
    const existing = decryptRecord(stored);

    for (const field of TWILIO_FIELDS) {
      if (updates[field] !== undefined) existing[field] = updates[field];
    }

    const encrypted = encryptRecord(existing);
    await saveStored(userId, encrypted);

    const response = buildResponse(existing, ALL_FIELDS);
    res.json({ message: 'Twilio credentials saved successfully', ...response });
  } catch (error) {
    console.error('[Credentials PUT /twilio]', error);
    res.status(500).json({ error: 'Failed to save Twilio credentials' });
  }
});

// PUT /gcp: save Google Cloud credentials
router.put('/gcp', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const input = req.body;

    const updates: Record<string, string> = {};
    for (const field of GCP_FIELDS) {
      const val = input[field];
      if (val && typeof val === 'string' && !isMasked(val)) {
        updates[field] = val.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid credentials provided', errors: {} });
    }

    const errors = validate(updates, GCP_FIELDS);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const stored = await loadStored(userId);
    const existing = decryptRecord(stored);

    for (const field of GCP_FIELDS) {
      if (updates[field] !== undefined) {
        existing[field] = updates[field];
      }
    }

    const encrypted = encryptRecord(existing);
    await saveStored(userId, encrypted);

    const response = buildResponse(existing, ALL_FIELDS);
    res.json({ message: 'Google Cloud credentials saved successfully', ...response });
  } catch (error) {
    console.error('[Credentials PUT /gcp]', error);
    res.status(500).json({ error: 'Failed to save Google Cloud credentials' });
  }
});

export default router;
