/**
 * Phone Number Utilities Tests
 */

import {
  normalizeChatId,
  extractPhoneNumber,
  isValidChatId,
  isGroupChat,
  formatForDisplay,
  normalizeMultiple,
} from '../../../src/utils/phoneNumber';

describe('phoneNumber utilities', () => {
  describe('normalizeChatId', () => {
    it('should add @c.us suffix to plain phone number', () => {
      expect(normalizeChatId('254722833440')).toBe('254722833440@c.us');
    });

    it('should strip leading + and add suffix', () => {
      expect(normalizeChatId('+254722833440')).toBe('254722833440@c.us');
    });

    it('should remove spaces and add suffix', () => {
      expect(normalizeChatId('+254 722 833 440')).toBe('254722833440@c.us');
      expect(normalizeChatId('254 722 833 440')).toBe('254722833440@c.us');
    });

    it('should remove dashes and add suffix', () => {
      expect(normalizeChatId('254-722-833-440')).toBe('254722833440@c.us');
      expect(normalizeChatId('+254-722-833-440')).toBe('254722833440@c.us');
    });

    it('should remove parentheses and add suffix', () => {
      expect(normalizeChatId('(254) 722833440')).toBe('254722833440@c.us');
    });

    it('should handle mixed formatting', () => {
      expect(normalizeChatId('+254 (722) 833-440')).toBe('254722833440@c.us');
    });

    it('should return already formatted chatId unchanged', () => {
      expect(normalizeChatId('254722833440@c.us')).toBe('254722833440@c.us');
    });

    it('should preserve group suffix when already present', () => {
      expect(normalizeChatId('120363123456789@g.us')).toBe('120363123456789@g.us');
    });

    it('should add @g.us suffix when isGroup=true', () => {
      expect(normalizeChatId('120363123456789', true)).toBe('120363123456789@g.us');
    });

    it('should handle long group IDs (18 digits)', () => {
      expect(normalizeChatId('120363000000000000', true)).toBe('120363000000000000@g.us');
    });

    it('should handle lid format', () => {
      expect(normalizeChatId('23527881191516@lid')).toBe('23527881191516@lid');
    });

    it('should throw error for empty input', () => {
      expect(() => normalizeChatId('')).toThrow('Phone number or chat ID is required');
    });

    it('should throw error for invalid characters', () => {
      expect(() => normalizeChatId('abc123')).toThrow('contains non-numeric characters');
    });

    it('should throw error for too short numbers', () => {
      expect(() => normalizeChatId('12345')).toThrow('Invalid phone number length');
    });

    it('should throw error for too long numbers', () => {
      expect(() => normalizeChatId('1234567890123456')).toThrow('Invalid phone number length');
    });

    it('should handle whitespace-only input', () => {
      expect(() => normalizeChatId('   ')).toThrow();
    });

    it('should trim whitespace around valid number', () => {
      expect(normalizeChatId('  254722833440  ')).toBe('254722833440@c.us');
    });
  });

  describe('extractPhoneNumber', () => {
    it('should extract number from @c.us chatId', () => {
      expect(extractPhoneNumber('254722833440@c.us')).toBe('254722833440');
    });

    it('should extract number from @g.us chatId', () => {
      expect(extractPhoneNumber('120363123456789@g.us')).toBe('120363123456789');
    });

    it('should extract number from @lid chatId', () => {
      expect(extractPhoneNumber('23527881191516@lid')).toBe('23527881191516');
    });

    it('should return input unchanged if no suffix', () => {
      expect(extractPhoneNumber('254722833440')).toBe('254722833440');
    });

    it('should handle empty input', () => {
      expect(extractPhoneNumber('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(extractPhoneNumber(null as unknown as string)).toBe('');
      expect(extractPhoneNumber(undefined as unknown as string)).toBe('');
    });
  });

  describe('isValidChatId', () => {
    it('should return true for valid @c.us chatId', () => {
      expect(isValidChatId('254722833440@c.us')).toBe(true);
    });

    it('should return true for valid @g.us chatId', () => {
      expect(isValidChatId('120363123456789@g.us')).toBe(true);
    });

    it('should return true for valid @lid chatId', () => {
      expect(isValidChatId('23527881191516@lid')).toBe(true);
    });

    it('should return false for number without suffix', () => {
      expect(isValidChatId('254722833440')).toBe(false);
    });

    it('should return false for invalid suffix', () => {
      expect(isValidChatId('254722833440@invalid')).toBe(false);
    });

    it('should return false for empty input', () => {
      expect(isValidChatId('')).toBe(false);
    });

    it('should return false for too short personal chatId', () => {
      expect(isValidChatId('12345@c.us')).toBe(false);
    });
  });

  describe('isGroupChat', () => {
    it('should return true for @g.us chatId', () => {
      expect(isGroupChat('120363123456789@g.us')).toBe(true);
    });

    it('should return false for @c.us chatId', () => {
      expect(isGroupChat('254722833440@c.us')).toBe(false);
    });

    it('should return false for empty input', () => {
      expect(isGroupChat('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isGroupChat(null as unknown as string)).toBe(false);
      expect(isGroupChat(undefined as unknown as string)).toBe(false);
    });
  });

  describe('formatForDisplay', () => {
    it('should format phone number with spaces', () => {
      expect(formatForDisplay('254722833440')).toBe('+254 722 833 440');
    });

    it('should handle chatId input', () => {
      expect(formatForDisplay('254722833440@c.us')).toBe('+254 722 833 440');
    });

    it('should handle short numbers without formatting', () => {
      expect(formatForDisplay('1234567')).toBe('1234567');
    });
  });

  describe('normalizeMultiple', () => {
    it('should normalize comma-separated string', () => {
      expect(normalizeMultiple('+254722833440, 254705914467')).toEqual([
        '254722833440@c.us',
        '254705914467@c.us',
      ]);
    });

    it('should normalize array of numbers', () => {
      expect(normalizeMultiple(['+254722833440', '254705914467'])).toEqual([
        '254722833440@c.us',
        '254705914467@c.us',
      ]);
    });

    it('should filter empty strings', () => {
      expect(normalizeMultiple('254722833440,  , 254705914467')).toEqual([
        '254722833440@c.us',
        '254705914467@c.us',
      ]);
    });

    it('should handle already formatted chatIds', () => {
      expect(normalizeMultiple(['254722833440@c.us', '+254705914467'])).toEqual([
        '254722833440@c.us',
        '254705914467@c.us',
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(normalizeMultiple('')).toEqual([]);
      expect(normalizeMultiple([])).toEqual([]);
    });
  });
});
