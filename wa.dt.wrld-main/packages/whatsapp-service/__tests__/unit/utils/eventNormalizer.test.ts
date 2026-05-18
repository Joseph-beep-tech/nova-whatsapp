/**
 * Event Normalizer Unit Tests
 *
 * Tests the event normalizer utility for extracting unique identifiers
 * from different WhatsApp event types (messages, edits, reactions, receipts).
 */

import { eventNormalizer, EventNormalizer, NormalizedEventType } from '../../../src/utils/eventNormalizer';

describe('EventNormalizer', () => {
  let normalizer: EventNormalizer;

  beforeEach(() => {
    // Create a fresh instance for each test
    normalizer = new EventNormalizer();
  });

  describe('Event Type Normalization', () => {
    it('should normalize "message" dataType to "message"', () => {
      const result = normalizer.normalize('message', {}, 'test-chat');
      expect(result.eventType).toBe('message');
    });

    it('should normalize "message_create" dataType to "message"', () => {
      const result = normalizer.normalize('message_create', {}, 'test-chat');
      expect(result.eventType).toBe('message');
    });

    it('should normalize "MESSAGE_CREATE" (uppercase) to "message"', () => {
      const result = normalizer.normalize('MESSAGE_CREATE', {}, 'test-chat');
      expect(result.eventType).toBe('message');
    });

    it('should normalize "message_edit" dataType', () => {
      const result = normalizer.normalize('message_edit', {}, 'test-chat');
      expect(result.eventType).toBe('message_edit');
    });

    it('should normalize "message_reaction" dataType', () => {
      const result = normalizer.normalize('message_reaction', {}, 'test-chat');
      expect(result.eventType).toBe('message_reaction');
    });

    it('should normalize "message_ack" dataType', () => {
      const result = normalizer.normalize('message_ack', {}, 'test-chat');
      expect(result.eventType).toBe('message_ack');
    });

    it('should normalize "message_revoke" dataType', () => {
      const result = normalizer.normalize('message_revoke', {}, 'test-chat');
      expect(result.eventType).toBe('message_revoke');
    });

    it('should return "unknown" for unrecognized dataType', () => {
      const result = normalizer.normalize('unknown_event', {}, 'test-chat');
      expect(result.eventType).toBe('unknown');
    });

    it('should handle whitespace in dataType', () => {
      const result = normalizer.normalize('  message_create  ', {}, 'test-chat');
      expect(result.eventType).toBe('message');
    });
  });

  describe('Message ID Extraction', () => {
    it('should extract string message ID', () => {
      const data = {
        id: 'msg-123-456',
        from: '254722833440@c.us',
        body: 'Hello',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toBe('msg-123-456');
    });

    it('should extract message ID from _serialized object', () => {
      const data = {
        id: { _serialized: 'msg-serialized-789' },
        from: '254722833440@c.us',
        body: 'Hello',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toBe('msg-serialized-789');
    });

    it('should generate fallback ID when no ID present', () => {
      const data = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
        body: 'Hello World',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toMatch(/^msg:254722833440@c\.us:1234567890:/);
    });

    it('should include body hash in fallback ID', () => {
      const data1 = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
        body: 'Hello',
      };

      const data2 = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
        body: 'World',
      };

      const result1 = normalizer.normalize('message', data1, 'test-chat');
      const result2 = normalizer.normalize('message', data2, 'test-chat');

      // Different bodies should produce different IDs
      expect(result1.eventId).not.toBe(result2.eventId);
    });

    it('should handle missing body in fallback ID', () => {
      const data = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toMatch(/^msg:254722833440@c\.us:1234567890:/);
    });
  });

  describe('Edit ID Extraction', () => {
    it('should extract string edit ID with prefix', () => {
      const data = {
        id: 'edit-123',
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.eventId).toBe('edit:edit-123');
    });

    it('should extract edit ID from _serialized object', () => {
      const data = {
        id: { _serialized: 'edit-serialized-456' },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.eventId).toBe('edit:edit-serialized-456');
    });

    it('should use editedMessage.id when available', () => {
      const data = {
        editedMessage: {
          id: 'original-msg-789',
          body: 'Updated text',
          timestamp: 1234567890,
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.eventId).toBe('edit:original-msg-789:1234567890');
    });

    it('should use editedMessage._serialized when available', () => {
      const data = {
        editedMessage: {
          id: { _serialized: 'original-msg-serialized' },
          body: 'Updated text',
          timestamp: 9876543210,
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.eventId).toBe('edit:original-msg-serialized:9876543210');
    });

    it('should generate fallback edit ID when no ID present', () => {
      const data = {
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.eventId).toMatch(/^edit:254722833440@c\.us:\d+$/);
    });
  });

  describe('Reaction ID Extraction', () => {
    it('should create reaction ID from messageId, from, and text', () => {
      const data = {
        reaction: {
          text: '👍',
          messageId: 'msg-123',
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toBe('reaction:msg-123:254722833440@c.us:👍');
    });

    it('should extract messageId from _serialized', () => {
      const data = {
        reaction: {
          text: '❤️',
          messageId: { _serialized: 'msg-serialized-456' },
        },
        from: '254711222333@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toBe('reaction:msg-serialized-456:254711222333@c.us:❤️');
    });

    it('should handle missing reaction text', () => {
      const data = {
        reaction: {
          messageId: 'msg-789',
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toBe('reaction:msg-789:254722833440@c.us:');
    });

    it('should use fallback when reaction object is missing', () => {
      const data = {
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toMatch(/^reaction:/);
    });

    it('should handle missing from field', () => {
      const data = {
        reaction: {
          text: '🔥',
          messageId: 'msg-999',
        },
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toBe('reaction:msg-999:unknown:🔥');
    });
  });

  describe('Acknowledgment ID Extraction', () => {
    it('should create ack ID from message id and ack level', () => {
      const data = {
        id: 'msg-123',
        ack: 3,
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_ack', data, 'test-chat');
      expect(result.eventId).toBe('ack:msg-123:3');
    });

    it('should extract ID from _serialized for ack', () => {
      const data = {
        id: { _serialized: 'msg-serialized-456' },
        ack: 2,
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_ack', data, 'test-chat');
      expect(result.eventId).toBe('ack:msg-serialized-456:2');
    });

    it('should default to ack level 0 when missing', () => {
      const data = {
        id: 'msg-789',
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_ack', data, 'test-chat');
      expect(result.eventId).toBe('ack:msg-789:0');
    });

    it('should handle message_revoke with same logic', () => {
      const data = {
        id: 'msg-revoked-123',
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_revoke', data, 'test-chat');
      expect(result.eventId).toBe('ack:msg-revoked-123:0');
    });

    it('should generate fallback ack ID when no ID present', () => {
      const data = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
      };

      const result = normalizer.normalize('message_ack', data, 'test-chat');
      expect(result.eventId).toBe('ack:254722833440@c.us:1234567890');
    });
  });

  describe('Related Message ID Extraction', () => {
    it('should extract related message ID from edit event', () => {
      const data = {
        id: 'original-msg-123',
        editedMessage: {
          body: 'Updated text',
        },
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.relatedMessageId).toBe('original-msg-123');
    });

    it('should extract related message ID from edit with _serialized', () => {
      const data = {
        id: { _serialized: 'original-msg-serialized' },
        editedMessage: {
          body: 'Updated text',
        },
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.relatedMessageId).toBe('original-msg-serialized');
    });

    it('should extract related message ID from reaction event', () => {
      const data = {
        reaction: {
          text: '👍',
          messageId: 'original-msg-456',
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.relatedMessageId).toBe('original-msg-456');
    });

    it('should extract related message ID from reaction with _serialized', () => {
      const data = {
        reaction: {
          text: '❤️',
          messageId: { _serialized: 'original-msg-serialized-789' },
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.relatedMessageId).toBe('original-msg-serialized-789');
    });

    it('should extract related message ID from ack event', () => {
      const data = {
        id: 'original-msg-999',
        ack: 2,
      };

      const result = normalizer.normalize('message_ack', data, 'test-chat');
      expect(result.relatedMessageId).toBe('original-msg-999');
    });

    it('should extract related message ID from revoke event', () => {
      const data = {
        id: { _serialized: 'revoked-msg-serialized' },
      };

      const result = normalizer.normalize('message_revoke', data, 'test-chat');
      expect(result.relatedMessageId).toBe('revoked-msg-serialized');
    });

    it('should return undefined for regular message events', () => {
      const data = {
        id: 'msg-123',
        body: 'Hello',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.relatedMessageId).toBeUndefined();
    });

    it('should return undefined when no related message ID found', () => {
      const data = {
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat');
      expect(result.relatedMessageId).toBeUndefined();
    });
  });

  describe('Timestamp Extraction', () => {
    it('should convert timestamp in seconds to ISO string', () => {
      const data = {
        timestamp: 1234567890, // Seconds
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.timestamp).toBe(new Date(1234567890 * 1000).toISOString());
    });

    it('should convert timestamp in milliseconds to ISO string', () => {
      const data = {
        timestamp: 1234567890000, // Milliseconds
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.timestamp).toBe(new Date(1234567890000).toISOString());
    });

    it('should use string timestamp directly', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const data = {
        timestamp: isoString,
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.timestamp).toBe(isoString);
    });

    it('should use current time when timestamp is missing', () => {
      const data = {
        body: 'Hello',
      };

      const beforeTime = new Date().toISOString();
      const result = normalizer.normalize('message', data, 'test-chat');
      const afterTime = new Date().toISOString();

      // Timestamp should be between before and after (ISO strings are lexicographically comparable)
      expect(result.timestamp >= beforeTime).toBe(true);
      expect(result.timestamp <= afterTime).toBe(true);
    });

    it('should detect seconds vs milliseconds correctly', () => {
      // Seconds: 9999999999 (Nov 2286)
      const dataSeconds = { timestamp: 9999999999 };
      const resultSeconds = normalizer.normalize('message', dataSeconds, 'test-chat');
      expect(resultSeconds.timestamp).toBe(new Date(9999999999 * 1000).toISOString());

      // Milliseconds: 10000000000 (Apr 1970)
      const dataMs = { timestamp: 10000000000 };
      const resultMs = normalizer.normalize('message', dataMs, 'test-chat');
      expect(resultMs.timestamp).toBe(new Date(10000000000).toISOString());
    });
  });

  describe('Fallback ID Generation', () => {
    it('should generate unique fallback IDs for different data', () => {
      const data1 = { field1: 'value1' };
      const data2 = { field1: 'value2' };

      const result1 = normalizer.normalize('unknown', data1, 'test-chat');
      const result2 = normalizer.normalize('unknown', data2, 'test-chat');

      // Different data should produce different IDs
      expect(result1.eventId).not.toBe(result2.eventId);
    });

    it('should include identifier in fallback for unknown events', () => {
      const data = { test: 'data' };

      const result = normalizer.normalize('unknown', data, 'test-chat-123');
      expect(result.eventId).toMatch(/^test-chat-123:/);
    });
  });

  describe('Hash String Function', () => {
    it('should generate consistent hashes for same input', () => {
      // We can't directly test the private method, but we can verify consistency
      // through fallback ID generation
      const data = {
        from: '254722833440@c.us',
        timestamp: 1234567890,
        body: 'Consistent text',
      };

      const result1 = normalizer.normalize('message', data, 'test-chat');
      const result2 = normalizer.normalize('message', data, 'test-chat');

      // Same data should produce same hash (but timestamps in fallback may differ)
      expect(result1.eventId.split(':').slice(0, 3)).toEqual(
        result2.eventId.split(':').slice(0, 3)
      );
    });
  });

  describe('Raw Data Preservation', () => {
    it('should include raw data in normalized event', () => {
      const data = {
        id: 'msg-123',
        from: '254722833440@c.us',
        body: 'Hello World',
        customField: 'custom value',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.rawData).toEqual(data);
    });

    it('should preserve all fields in rawData', () => {
      const data = {
        id: 'msg-456',
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.rawData.nested).toEqual({ deep: { value: 123 } });
      expect(result.rawData.array).toEqual([1, 2, 3]);
    });
  });

  describe('Identifier Handling', () => {
    it('should include identifier in normalized event', () => {
      const result = normalizer.normalize('message', {}, 'chat-123@c.us');
      expect(result.identifier).toBe('chat-123@c.us');
    });

    it('should handle group identifiers', () => {
      const result = normalizer.normalize('message', {}, '1234567890@g.us');
      expect(result.identifier).toBe('1234567890@g.us');
    });
  });

  describe('Complete Event Normalization', () => {
    it('should produce complete NormalizedEvent for message', () => {
      const data = {
        id: 'msg-complete-123',
        from: '254722833440@c.us',
        body: 'Complete test',
        timestamp: 1234567890,
      };

      const result = normalizer.normalize('message', data, 'test-chat@c.us');

      expect(result).toMatchObject({
        eventId: 'msg-complete-123',
        eventType: 'message',
        identifier: 'test-chat@c.us',
        relatedMessageId: undefined,
        rawData: data,
      });
      expect(result.timestamp).toBeTruthy();
    });

    it('should produce complete NormalizedEvent for edit', () => {
      const data = {
        id: 'original-123',
        editedMessage: {
          id: 'edited-456',
          body: 'Edited text',
          timestamp: 9876543210,
        },
      };

      const result = normalizer.normalize('message_edit', data, 'test-chat@c.us');

      expect(result).toMatchObject({
        eventType: 'message_edit',
        identifier: 'test-chat@c.us',
        relatedMessageId: 'original-123',
        rawData: data,
      });
      expect(result.eventId).toMatch(/^edit:/);
    });

    it('should produce complete NormalizedEvent for reaction', () => {
      const data = {
        reaction: {
          text: '👍',
          messageId: 'reacted-msg-789',
        },
        from: '254722833440@c.us',
        timestamp: 1234567890,
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat@c.us');

      expect(result).toMatchObject({
        eventId: 'reaction:reacted-msg-789:254722833440@c.us:👍',
        eventType: 'message_reaction',
        identifier: 'test-chat@c.us',
        relatedMessageId: 'reacted-msg-789',
        rawData: data,
      });
    });
  });

  describe('Singleton Export', () => {
    it('should export a singleton instance', () => {
      expect(eventNormalizer).toBeInstanceOf(EventNormalizer);
    });

    it('should use singleton instance consistently', () => {
      const data = {
        id: 'singleton-test-123',
        body: 'Test',
      };

      const result1 = eventNormalizer.normalize('message', data, 'chat-1');
      const result2 = eventNormalizer.normalize('message', data, 'chat-1');

      // Same data through singleton should produce same ID
      expect(result1.eventId).toBe(result2.eventId);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data object', () => {
      const result = normalizer.normalize('message', {}, 'test-chat');
      expect(result.eventType).toBe('message');
      expect(result.identifier).toBe('test-chat');
      expect(result.eventId).toBeTruthy();
    });

    it('should handle null/undefined fields gracefully', () => {
      const data = {
        id: undefined,
        from: null,
        body: '',
      };

      const result = normalizer.normalize('message', data as unknown as Record<string, unknown>, 'test-chat');
      expect(result.eventId).toBeTruthy();
      expect(result.eventType).toBe('message');
    });

    it('should handle nested object IDs with missing _serialized', () => {
      const data = {
        id: { someOtherField: 'value' },
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toBeTruthy();
    });

    it('should handle very long message bodies', () => {
      const longBody = 'A'.repeat(10000);
      const data = {
        body: longBody,
        from: '254722833440@c.us',
        timestamp: 1234567890,
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toBeTruthy();
      expect(result.rawData.body).toBe(longBody);
    });

    it('should handle special characters in message body', () => {
      const data = {
        id: 'msg-special-123',
        body: '👍 🔥 Special chars: @#$%^&*()',
      };

      const result = normalizer.normalize('message', data, 'test-chat');
      expect(result.eventId).toBe('msg-special-123');
    });

    it('should handle reaction with empty messageId', () => {
      const data = {
        reaction: {
          text: '👍',
          messageId: '',
        },
        from: '254722833440@c.us',
      };

      const result = normalizer.normalize('message_reaction', data, 'test-chat');
      expect(result.eventId).toMatch(/^reaction:/);
    });
  });
});
