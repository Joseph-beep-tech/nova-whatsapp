/**
 * Phone Number Utilities
 *
 * Normalizes phone numbers to WhatsApp format (e.g., "254722833440@c.us")
 * Handles various input formats:
 * - With/without leading "+"
 * - With/without country code
 * - With spaces, dashes, parentheses
 * - Already formatted WhatsApp IDs
 */

// =============================================================================
// Platform Types
// =============================================================================

/** WhatsApp platform suffixes */
export type WhatsAppPlatform = 'c.us' | 'g.us' | 'lid';

/** Default platform for personal chats */
export const DEFAULT_PLATFORM: WhatsAppPlatform = 'c.us';

/** All valid platform suffixes */
const VALID_PLATFORMS: ReadonlySet<string> = new Set<string>(['c.us', 'g.us', 'lid']);

/** Result of parsing a chatId into identifier + platform */
export interface ParsedChatId {
  /** Phone number or group ID (without @suffix) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
}

// =============================================================================
// Core Conversion Functions
// =============================================================================

/**
 * Reconstruct a WhatsApp chatId from identifier + platform
 *
 * @param identifier - Phone number or group ID (e.g., "254722833440")
 * @param platform - WhatsApp platform suffix (default: "c.us")
 * @returns Full chatId (e.g., "254722833440@c.us")
 *
 * @example
 * toChatId("254722833440")           // "254722833440@c.us"
 * toChatId("254722833440", "c.us")   // "254722833440@c.us"
 * toChatId("120363000000", "g.us")   // "120363000000@g.us"
 */
export function toChatId(identifier: string, platform: WhatsAppPlatform = DEFAULT_PLATFORM): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Identifier is required');
  }
  return `${identifier.trim()}@${platform}`;
}

/**
 * Parse a WhatsApp chatId into identifier + platform
 *
 * @param chatId - Full chatId (e.g., "254722833440@c.us")
 * @returns Parsed identifier and platform
 * @throws Error if chatId has no valid platform suffix
 *
 * @example
 * fromChatId("254722833440@c.us")   // { identifier: "254722833440", platform: "c.us" }
 * fromChatId("120363000000@g.us")   // { identifier: "120363000000", platform: "g.us" }
 * fromChatId("user@lid")            // { identifier: "user", platform: "lid" }
 */
export function fromChatId(chatId: string): ParsedChatId {
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Chat ID is required');
  }

  const atIndex = chatId.lastIndexOf('@');
  if (atIndex === -1) {
    throw new Error(`Invalid chatId format: "${chatId}" - missing @ suffix`);
  }

  const identifier = chatId.slice(0, atIndex);
  const suffix = chatId.slice(atIndex + 1);

  if (!VALID_PLATFORMS.has(suffix)) {
    throw new Error(`Invalid chatId platform: "${suffix}" - expected one of: ${[...VALID_PLATFORMS].join(', ')}`);
  }

  return { identifier, platform: suffix as WhatsAppPlatform };
}

/**
 * Check if a string is a valid WhatsApp platform suffix
 */
export function isValidPlatform(value: string): value is WhatsAppPlatform {
  return VALID_PLATFORMS.has(value);
}

// =============================================================================
// Legacy Functions (updated to use toChatId/fromChatId internally)
// =============================================================================

/**
 * Normalize a phone number to WhatsApp chatId format
 *
 * @param input - Phone number in various formats
 * @param isGroup - If true, uses @g.us suffix instead of @c.us
 * @returns Normalized WhatsApp chatId (e.g., "254722833440@c.us")
 *
 * @example
 * normalizeChatId("+254722833440")     // "254722833440@c.us"
 * normalizeChatId("254722833440")      // "254722833440@c.us"
 * normalizeChatId("+254 722 833 440")  // "254722833440@c.us"
 * normalizeChatId("254-722-833-440")   // "254722833440@c.us"
 * normalizeChatId("0722833440")        // "0722833440@c.us" (local format preserved)
 * normalizeChatId("254722833440@c.us") // "254722833440@c.us" (already formatted)
 */
