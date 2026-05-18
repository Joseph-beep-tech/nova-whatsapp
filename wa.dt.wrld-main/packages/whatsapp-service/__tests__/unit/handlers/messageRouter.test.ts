/**
 * Message Router Handler Unit Tests
 *
 * Tests the messageRouter logic migrated from n8n Router workflow.
 */

import { messageRouter, MessageRouterService } from '../../../src/handlers/messageRouter';
import { RoutableEvent } from '../../../src/types/routing';
import { deduplicationService } from '../../../src/services/deduplicationService';

// Mock the deduplication service
jest.mock('../../../src/services/deduplicationService', () => ({
  deduplicationService: {
    checkDuplicate: jest.fn(),
    clearCache: jest.fn(),
    getCacheSize: jest.fn(),
  },
}));

// Mock the config to disable deduplication service by default for backward compatibility
jest.mock('../../../src/shared/config', () => ({
  deduplicationConfig: {
    enabled: false,
    windowSeconds: 300,
    useRedis: false,
    keyPrefix: 'dedup:event:',
  },
}));

describe('MessageRouter', () => {
  let router: MessageRouterService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh instance for each test with deduplication service disabled
    router = new MessageRouterService({ useDeduplicationService: false });
  });

  describe('Feedback Loop Prevention', () => {
    it('should skip messages from the bot itself (fromMe: true)', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: true,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('own_message');
      expect(decision.fromMe).toBe(true);
    });

    it('should process messages from users (fromMe: false)', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(true);
      expect(decision.skipReason).toBeUndefined();
      expect(decision.fromMe).toBe(false);
    });
  });

  describe('Message Deduplication', () => {
    it('should skip duplicate messages within 60 seconds', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // First message should be processed
      const firstDecision = await router.route(event);
      expect(firstDecision.shouldProcess).toBe(true);

      // Second identical message should be skipped
      const secondDecision = await router.route(event);
      expect(secondDecision.shouldProcess).toBe(false);
      expect(secondDecision.skipReason).toBe('duplicate');
    });

    it('should process same message from different chat IDs', async () => {
      const event1: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const event2: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254711222333@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254711222333',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const firstDecision = await router.route(event1);
      expect(firstDecision.shouldProcess).toBe(true);

      const secondDecision = await router.route(event2);
      expect(secondDecision.shouldProcess).toBe(true);
    });

    it('should process different messages from same chat ID', async () => {
      const event1: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const event2: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Goodbye',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const firstDecision = await router.route(event1);
      expect(firstDecision.shouldProcess).toBe(true);

      const secondDecision = await router.route(event2);
      expect(secondDecision.shouldProcess).toBe(true);
    });
  });

  describe('Tag Detection', () => {
    it('should detect SOMO tag (case insensitive)', () => {
      expect(router.detectTags('somo')).toContain('SOMO');
      expect(router.detectTags('SOMO')).toContain('SOMO');
      expect(router.detectTags('Somo')).toContain('SOMO');
      expect(router.detectTags('I want SOMO training')).toContain('SOMO');
    });

    it('should detect HELLO_TRACTOR tag (case insensitive)', () => {
      expect(router.detectTags('hello_tractor')).toContain('HELLO_TRACTOR');
      expect(router.detectTags('HELLO_TRACTOR')).toContain('HELLO_TRACTOR');
      expect(router.detectTags('Hello_Tractor')).toContain('HELLO_TRACTOR');
    });

    it('should detect HELLO TRACTOR with space', () => {
      expect(router.detectTags('hello tractor')).toContain('HELLO_TRACTOR');
      expect(router.detectTags('HELLO TRACTOR')).toContain('HELLO_TRACTOR');
    });

    it('should detect multiple tags in one message', () => {
      const tags = router.detectTags('I want SOMO and hello tractor');
      expect(tags).toContain('SOMO');
      expect(tags).toContain('HELLO_TRACTOR');
    });

    it('should return empty array for no tag matches', () => {
      expect(router.detectTags('Hello world')).toEqual([]);
      expect(router.detectTags('What is the weather?')).toEqual([]);
    });

    it('should include detected tags in routing decision', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'I want to join SOMO',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(true);
      expect(decision.detectedTags).toContain('SOMO');
    });
  });

  describe('Keyword Detection', () => {
    it('should detect echo keyword with content', () => {
      expect(router.detectKeywords('echo hello')).toContain('echo');
      expect(router.detectKeywords('ECHO test')).toContain('echo');
      expect(router.detectKeywords('Echo world')).toContain('echo');
    });

    it('should not detect echo without content', () => {
      expect(router.detectKeywords('echo')).not.toContain('echo');
      expect(router.detectKeywords('echo ')).not.toContain('echo');
    });

    it('should detect ping keyword', () => {
      expect(router.detectKeywords('ping')).toContain('ping');
      expect(router.detectKeywords('PING')).toContain('ping');
      expect(router.detectKeywords('/ping')).toContain('ping');
    });

    it('should detect help keyword', () => {
      expect(router.detectKeywords('help')).toContain('help');
      expect(router.detectKeywords('HELP')).toContain('help');
      expect(router.detectKeywords('/help')).toContain('help');
    });

    it('should detect status keyword', () => {
      expect(router.detectKeywords('/status')).toContain('status');
    });

    it('should include detected keywords in routing decision', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'echo testing 123',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(true);
      expect(decision.keywords).toContain('echo');
    });
  });

  describe('Group Message Detection', () => {
    it('should detect group messages by @g.us suffix', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello group',
          fromMe: false,
        },
        identifier: '1234567890',
        platform: 'g.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.isGroup).toBe(true);
    });

    it('should detect direct messages by @c.us suffix', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello direct',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.isGroup).toBe(false);
    });
  });

  describe('Event Type Filtering', () => {
    it('should skip non-message events', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'status_change',
        data: {
          status: 'connected',
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('invalid_event');
    });

    it('should process message_create events', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message_create',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.shouldProcess).toBe(true);
    });
  });

  describe('Singleton Export', () => {
    it('should export a singleton instance', () => {
      expect(messageRouter).toBeInstanceOf(MessageRouterService);
    });
  });

  describe('Custom Tag Patterns', () => {
    it('should allow registering custom tag patterns', () => {
      router.registerTagPattern('TEST', /\btest\s*tag\b/i);

      expect(router.detectTags('I want test tag')).toContain('TEST');
      expect(router.detectTags('TEST TAG please')).toContain('TEST');
    });
  });

  describe('Message Body Extraction', () => {
    it('should extract message body from event data', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello World',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.messageBody).toBe('Hello World');
    });

    it('should handle nested message body', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          message: {
            body: 'Nested body',
          },
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await router.route(event);

      expect(decision.messageBody).toBe('Nested body');
    });
  });

  describe('Deduplication Service Integration', () => {
    let serviceRouter: MessageRouterService;

    beforeEach(() => {
      jest.clearAllMocks();
      // Create router with deduplication service enabled
      serviceRouter = new MessageRouterService({ useDeduplicationService: true });
    });

    it('should use deduplication service when enabled', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;
      mockCheckDuplicate.mockResolvedValue({
        isDuplicate: false,
        event: {
          eventId: 'msg123',
          eventType: 'message',
          identifier: '254722833440',
          timestamp: new Date().toISOString(),
          rawData: {},
        },
      });

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          id: 'msg123',
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      expect(mockCheckDuplicate).toHaveBeenCalledWith('message', event.data, event.identifier);
      expect(decision.shouldProcess).toBe(true);
    });

    it('should detect duplicates via deduplication service', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;
      mockCheckDuplicate.mockResolvedValue({
        isDuplicate: true,
        event: {
          eventId: 'msg123',
          eventType: 'message',
          identifier: '254722833440',
          timestamp: new Date().toISOString(),
          rawData: {},
        },
        reason: 'Duplicate event ID',
      });

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          id: 'msg123',
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('duplicate');
    });

    it('should filter message_edit events as invalid before deduplication', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message_edit',
        data: {
          id: 'edit123',
          editedMessage: {
            id: 'msg123',
            body: 'Updated message',
          },
          from: '254722833440@c.us',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      // message_edit is not in the valid event types list, so it's filtered before dedup
      expect(mockCheckDuplicate).not.toHaveBeenCalled();
      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('invalid_event');
    });

    it('should filter reaction events as invalid before deduplication', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message_reaction',
        data: {
          id: 'reaction123',
          reaction: {
            text: '👍',
            messageId: 'msg123',
          },
          from: '254722833440@c.us',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      // message_reaction is not in the valid event types list, so it's filtered before dedup
      expect(mockCheckDuplicate).not.toHaveBeenCalled();
      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('invalid_event');
    });

    it('should filter duplicate reaction events as invalid (before dedup check)', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message_reaction',
        data: {
          id: 'reaction123',
          reaction: {
            text: '👍',
            messageId: 'msg123',
          },
          from: '254722833440@c.us',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      // message_reaction is filtered as invalid_event before dedup is reached
      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('invalid_event');
    });

    it('should filter message_ack events as invalid before deduplication', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message_ack',
        data: {
          id: 'msg123',
          ack: 2,
          from: '254722833440@c.us',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      const decision = await serviceRouter.route(event);

      // message_ack is not in the valid event types list, so it's filtered before dedup
      expect(mockCheckDuplicate).not.toHaveBeenCalled();
      expect(decision.shouldProcess).toBe(false);
      expect(decision.skipReason).toBe('invalid_event');
    });
  });

  describe('Deduplication Service Fallback', () => {
    let serviceRouter: MessageRouterService;

    beforeEach(() => {
      jest.clearAllMocks();
      // Create router with deduplication service enabled
      serviceRouter = new MessageRouterService({ useDeduplicationService: true });
    });

    it('should fall back to in-memory deduplication when service fails', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;
      mockCheckDuplicate.mockRejectedValue(new Error('Redis connection failed'));

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // First message should be processed (falls back to in-memory)
      const firstDecision = await serviceRouter.route(event);
      expect(firstDecision.shouldProcess).toBe(true);

      // Second identical message should be detected as duplicate by in-memory cache
      const secondDecision = await serviceRouter.route(event);
      expect(secondDecision.shouldProcess).toBe(false);
      expect(secondDecision.skipReason).toBe('duplicate');
    });

    it('should continue processing when service throws error', async () => {
      const mockCheckDuplicate = deduplicationService.checkDuplicate as jest.Mock;
      mockCheckDuplicate.mockRejectedValue(new Error('Service error'));

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // Should not throw, should fall back gracefully
      const decision = await serviceRouter.route(event);
      expect(decision.shouldProcess).toBe(true);
    });

    it('should use in-memory deduplication when service is disabled', async () => {
      // Create router with service explicitly disabled
      const inMemoryRouter = new MessageRouterService({ useDeduplicationService: false });

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // First message should be processed
      const firstDecision = await inMemoryRouter.route(event);
      expect(firstDecision.shouldProcess).toBe(true);

      // Second identical message should be skipped
      const secondDecision = await inMemoryRouter.route(event);
      expect(secondDecision.shouldProcess).toBe(false);
      expect(secondDecision.skipReason).toBe('duplicate');

      // Deduplication service should never be called
      expect(deduplicationService.checkDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('Cache Management Methods', () => {
    let serviceRouter: MessageRouterService;

    beforeEach(() => {
      jest.clearAllMocks();
      serviceRouter = new MessageRouterService({ useDeduplicationService: true });
    });

    it('should clear deduplication cache via service when enabled', async () => {
      const mockClearCache = deduplicationService.clearCache as jest.Mock;
      mockClearCache.mockResolvedValue(undefined);

      await serviceRouter.clearDeduplicationCache();

      expect(mockClearCache).toHaveBeenCalled();
    });

    it('should handle errors when clearing cache via service', async () => {
      const mockClearCache = deduplicationService.clearCache as jest.Mock;
      mockClearCache.mockRejectedValue(new Error('Cache clear failed'));

      // Should not throw
      await expect(serviceRouter.clearDeduplicationCache()).resolves.not.toThrow();
    });

    it('should get cache size via service when enabled', async () => {
      const mockGetCacheSize = deduplicationService.getCacheSize as jest.Mock;
      mockGetCacheSize.mockResolvedValue(42);

      const size = await serviceRouter.getDeduplicationCacheSize();

      expect(mockGetCacheSize).toHaveBeenCalled();
      expect(size).toBe(42);
    });

    it('should handle errors when getting cache size via service', async () => {
      const mockGetCacheSize = deduplicationService.getCacheSize as jest.Mock;
      mockGetCacheSize.mockRejectedValue(new Error('Cache size failed'));

      // Should fall back to in-memory size (0 for fresh router)
      const size = await serviceRouter.getDeduplicationCacheSize();

      expect(size).toBe(0);
    });

    it('should clear in-memory cache when service is disabled', async () => {
      const inMemoryRouter = new MessageRouterService({ useDeduplicationService: false });

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // Add an entry to the cache
      await inMemoryRouter.route(event);

      // Clear the cache
      await inMemoryRouter.clearDeduplicationCache();

      // Same message should now be processed (cache was cleared)
      const decision = await inMemoryRouter.route(event);
      expect(decision.shouldProcess).toBe(true);

      // Service should not be called
      expect(deduplicationService.clearCache).not.toHaveBeenCalled();
    });

    it('should get in-memory cache size when service is disabled', async () => {
      const inMemoryRouter = new MessageRouterService({ useDeduplicationService: false });

      const event: RoutableEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: {
          from: '254722833440@c.us',
          body: 'Hello',
          fromMe: false,
        },
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        receivedAt: new Date().toISOString(),
      };

      // Initial size should be 0
      let size = await inMemoryRouter.getDeduplicationCacheSize();
      expect(size).toBe(0);

      // Add an entry
      await inMemoryRouter.route(event);

      // Size should now be 1
      size = await inMemoryRouter.getDeduplicationCacheSize();
      expect(size).toBe(1);

      // Service should not be called
      expect(deduplicationService.getCacheSize).not.toHaveBeenCalled();
    });
  });
});
