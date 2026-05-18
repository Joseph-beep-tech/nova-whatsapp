/**
 * Event Router Service Unit Tests
 *
 * Tests the event routing service to ensure proper handling of
 * undefined data, tag configurations, and routing logic.
 */

import { eventRouter } from '../../../src/services/eventRouter';
import { stateManager } from '../../../src/utils/stateManager';
import { messageRouter } from '../../../src/handlers/messageRouter';
import { QueuedEvent } from '../../../src/services/eventQueue';
import {
  messageEvent,
  emptyDataEvent,
} from '../../fixtures/eventTestData';

// Mock the state manager
jest.mock('../../../src/utils/stateManager', () => ({
  stateManager: {
    getConfig: jest.fn(),
    setConfig: jest.fn(),
    deleteConfig: jest.fn(),
    getConfigsByPrefix: jest.fn(),
    getUser: jest.fn(),
    getWebhooks: jest.fn(),
    registerUser: jest.fn(),
  },
}));

// Mock the message router
jest.mock('../../../src/handlers/messageRouter', () => ({
  messageRouter: {
    route: jest.fn(),
  },
}));

// Mock the alert service
jest.mock('../../../src/services/alertService', () => ({
  alertService: {
    isEnabled: jest.fn().mockReturnValue(false),
    createAlert: jest.fn().mockResolvedValue({ success: true }),
    listAlerts: jest.fn().mockResolvedValue({ success: true, alerts: [] }),
  },
}));

// Mock axios for n8n webhook tests
jest.mock('axios', () => ({
  post: jest.fn(),
}));

const mockStateManager = stateManager as jest.Mocked<typeof stateManager>;
const mockMessageRouter = messageRouter as jest.Mocked<typeof messageRouter>;

