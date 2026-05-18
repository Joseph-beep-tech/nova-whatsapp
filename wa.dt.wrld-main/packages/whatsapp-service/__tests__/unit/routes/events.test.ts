/**
 * Events Route Unit Tests
 *
 * Tests the event processing route functions to prevent
 * production errors like undefined data handling.
 */

import {
  extractChatIdFromEvent,
  extractMessageBody,
  extractFromMe,
} from '../../../src/routes/events';
import {
  messageEvent,
  nestedMessageEvent,
  msgStructureEvent,
  chatIdEvent,
  emptyDataEvent,
  invalidFromEvent,
  groupMessageEvent,
} from '../../fixtures/eventTestData';

describe('Events Route Functions', () => {
  describe('extractChatIdFromEvent', () => {
    describe('undefined/null data handling', () => {
      it('should return null for undefined data', () => {
        expect(extractChatIdFromEvent(undefined)).toBeNull();
      });

      it('should return null for null data', () => {
        expect(extractChatIdFromEvent(null as unknown as Record<string, unknown>)).toBeNull();
      });

      it('should return null for empty object', () => {
        expect(extractChatIdFromEvent({})).toBeNull();
      });
    });

    describe('standard data extraction', () => {
      it('should extract chatId from data.from', () => {
        expect(extractChatIdFromEvent(messageEvent.data as Record<string, unknown>)).toBe(
          '254722833440@c.us'
        );
      });

      it('should extract chatId from data.chatId', () => {
        expect(extractChatIdFromEvent(chatIdEvent.data as Record<string, unknown>)).toBe(
          '254722833440@c.us'
        );
      });

      it('should extract chatId from nested message.from', () => {
        expect(extractChatIdFromEvent(nestedMessageEvent.data as Record<string, unknown>)).toBe(
          '254722833440@c.us'
        );
      });

      it('should extract chatId from nested msg.from', () => {
        expect(extractChatIdFromEvent(msgStructureEvent.data as Record<string, unknown>)).toBe(
          '254711222333@c.us'
        );
      });

      it('should extract group chatId', () => {
        expect(extractChatIdFromEvent(groupMessageEvent.data as Record<string, unknown>)).toBe(
          '254722833440@c.us'
        );
      });
    });

    describe('invalid data handling', () => {
      it('should return null for from without @ sign', () => {
        expect(extractChatIdFromEvent(invalidFromEvent.data as Record<string, unknown>)).toBeNull();
      });

      it('should return null when no chatId candidates exist', () => {
        expect(extractChatIdFromEvent(emptyDataEvent.data as Record<string, unknown>)).toBeNull();
      });

      it('should return null for data with only non-string from', () => {
        expect(extractChatIdFromEvent({ from: 12345 })).toBeNull();
      });

      it('should return null for data with undefined from', () => {
        expect(extractChatIdFromEvent({ from: undefined })).toBeNull();
      });
    });

    describe('production event types without data', () => {
      it('should handle authenticated event (no data field)', () => {
        // Simulates: { dataType: 'authenticated', sessionId: 'mysession' }
        // authenticatedEvent has no data property, so we pass undefined
        expect(extractChatIdFromEvent(undefined)).toBeNull();
      });

      it('should handle loading_screen event (no data field)', () => {
        // loadingScreenEvent has no data property
        expect(extractChatIdFromEvent(undefined)).toBeNull();
      });

      it('should handle disconnected event (no data field)', () => {
        // disconnectedEvent has no data property
        expect(extractChatIdFromEvent(undefined)).toBeNull();
      });
    });
  });

  describe('extractMessageBody', () => {
    describe('undefined/null data handling', () => {
      it('should return empty string for undefined data', () => {
        expect(extractMessageBody(undefined)).toBe('');
      });

      it('should return empty string for null data', () => {
        expect(extractMessageBody(null as unknown as Record<string, unknown>)).toBe('');
      });

      it('should return empty string for empty object', () => {
        expect(extractMessageBody({})).toBe('');
      });
    });

    describe('standard data extraction', () => {
      it('should extract body from data.body', () => {
        expect(extractMessageBody(messageEvent.data as Record<string, unknown>)).toBe(
          'Hello, world!'
        );
      });

      it('should extract body from nested message.body', () => {
        expect(extractMessageBody(nestedMessageEvent.data as Record<string, unknown>)).toBe(
          'Nested body'
        );
      });

      it('should extract body from nested msg.body', () => {
        expect(extractMessageBody(msgStructureEvent.data as Record<string, unknown>)).toBe(
          'Msg body'
        );
      });
    });

    describe('invalid data handling', () => {
      it('should return empty string for non-string body', () => {
        expect(extractMessageBody({ body: 12345 })).toBe('');
      });

      it('should return empty string for undefined body', () => {
        expect(extractMessageBody({ body: undefined })).toBe('');
      });
    });

    describe('production event types without data', () => {
      it('should handle authenticated event (no data field)', () => {
        // authenticatedEvent has no data property
        expect(extractMessageBody(undefined)).toBe('');
      });

      it('should handle loading_screen event (no data field)', () => {
        // loadingScreenEvent has no data property
        expect(extractMessageBody(undefined)).toBe('');
      });
    });
  });

  describe('extractFromMe', () => {
    describe('undefined/null data handling', () => {
      it('should return false for undefined data', () => {
        expect(extractFromMe(undefined)).toBe(false);
      });

      it('should return false for null data', () => {
        expect(extractFromMe(null as unknown as Record<string, unknown>)).toBe(false);
      });

      it('should return false for empty object', () => {
        expect(extractFromMe({})).toBe(false);
      });
    });

    describe('standard data extraction', () => {
      it('should extract fromMe: false', () => {
        expect(extractFromMe(messageEvent.data as Record<string, unknown>)).toBe(false);
      });

      it('should extract fromMe: true', () => {
        expect(extractFromMe({ fromMe: true })).toBe(true);
      });

      it('should extract fromMe from nested message', () => {
        expect(extractFromMe(nestedMessageEvent.data as Record<string, unknown>)).toBe(false);
      });

      it('should extract fromMe from nested msg', () => {
        expect(extractFromMe(msgStructureEvent.data as Record<string, unknown>)).toBe(false);
      });
    });

    describe('invalid data handling', () => {
      it('should return false for non-boolean fromMe', () => {
        expect(extractFromMe({ fromMe: 'true' })).toBe(false);
      });

      it('should return false for undefined fromMe', () => {
        expect(extractFromMe({ fromMe: undefined })).toBe(false);
      });

      it('should return false for numeric fromMe', () => {
        expect(extractFromMe({ fromMe: 1 })).toBe(false);
      });
    });

    describe('production event types without data', () => {
      it('should handle authenticated event (no data field)', () => {
        // authenticatedEvent has no data property
        expect(extractFromMe(undefined)).toBe(false);
      });

      it('should handle loading_screen event (no data field)', () => {
        // loadingScreenEvent has no data property
        expect(extractFromMe(undefined)).toBe(false);
      });
    });
  });
});