export function normalizeChatId(input: string, isGroup: boolean = false): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Phone number or chat ID is required');
  }

  const trimmed = input.trim();

  // Already has WhatsApp suffix - validate and return
  if (trimmed.includes('@')) {
    if (trimmed.endsWith('@c.us') || trimmed.endsWith('@g.us') || trimmed.endsWith('@lid')) {
      return trimmed;
    }
    // Invalid suffix, strip and re-process
    const withoutSuffix = trimmed.split('@')[0];
    return normalizeChatId(withoutSuffix, isGroup);
  }

  // Remove all non-digit characters except leading +
  let normalized = trimmed;

  // Handle leading + separately
  const hasPlus = normalized.startsWith('+');
  if (hasPlus) {
    normalized = normalized.substring(1);
  }

  // Remove spaces, dashes, parentheses, dots
  normalized = normalized.replace(/[\s\-\(\)\.]/g, '');

  // Validate: should only contain digits now
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid phone number format: "${input}" - contains non-numeric characters`);
  }

  // Validate length
  // - Personal chats: 7-15 digits (phone numbers)
  // - Group chats: 15-25 digits (group IDs like 120363000000000000)
  const minLength = 7;
  const maxLength = isGroup ? 25 : 15;

  if (normalized.length < minLength || normalized.length > maxLength) {
    const expectedRange = isGroup ? '7-25' : '7-15';
    throw new Error(`Invalid ${isGroup ? 'group ID' : 'phone number'} length: "${input}" - expected ${expectedRange} digits, got ${normalized.length}`);
  }

  // Add appropriate suffix
  const suffix = isGroup ? '@g.us' : '@c.us';
  return `${normalized}${suffix}`;
}

/**
 * Extract phone number (identifier) from WhatsApp chatId
 *
 * @param chatId - WhatsApp chatId (e.g., "254722833440@c.us") or bare number
 * @returns Phone number without suffix (e.g., "254722833440")
 *
 * @example
 * extractPhoneNumber("254722833440@c.us") // "254722833440"
 * extractPhoneNumber("254722833440")      // "254722833440"
 */
export function extractPhoneNumber(chatId: string): string {
  if (!chatId || typeof chatId !== 'string') {
    return '';
  }

  if (!chatId.includes('@')) {
    return chatId;
  }

  try {
    return fromChatId(chatId).identifier;
  } catch {
    // Fallback for invalid suffixes - strip everything after @
    return chatId.split('@')[0];
  }
}

/**
 * Check if a string is a valid WhatsApp chatId
 *
 * @param input - String to validate
 * @returns True if valid WhatsApp chatId format
 *
 * @example
 * isValidChatId("254722833440@c.us")  // true
 * isValidChatId("120363XXX@g.us")     // true
 * isValidChatId("254722833440")       // false (no suffix)
 * isValidChatId("invalid")            // false
 */
export function isValidChatId(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Must have valid suffix
  if (!input.endsWith('@c.us') && !input.endsWith('@g.us') && !input.endsWith('@lid')) {
    return false;
  }

  // Extract the ID part
  const idPart = extractPhoneNumber(input);

  // For personal chats, should be digits only
  if (input.endsWith('@c.us')) {
    return /^\d{7,15}$/.test(idPart);
  }

  // For groups and lid, more flexible (can contain letters)
  return idPart.length > 0;
}

/**
 * Check if a chatId or platform represents a group chat
 *
 * @param chatIdOrPlatform - WhatsApp chatId (e.g., "120363@g.us") or platform (e.g., "g.us")
 * @returns True if group chat
 */
export function isGroupChat(chatIdOrPlatform: string): boolean {
  if (!chatIdOrPlatform) return false;
  if (chatIdOrPlatform === 'g.us') return true;
  return chatIdOrPlatform.endsWith('@g.us');
}

/**
 * Format phone number for display (with country code indicator)
 *
 * @param phoneNumber - Raw phone number
 * @returns Formatted display string
 *
 * @example
 * formatForDisplay("254722833440") // "+254 722 833 440"
 */
export function formatForDisplay(phoneNumber: string): string {
  const digits = extractPhoneNumber(phoneNumber);

  if (digits.length < 10) {
    return digits;
  }

  // Simple formatting: +XXX XXX XXX XXX
  // This is a basic implementation - could be enhanced with libphonenumber
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`.trim();
}

/**
 * Normalize multiple phone numbers/chatIds
 *
 * @param inputs - Array or comma-separated string of phone numbers
 * @returns Array of normalized chatIds
 *
 * @example
 * normalizeMultiple("+254722833440, 254705914467")
 * // ["254722833440@c.us", "254705914467@c.us"]
 */
export function normalizeMultiple(inputs: string | string[]): string[] {
  let list: string[];

  if (typeof inputs === 'string') {
    list = inputs.split(',').map(s => s.trim()).filter(s => s.length > 0);
  } else if (Array.isArray(inputs)) {
    list = inputs.filter(s => s && typeof s === 'string');
  } else {
    return [];
  }

  return list.map(input => normalizeChatId(input));
}
