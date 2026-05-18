/**
 * Deduplication Service Unit Tests
 *
 * Tests the event deduplication service for Redis-backed and in-memory
 * duplicate detection, metrics tracking, and configuration management.
 */

import { DeduplicationService } from '../../../src/services/deduplicationService';
import { eventNormalizer } from '../../../src/utils/eventNormalizer';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    exists: jest.fn().mockResolvedValue(0),
    setex: jest.fn().mockResolvedValue('OK'),
    scanStream: jest.fn().mockReturnValue({
      on: jest.fn(),
    }),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    status: 'ready',
  }));
});

// Mock config
jest.mock('../../../src/shared/config', () => ({
  queueConfig: {
    enabled: false, // Default to disabled for in-memory tests
    redisUrl: 'redis://localhost:6379',
  },
}));

describe('DeduplicationService', () => {
  let service: DeduplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create fresh service instance with in-memory cache for most tests
    service = new DeduplicationService({ useRedis: false });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with in-memory cache when Redis is disabled', async () => {
      const inMemoryService = new DeduplicationService({ useRedis: false });
      await inMemoryService.initialize();

      expect(inMemoryService.isEnabled()).toBe(false);
      await inMemoryService.shutdown();
    });

    it('should initialize with Redis when enabled', async () => {
      const redisService = new DeduplicationService({ useRedis: true });
      await redisService.initialize();

      expect(redisService.isEnabled()).toBe(true);
      await redisService.shutdown();
    });

    it('should not re-initialize when already initialized', async () => {
      await service.initialize();
      await service.initialize(); // Second call should be no-op

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should use custom configuration', () => {
      const customService = new DeduplicationService({
        windowSeconds: 600,
        useRedis: false,
        keyPrefix: 'custom:',
      });

      const config = customService.getConfig();
      expect(config.windowSeconds).toBe(600);
      expect(config.useRedis).toBe(false);
      expect(config.keyPrefix).toBe('custom:');
    });

    it('should use default configuration when none provided', () => {
      const defaultService = new DeduplicationService();
      const config = defaultService.getConfig();

      expect(config.windowSeconds).toBe(300); // 5 minutes
      expect(config.keyPrefix).toBe('dedup:event:');
    });
  });

  describe('Duplicate Detection - In-Memory', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should detect duplicate message within window', async () => {
      const data = {
        id: 'msg123',
        from: '254722833440@c.us',
        body: 'Hello',
        timestamp: Date.now() / 1000,
      };

      // First check - not duplicate
      const result1 = await service.checkDuplicate('message', data, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      // Second check - should be duplicate
      const result2 = await service.checkDuplicate('message', data, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(true);
      expect(result2.reason).toContain('already seen');
    });

    it('should allow different messages from same chat', async () => {
      const data1 = {
        id: 'msg123',
        from: '254722833440@c.us',
        body: 'Hello',
        timestamp: Date.now() / 1000,
      };

      const data2 = {
        id: 'msg456',
        from: '254722833440@c.us',
        body: 'Goodbye',
        timestamp: Date.now() / 1000,
      };

      const result1 = await service.checkDuplicate('message', data1, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      const result2 = await service.checkDuplicate('message', data2, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(false);
    });

    it('should allow same message from different chats', async () => {
      // Different chats produce different message IDs from WhatsApp,
      // so use distinct IDs to reflect real-world behavior
      const data1 = {
        id: 'msg123_chat1',
        from: '254722833440@c.us',
        body: 'Hello',
        timestamp: Date.now() / 1000,
      };

      const data2 = {
        id: 'msg123_chat2',
        from: '254711222333@c.us',
        body: 'Hello',
        timestamp: Date.now() / 1000,
      };

      const result1 = await service.checkDuplicate('message', data1, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      // Different message ID means different event, even if body is the same
      const result2 = await service.checkDuplicate('message', data2, '254711222333@c.us');
      expect(result2.isDuplicate).toBe(false);
    });

    it('should handle message edits as separate events', async () => {
      const editData = {
        id: 'msg123',
        editedMessage: {
          id: 'msg123',
          body: 'Edited text',
          timestamp: Date.now() / 1000,
        },
        from: '254722833440@c.us',
      };

      const result1 = await service.checkDuplicate('message_edit', editData, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);
      expect(result1.event.eventType).toBe('message_edit');
      expect(result1.relatedMessageId).toBe('msg123');

      // Same edit again should be duplicate
      const result2 = await service.checkDuplicate('message_edit', editData, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(true);
    });

    it('should handle message reactions', async () => {
      const reactionData = {
        id: 'reaction123',
        reaction: {
          text: '👍',
          messageId: 'msg123',
        },
        from: '254722833440@c.us',
        timestamp: Date.now() / 1000,
      };

      const result1 = await service.checkDuplicate('message_reaction', reactionData, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);
      expect(result1.event.eventType).toBe('message_reaction');
      expect(result1.relatedMessageId).toBe('msg123');

      // Same reaction again should be duplicate
      const result2 = await service.checkDuplicate('message_reaction', reactionData, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(true);
    });

    it('should handle delivery receipts (acks)', async () => {
      const ackData = {
        id: 'msg123',
        ack: 2, // Delivered
        from: '254722833440@c.us',
        timestamp: Date.now() / 1000,
      };

      const result1 = await service.checkDuplicate('message_ack', ackData, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);
      expect(result1.event.eventType).toBe('message_ack');
      expect(result1.relatedMessageId).toBe('msg123');

      // Same ack again should be duplicate
      const result2 = await service.checkDuplicate('message_ack', ackData, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(true);
    });

    it('should include normalized event details in result', async () => {
      const data = {
        id: 'msg123',
        from: '254722833440@c.us',
        body: 'Test message',
        timestamp: Date.now() / 1000,
      };

      const result = await service.checkDuplicate('message', data, '254722833440@c.us');

      expect(result.event).toBeDefined();
      expect(result.event.eventId).toBe('msg123');
      expect(result.event.eventType).toBe('message');
      expect(result.event.identifier).toBe('254722833440@c.us');
      expect(result.event.timestamp).toBeDefined();
    });
  });

  describe('Metrics Tracking', () => {
    beforeEach(async () => {
      await service.initialize();
      service.resetMetrics();
    });

    it('should track total events processed', async () => {
      const data1 = { id: 'msg1', from: '254722833440@c.us', body: 'Hi' };
      const data2 = { id: 'msg2', from: '254722833440@c.us', body: 'Bye' };

      await service.checkDuplicate('message', data1, '254722833440@c.us');
      await service.checkDuplicate('message', data2, '254722833440@c.us');

      const metrics = await service.getMetrics();
      expect(metrics.totalEvents).toBe(2);
    });

    it('should track duplicate counts', async () => {
      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };

      await service.checkDuplicate('message', data, '254722833440@c.us');
      await service.checkDuplicate('message', data, '254722833440@c.us'); // Duplicate
      await service.checkDuplicate('message', data, '254722833440@c.us'); // Duplicate

      const metrics = await service.getMetrics();
      expect(metrics.totalEvents).toBe(3);
      expect(metrics.duplicatesDetected).toBe(2);
    });

    it('should calculate overall duplicate rate', async () => {
      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };

      await service.checkDuplicate('message', data, '254722833440@c.us');
      await service.checkDuplicate('message', data, '254722833440@c.us'); // 1 duplicate

      const metrics = await service.getMetrics();
      expect(metrics.duplicateRate).toBe(50); // 1/2 = 50%
    });

    it('should track metrics by event type', async () => {
      const messageData = { id: 'msg1', from: '254722833440@c.us', body: 'Hi' };
      const editData = { id: 'msg2', editedMessage: { id: 'msg2', body: 'Edited' } };

      await service.checkDuplicate('message', messageData, '254722833440@c.us');
      await service.checkDuplicate('message', messageData, '254722833440@c.us'); // Dup
      await service.checkDuplicate('message_edit', editData, '254722833440@c.us');

      const metrics = await service.getMetrics();

      expect(metrics.byEventType.message).toBeDefined();
      expect(metrics.byEventType.message.total).toBe(2);
      expect(metrics.byEventType.message.duplicates).toBe(1);
      expect(metrics.byEventType.message.duplicateRate).toBe(50);

      expect(metrics.byEventType.message_edit).toBeDefined();
      expect(metrics.byEventType.message_edit.total).toBe(1);
      expect(metrics.byEventType.message_edit.duplicates).toBe(0);
      expect(metrics.byEventType.message_edit.duplicateRate).toBe(0);
    });

    it('should track uptime', async () => {
      const metrics1 = await service.getMetrics();
      expect(metrics1.uptimeSeconds).toBeGreaterThanOrEqual(0);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics2 = await service.getMetrics();
      expect(metrics2.uptimeSeconds).toBeGreaterThanOrEqual(metrics1.uptimeSeconds);
    });

    it('should track Redis connection status', async () => {
      const metrics = await service.getMetrics();
      // In-memory mode, Redis should not be connected
      expect(metrics.redisConnected).toBe(false);
    });

    it('should handle zero events gracefully', async () => {
      const metrics = await service.getMetrics();

      expect(metrics.totalEvents).toBe(0);
      expect(metrics.duplicatesDetected).toBe(0);
      expect(metrics.duplicateRate).toBe(0);
      expect(metrics.byEventType).toEqual({});
    });

    it('should reset metrics correctly', async () => {
      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };
      await service.checkDuplicate('message', data, '254722833440@c.us');

      let metrics = await service.getMetrics();
      expect(metrics.totalEvents).toBe(1);

      service.resetMetrics();

      metrics = await service.getMetrics();
      expect(metrics.totalEvents).toBe(0);
      expect(metrics.duplicatesDetected).toBe(0);
      expect(metrics.byEventType).toEqual({});
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = service.getConfig();

      expect(config.windowSeconds).toBeDefined();
      expect(config.useRedis).toBeDefined();
      expect(config.keyPrefix).toBeDefined();
    });

    it('should update deduplication window', () => {
      service.setDeduplicationWindow(600);

      const config = service.getConfig();
      expect(config.windowSeconds).toBe(600);
    });

    it('should accept custom window at initialization', () => {
      const customService = new DeduplicationService({ windowSeconds: 120 });
      const config = customService.getConfig();

      expect(config.windowSeconds).toBe(120);
    });
  });

  describe('Cache Management - In-Memory', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should clear cache', async () => {
      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };

      // Add event
      await service.checkDuplicate('message', data, '254722833440@c.us');

      // Clear cache
      await service.clearCache();

      // Should not be duplicate after clear
      const result = await service.checkDuplicate('message', data, '254722833440@c.us');
      expect(result.isDuplicate).toBe(false);
    });

    it('should get cache size', async () => {
      const data1 = { id: 'msg1', from: '254722833440@c.us', body: 'Test1' };
      const data2 = { id: 'msg2', from: '254722833440@c.us', body: 'Test2' };

      await service.checkDuplicate('message', data1, '254722833440@c.us');
      await service.checkDuplicate('message', data2, '254722833440@c.us');

      const size = await service.getCacheSize();
      expect(size).toBe(2);
    });

    it('should expire old entries from memory cache', async () => {
      // Create service with very short window
      const shortWindowService = new DeduplicationService({
        useRedis: false,
        windowSeconds: 1, // 1 second
      });
      await shortWindowService.initialize();

      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };

      // Add event
      const result1 = await shortWindowService.checkDuplicate('message', data, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      // Wait for expiration (plus a bit for safety)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should not be duplicate after expiration
      const result2 = await shortWindowService.checkDuplicate('message', data, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(false);

      await shortWindowService.shutdown();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.shutdown();

      // Should be able to call shutdown multiple times
      await service.shutdown();
    });

    it('should clear memory cache on shutdown', async () => {
      await service.initialize();

      const data = { id: 'msg1', from: '254722833440@c.us', body: 'Test' };
      await service.checkDuplicate('message', data, '254722833440@c.us');

      await service.shutdown();

      const size = await service.getCacheSize();
      expect(size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle events with missing ID fields', async () => {
      const data = {
        from: '254722833440@c.us',
        body: 'Test without ID',
        timestamp: Date.now() / 1000,
      };

      const result = await service.checkDuplicate('message', data, '254722833440@c.us');

      expect(result.isDuplicate).toBe(false);
      expect(result.event.eventId).toBeDefined();
      expect(result.event.eventId).toContain('msg:');
    });

    it('should handle events with nested ID structures', async () => {
      const data = {
        id: {
          _serialized: 'msg123_serialized',
        },
        from: '254722833440@c.us',
        body: 'Test',
      };

      const result = await service.checkDuplicate('message', data, '254722833440@c.us');

      expect(result.isDuplicate).toBe(false);
      expect(result.event.eventId).toBe('msg123_serialized');
    });

    it('should handle unknown event types', async () => {
      const data = {
        someField: 'someValue',
      };

      const result = await service.checkDuplicate('unknown_event', data, '254722833440@c.us');

      expect(result.isDuplicate).toBe(false);
      expect(result.event.eventType).toBe('unknown');
      expect(result.event.eventId).toBeDefined();
    });

    it('should handle empty data objects', async () => {
      const data = {};

      const result = await service.checkDuplicate('message', data, '254722833440@c.us');

      expect(result.isDuplicate).toBe(false);
      expect(result.event.eventId).toBeDefined();
    });

    it('should handle reactions without message ID', async () => {
      const reactionData = {
        id: 'reaction123',
        reaction: {
          text: '👍',
          // Missing messageId
        },
        from: '254722833440@c.us',
      };

      const result = await service.checkDuplicate('message_reaction', reactionData, '254722833440@c.us');

      expect(result.isDuplicate).toBe(false);
      expect(result.event.eventType).toBe('message_reaction');
    });

    it('should handle different reactions to same message', async () => {
      const reaction1 = {
        id: 'r1',
        reaction: { text: '👍', messageId: 'msg123' },
        from: '254722833440@c.us',
      };

      const reaction2 = {
        id: 'r2',
        reaction: { text: '❤️', messageId: 'msg123' },
        from: '254722833440@c.us',
      };

      const result1 = await service.checkDuplicate('message_reaction', reaction1, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      // Different reaction to same message should not be duplicate
      const result2 = await service.checkDuplicate('message_reaction', reaction2, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(false);
    });

    it('should handle multiple ack levels for same message', async () => {
      const ack1 = {
        id: 'msg123',
        ack: 1, // Sent
        from: '254722833440@c.us',
      };

      const ack2 = {
        id: 'msg123',
        ack: 2, // Delivered
        from: '254722833440@c.us',
      };

      const result1 = await service.checkDuplicate('message_ack', ack1, '254722833440@c.us');
      expect(result1.isDuplicate).toBe(false);

      // Different ack level should not be duplicate (different event ID)
      const result2 = await service.checkDuplicate('message_ack', ack2, '254722833440@c.us');
      expect(result2.isDuplicate).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return false when Redis is disabled', () => {
      const inMemoryService = new DeduplicationService({ useRedis: false });
      expect(inMemoryService.isEnabled()).toBe(false);
    });

    it('should return true when Redis is enabled', () => {
      const redisService = new DeduplicationService({ useRedis: true });
      expect(redisService.isEnabled()).toBe(true);
    });
  });
});