describe('EventRouterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns
    mockStateManager.getConfig.mockResolvedValue(undefined);
    mockStateManager.getUser.mockResolvedValue(null);
    mockStateManager.getWebhooks.mockResolvedValue([]);
    mockStateManager.getConfigsByPrefix.mockResolvedValue({});
    mockStateManager.registerUser.mockResolvedValue({
      user: {
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: [],
        welcomedTags: [],
        firstContactAt: new Date().toISOString(),
        lastContactAt: new Date().toISOString(),
        messageCount: 1,
      },
      isNew: false,
      newTags: [],
    });
    // Default: message router allows processing, no tags detected
    mockMessageRouter.route.mockResolvedValue({
      shouldProcess: true,
      detectedTags: [],
      keywords: [],
      isGroup: false,
      messageBody: '',
      fromMe: false,
    });
  });

  describe('processEvent with undefined data', () => {
    it('should handle event with no data field (authenticated event)', async () => {
      const queuedEvent: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'authenticated',
        data: undefined as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
      expect(result.routedTo).toEqual([]);
    });

    it('should handle event with empty data object', async () => {
      const queuedEvent: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'unknown',
        data: {},
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
    });

    it('should handle loading_screen event', async () => {
      const queuedEvent: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'loading_screen',
        data: undefined as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
    });

    it('should extract chatId from valid message event', async () => {
      const queuedEvent: QueuedEvent = {
        sessionId: messageEvent.sessionId,
        dataType: messageEvent.dataType,
        data: messageEvent.data as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
    });

    it('should use provided chatId instead of extracting', async () => {
      const queuedEvent: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: { body: 'test' },
        receivedAt: new Date().toISOString(),
        chatId: '254722833440@c.us',
        tags: ['VIP'],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
    });
  });

  describe('routeEventSync with undefined data', () => {
    it('should handle undefined data parameter', async () => {
      const result = await eventRouter.routeEventSync(
        'mysession',
        'authenticated',
        undefined as unknown as Record<string, unknown>
      );

      expect(result.success).toBe(true);
      expect(result.event.identifier).toBe('unknown');
    });

    it('should handle empty data object', async () => {
      const result = await eventRouter.routeEventSync('test-session', 'unknown', {});

      expect(result.success).toBe(true);
      expect(result.event.identifier).toBe('unknown');
    });

    it('should extract chatId from valid data', async () => {
      const result = await eventRouter.routeEventSync(
        messageEvent.sessionId,
        messageEvent.dataType,
        messageEvent.data as Record<string, unknown>
      );

      expect(result.success).toBe(true);
      expect(result.event.identifier).toBe('254722833440');
    });

    it('should lookup user tags when chatId is found', async () => {
      mockStateManager.getUser.mockResolvedValue({
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: ['SOMO', 'VIP'],
        welcomedTags: [],
        firstContactAt: new Date().toISOString(),
        lastContactAt: new Date().toISOString(),
        messageCount: 1,
      });

      const result = await eventRouter.routeEventSync(
        messageEvent.sessionId,
        messageEvent.dataType,
        messageEvent.data as Record<string, unknown>
      );

      expect(result.event.tags).toEqual(['SOMO', 'VIP']);
      expect(mockStateManager.getUser).toHaveBeenCalledWith('254722833440');
    });

    it('should not lookup user tags when chatId is null', async () => {
      const result = await eventRouter.routeEventSync('mysession', 'authenticated', {});

      expect(mockStateManager.getUser).not.toHaveBeenCalled();
      expect(result.event.tags).toEqual([]);
    });
  });

  describe('Tag Configuration CRUD', () => {
    it('should get tag configurations for given tags', async () => {
      mockStateManager.getConfig.mockResolvedValueOnce({
        tag: 'SOMO',
        enabled: true,
        routing: {
          target: { type: 'n8n_webhook', webhookUrl: 'http://example.com', enabled: true },
        },
      });

      const configs = await eventRouter.getTagConfigurations(['SOMO']);

      expect(configs).toHaveLength(1);
      expect(configs[0].tag).toBe('SOMO');
    });

    it('should filter out disabled tag configurations', async () => {
      mockStateManager.getConfig.mockResolvedValueOnce({
        tag: 'SOMO',
        enabled: false,
        routing: {
          target: { type: 'n8n_webhook', webhookUrl: 'http://example.com', enabled: true },
        },
      });

      const configs = await eventRouter.getTagConfigurations(['SOMO']);

      expect(configs).toHaveLength(0);
    });

    it('should get all tag configurations', async () => {
      mockStateManager.getConfigsByPrefix.mockResolvedValueOnce({
        'tag:SOMO': {
          tag: 'SOMO',
          enabled: true,
          routing: { target: { type: 'passthrough', enabled: true } },
        },
        'tag:VIP': {
          tag: 'VIP',
          enabled: true,
          routing: { target: { type: 'passthrough', enabled: true } },
        },
      });

      const configs = await eventRouter.getAllTagConfigurations();

      expect(configs).toHaveLength(2);
    });

    it('should set tag configuration', async () => {
      mockStateManager.getConfig.mockResolvedValueOnce(undefined);
      mockStateManager.setConfig.mockResolvedValueOnce(undefined);

      const config = await eventRouter.setTagConfiguration('TEST', {
        enabled: true,
        displayName: 'Test tag',
      });

      expect(config.tag).toBe('TEST');
      expect(config.enabled).toBe(true);
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
      expect(mockStateManager.setConfig).toHaveBeenCalled();
    });

    it('should preserve createdAt when updating existing config', async () => {
      const existingCreatedAt = '2026-01-01T00:00:00.000Z';
      mockStateManager.getConfig.mockResolvedValueOnce({
        tag: 'TEST',
        enabled: true,
        createdAt: existingCreatedAt,
      });
      mockStateManager.setConfig.mockResolvedValueOnce(undefined);

      const config = await eventRouter.setTagConfiguration('TEST', {
        enabled: false,
        displayName: 'Updated display name',
      });

      expect(config.createdAt).toBe(existingCreatedAt);
    });

    it('should delete tag configuration', async () => {
      mockStateManager.deleteConfig.mockResolvedValueOnce(true);

      const deleted = await eventRouter.deleteTagConfiguration('TEST');

      expect(deleted).toBe(true);
      expect(mockStateManager.deleteConfig).toHaveBeenCalledWith('tag_config_TEST');
    });
  });

  describe('Local Handler Registration', () => {
    it('should register a local handler', () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });

      // Should not throw
      expect(() => {
        eventRouter.registerLocalHandler('test-handler', mockHandler);
      }).not.toThrow();
    });
  });

  describe('Legacy Webhook Forwarding', () => {
    it('should use legacy forwarder when no tag routing is configured', async () => {
      const mockForwarder = jest.fn().mockResolvedValue(undefined);
      eventRouter.setLegacyWebhookForwarder(mockForwarder);

      const queuedEvent: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message',
        data: messageEvent.data as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      const result = await eventRouter.processEvent(queuedEvent);

      expect(result.success).toBe(true);
      expect(result.routedTo).toContain('legacy_webhooks');
      expect(mockForwarder).toHaveBeenCalled();
    });
  });

  describe('Event Type Filtering', () => {
    it('should filter events by dataType', async () => {
      // Configure tag routing that only handles 'message' events
      mockStateManager.getConfig.mockResolvedValueOnce({
        tag: 'SOMO',
        enabled: true,
        routing: {
          eventTypes: ['message'],
          target: { type: 'passthrough', enabled: true },
        },
      });

      mockStateManager.getUser.mockResolvedValueOnce({
        identifier: '254722833440',
        platform: 'c.us' as const,
        tags: ['SOMO'],
        welcomedTags: [],
        firstContactAt: new Date().toISOString(),
        lastContactAt: new Date().toISOString(),
        messageCount: 1,
      });

      // Send a status_change event (not in eventTypes filter)
      const result = await eventRouter.routeEventSync('test-session', 'status_change', {
        from: '254722833440@c.us',
        status: 'online',
      });

      // Should succeed but not route (filtered out)
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle event with null chatId in data', async () => {
      const result = await eventRouter.routeEventSync('test-session', 'message', {
        from: null,
        body: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.event.identifier).toBe('unknown');
    });

    it('should handle event with invalid from format', async () => {
      const result = await eventRouter.routeEventSync('test-session', 'message', {
        from: 'invalid-no-at-sign',
        body: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.event.identifier).toBe('unknown');
    });

    it('should handle nested message structure', async () => {
      const result = await eventRouter.routeEventSync('test-session', 'message', {
        message: {
          from: '254722833440@c.us',
          body: 'nested',
        },
      });

      expect(result.event.identifier).toBe('254722833440');
    });
  });
});
