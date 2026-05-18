/**
 * Resolve the public-facing base URL of this backend.
 *
 * Order of precedence:
 *   1. PUBLIC_BASE_URL env var (recommended in production: e.g. https://api.example.com)
 *   2. WEBHOOK_BASE_URL env var (legacy)
 *   3. http://localhost:<PORT> for local development
 *
 * This is the URL providers (OpenAI Realtime, Twilio) call when an incoming
 * call arrives — it MUST be reachable from the public internet in production
 * (use ngrok / cloudflared during development).
 */
export function getPublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL || process.env.WEBHOOK_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

export function getVoiceWebhookUrl(userId: string): string {
  return `${getPublicBaseUrl()}/api/v1/voice/webhook/user/${userId}`;
}

export function getTwimlBridgeUrl(phoneNumberId: string): string {
  return `${getPublicBaseUrl()}/api/v1/voice/twiml/${phoneNumberId}`;
}

export function isPublicBaseUrlConfigured(): boolean {
  return Boolean(process.env.PUBLIC_BASE_URL || process.env.WEBHOOK_BASE_URL);
}
