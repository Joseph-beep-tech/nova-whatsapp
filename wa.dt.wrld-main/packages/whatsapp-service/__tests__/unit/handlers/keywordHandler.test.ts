/**
 * Keyword Handler Unit Tests
 *
 * Tests the keywordHandler logic migrated from n8n Echo Reply workflow.
 */

import { keywordHandler, KeywordHandlerService, KeywordContext, KeywordResponse } from '../../../src/handlers/keywordHandler';
import { WhatsAppApiClient } from '../../../src/dispatcher/whatsappApiClient';

// Mock the WhatsApp API client
jest.mock('../../../src/dispatcher/whatsappApiClient');

describe('KeywordHandler', () => {
  let handler: KeywordHandlerService;
  let mockApiClient: jest.Mocked<WhatsAppApiClient>;

  beforeEach(() => {
    // Create a fresh instance for each test
    handler = new KeywordHandlerService();

    // Create mock API client
    mockApiClient = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as jest.Mocked<WhatsAppApiClient>;

    handler.setApiClient(mockApiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Echo Command', () => {
    it('should handle echo command and return echoed message', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'echo hello world',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.keyword).toBe('echo');
      expect(result.response).toBe('Echo: hello world');
    });

    it('should be case insensitive for echo', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'ECHO TEST',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Echo: TEST');
    });

    it('should send response via API client', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'echo test message',
        userTags: [],
      };

      await handler.handle(context);

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith('test-session', {
        chatId: '254722833440@c.us',
        contentType: 'string',
        content: 'Echo: test message',
      });
    });

    it('should not match echo without content', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'echo',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(false);
    });
  });

  describe('Ping Command', () => {
    it('should handle ping command and return pong', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'ping',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.keyword).toBe('ping');
      expect(result.response).toContain('pong');
    });

    it('should handle /ping command', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: '/ping',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.keyword).toBe('ping');
    });

    it('should be case insensitive for ping', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'PING',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
    });
  });

  describe('Help Command', () => {
    it('should handle help command and show available commands', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'help',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.keyword).toBe('help');
      expect(result.response).toContain('Available commands');
      expect(result.response).toContain('echo');
      expect(result.response).toContain('ping');
      expect(result.response).toContain('help');
    });

    it('should handle /help command', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: '/help',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
    });

    it('should not show admin commands for non-admin users', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'help',
        userTags: ['SOMO'],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).not.toContain('status');
    });

    it('should show admin commands for admin users', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'help',
        userTags: ['ADMIN'],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).toContain('status');
    });
  });

  describe('Status Command (Admin Only)', () => {
    it('should handle /status for admin users', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: '/status',
        userTags: ['ADMIN'],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.keyword).toBe('status');
      expect(result.response).toContain('Service online');
    });

    it('should not handle /status for non-admin users', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: '/status',
        userTags: ['SOMO'],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(false);
    });

    it('should not handle /status for users without tags', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: '/status',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(false);
    });
  });

  describe('Unhandled Messages', () => {
    it('should return handled: false for non-keyword messages', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'Hello, how are you?',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(false);
      expect(result.response).toBeUndefined();
      expect(result.keyword).toBeUndefined();
    });

    it('should not call API client for unhandled messages', async () => {
      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'Random message',
        userTags: [],
      };

      await handler.handle(context);

      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Custom Keyword Registration', () => {
    it('should allow registering custom keywords', async () => {
      handler.registerKeyword({
        keyword: 'test',
        pattern: /^test$/i,
        description: 'Test command',
        handler: async () => ({
          handled: true,
          response: 'Test response',
          keyword: 'test',
        }),
      });

      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'test',
        userTags: [],
      };

      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Test response');
    });

    it('should allow unregistering keywords', () => {
      expect(handler.hasKeyword('echo')).toBe(true);

      const removed = handler.unregisterKeyword('echo');

      expect(removed).toBe(true);
      expect(handler.hasKeyword('echo')).toBe(false);
    });

    it('should return false when unregistering non-existent keyword', () => {
      const removed = handler.unregisterKeyword('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('Keyword Listing', () => {
    it('should list all registered keywords', () => {
      const keywords = handler.getRegisteredKeywords();

      expect(keywords).toContain('echo');
      expect(keywords).toContain('ping');
      expect(keywords).toContain('help');
      expect(keywords).toContain('status');
    });

    it('should check if keyword exists', () => {
      expect(handler.hasKeyword('echo')).toBe(true);
      expect(handler.hasKeyword('ping')).toBe(true);
      expect(handler.hasKeyword('nonexistent')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API client errors gracefully', async () => {
      mockApiClient.sendMessage.mockRejectedValue(new Error('Network error'));

      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'echo test',
        userTags: [],
      };

      // Should not throw, just log the error
      const result = await handler.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Echo: test');
    });

    it('should work without API client configured', async () => {
      const handlerWithoutClient = new KeywordHandlerService();
      // Don't set API client

      const context: KeywordContext = {
        identifier: '254722833440',
        platform: 'c.us' as const,
        sessionId: 'test-session',
        messageBody: 'ping',
        userTags: [],
      };

      const result = await handlerWithoutClient.handle(context);

      expect(result.handled).toBe(true);
      expect(result.response).toContain('pong');
    });
  });

  describe('Singleton Export', () => {
    it('should export a singleton instance', () => {
      expect(keywordHandler).toBeInstanceOf(KeywordHandlerService);
    });
  });
});
