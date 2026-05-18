/**
 * Event Data Extraction Helpers
 *
 * Shared utilities for extracting fields from wwebjs-api event payloads.
 * Used by both routes/events.ts and utils/socketPayloads.ts.
 */

/**
 * Extract chatId from event data.
 * Tries common locations where chatId might be found in WhatsApp events.
 */
export function extractChatIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;

  const candidates = [
    data.from,
    data.chatId,
    (data.message as Record<string, unknown>)?.from,
    (data.msg as Record<string, unknown>)?.from,
    (data.data as Record<string, unknown>)?.from,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes('@')) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extract message body from event data.
 */
export function extractMessageBody(data: Record<string, unknown> | undefined): string {
  if (!data) return '';

  const candidates = [
    data.body,
    (data.message as Record<string, unknown>)?.body,
    (data.msg as Record<string, unknown>)?.body,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') return candidate;
  }

  return '';
}

/**
 * Extract fromMe flag from event data.
 */
export function extractFromMe(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;

  const candidates = [
    data.fromMe,
    (data.message as Record<string, unknown>)?.fromMe,
    (data.msg as Record<string, unknown>)?.fromMe,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') return candidate;
  }

  return false;
}
