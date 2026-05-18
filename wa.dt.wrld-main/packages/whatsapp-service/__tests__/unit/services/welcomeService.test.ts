/**
 * WelcomeService Tests
 *
 * Tests for tag-based welcome message functionality
 * Message format mirrors wwebjs-api sendMessage schema
 */

import { WelcomeService, WelcomeMessageItem } from '../../../src/services/welcomeService';
import { WhatsAppApiClient } from '../../../src/dispatcher/whatsappApiClient';
import { stateManager } from '../../../src/utils/stateManager';

// Mock dependencies
jest.mock('../../../src/dispatcher/whatsappApiClient');
jest.mock('../../../src/utils/stateManager', () => ({
  stateManager: {
    getConfig: jest.fn(),
    setConfig: jest.fn(),
    getAllConfig: jest.fn(),
    isTagWelcomed: jest.fn(),
    markTagWelcomed: jest.fn(),
  },
}));

describe('WelcomeService', () => {
  let welcomeService: WelcomeService;
  let mockApiClient: jest.Mocked<WhatsAppApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApiClient = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as jest.Mocked<WhatsAppApiClient>;

    welcomeService = new WelcomeService(mockApiClient);
  });

  describe('getWelcomeMessage', () => {
    it('should return hardcoded messages for "default" tag', async () => {
      const result = await welcomeService.getWelcomeMessage('default');

      expect(result).toEqual({
        messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
        enabled: true,
      });
      expect(stateManager.getConfig).not.toHaveBeenCalled();
    });

    it('should return hardcoded messages for "DEFAULT" tag (case-insensitive)', async () => {
      const result = await welcomeService.getWelcomeMessage('DEFAULT');

      expect(result).toEqual({
        messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
        enabled: true,
      });
    });

    it('should return configured messages for custom tag (new format)', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [
          { contentType: 'string', content: 'Welcome to SOMO!' },
          { contentType: 'MessageMediaFromURL', content: { url: 'https://example.com/welcome.png' } },
        ],
        enabled: true,
      });

      const result = await welcomeService.getWelcomeMessage('SOMO');

      expect(result).toEqual({
        messages: [
          { contentType: 'string', content: 'Welcome to SOMO!' },
          { contentType: 'MessageMediaFromURL', content: { url: 'https://example.com/welcome.png' } },
        ],
        enabled: true,
      });
      expect(stateManager.getConfig).toHaveBeenCalledWith('welcome_message_SOMO');
    });

    it('should convert old single-message format to array (backward compatibility)', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        message: 'Welcome to SOMO!',
        enabled: true,
      });

      const result = await welcomeService.getWelcomeMessage('SOMO');

      expect(result).toEqual({
        messages: [{ contentType: 'string', content: 'Welcome to SOMO!' }],
        enabled: true,
      });
    });

    it('should return null for tag without configured message', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue(undefined);

      const result = await welcomeService.getWelcomeMessage('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should handle disabled welcome message', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome to VIP!' }],
        enabled: false,
      });

      const result = await welcomeService.getWelcomeMessage('VIP');

      expect(result).toEqual({
        messages: [{ contentType: 'string', content: 'Welcome to VIP!' }],
        enabled: false,
      });
    });

    it('should default enabled to true if not specified', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome!' }],
      });

      const result = await welcomeService.getWelcomeMessage('TEST');

      expect(result).toEqual({
        messages: [{ contentType: 'string', content: 'Welcome!' }],
        enabled: true,
      });
    });
  });

  describe('setWelcomeMessage', () => {
    it('should save welcome messages to config', async () => {
      const messages: WelcomeMessageItem[] = [
        { contentType: 'string', content: 'Welcome to SOMO!' },
      ];

      await welcomeService.setWelcomeMessage('SOMO', messages, true);

      expect(stateManager.setConfig).toHaveBeenCalledWith('welcome_message_SOMO', {
        messages,
        enabled: true,
      });
    });

    it('should save multiple messages with media', async () => {
      const messages: WelcomeMessageItem[] = [
        { contentType: 'string', content: 'Welcome to SOMO!' },
        {
          contentType: 'MessageMediaFromURL',
          content: { url: 'https://example.com/welcome.png' },
          options: { caption: 'Our welcome guide' },
        },
      ];

      await welcomeService.setWelcomeMessage('SOMO', messages, true);

      expect(stateManager.setConfig).toHaveBeenCalledWith('welcome_message_SOMO', {
        messages,
        enabled: true,
      });
    });

    it('should default enabled to true', async () => {
      const messages: WelcomeMessageItem[] = [
        { contentType: 'string', content: 'Welcome VIP!' },
      ];

      await welcomeService.setWelcomeMessage('VIP', messages);

      expect(stateManager.setConfig).toHaveBeenCalledWith('welcome_message_VIP', {
        messages,
        enabled: true,
      });
    });

    it('should allow setting enabled to false', async () => {
      const messages: WelcomeMessageItem[] = [
        { contentType: 'string', content: 'Test message' },
      ];

      await welcomeService.setWelcomeMessage('TEST', messages, false);

      expect(stateManager.setConfig).toHaveBeenCalledWith('welcome_message_TEST', {
        messages,
        enabled: false,
      });
    });
  });

  describe('disableWelcomeMessage', () => {
    it('should disable existing welcome messages', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome!' }],
        enabled: true,
      });

      await welcomeService.disableWelcomeMessage('SOMO');

      expect(stateManager.setConfig).toHaveBeenCalledWith('welcome_message_SOMO', {
        messages: [{ contentType: 'string', content: 'Welcome!' }],
        enabled: false,
      });
    });

    it('should do nothing if tag has no welcome message', async () => {
      (stateManager.getConfig as jest.Mock).mockResolvedValue(undefined);

      await welcomeService.disableWelcomeMessage('UNKNOWN');

      expect(stateManager.setConfig).not.toHaveBeenCalled();
    });
  });

  describe('sendWelcomeForNewTags', () => {
    const identifier = '254722833440';
    const platform = 'c.us' as const;
    const chatId = '254722833440@c.us'; // Reconstructed chatId for wwebjs-api calls
    const sessionId = 'default';

    it('should send welcome messages for new tag with configured messages', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome to SOMO!' }],
        enabled: true,
      });
      (stateManager.markTagWelcomed as jest.Mock).mockResolvedValue({});

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['SOMO'], sessionId);

      expect(result.sentWelcomes).toHaveLength(1);
      expect(result.sentWelcomes[0]).toEqual({
        tag: 'SOMO',
        messageCount: 1,
      });
      expect(result.skippedTags).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(sessionId, {
        chatId,
        contentType: 'string',
        content: 'Welcome to SOMO!',
        options: undefined,
      });
      expect(stateManager.markTagWelcomed).toHaveBeenCalledWith(identifier, 'SOMO');
    });

    it('should send multiple messages in sequence', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [
          { contentType: 'string', content: 'Welcome to SOMO!' },
          {
            contentType: 'MessageMediaFromURL',
            content: { url: 'https://example.com/welcome.png' },
            options: { caption: 'Guide' },
          },
        ],
        enabled: true,
      });
      (stateManager.markTagWelcomed as jest.Mock).mockResolvedValue({});

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['SOMO'], sessionId);

      expect(result.sentWelcomes).toHaveLength(1);
      expect(result.sentWelcomes[0].messageCount).toBe(2);
      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(2);

      // First message - text
      expect(mockApiClient.sendMessage).toHaveBeenNthCalledWith(1, sessionId, {
        chatId,
        contentType: 'string',
        content: 'Welcome to SOMO!',
        options: undefined,
      });

      // Second message - media
      expect(mockApiClient.sendMessage).toHaveBeenNthCalledWith(2, sessionId, {
        chatId,
        contentType: 'MessageMediaFromURL',
        content: { url: 'https://example.com/welcome.png' },
        options: { caption: 'Guide' },
      });
    });

    it('should skip tag if already welcomed', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(true);

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['SOMO'], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.skippedTags).toEqual(['SOMO']);
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip tag if no welcome message configured', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue(undefined);

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['UNKNOWN'], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.skippedTags).toEqual(['UNKNOWN']);
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip tag if welcome message is disabled', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome!' }],
        enabled: false,
      });

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['DISABLED'], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.skippedTags).toEqual(['DISABLED']);
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle multiple tags', async () => {
      (stateManager.isTagWelcomed as jest.Mock)
        .mockResolvedValueOnce(false) // SOMO - not welcomed
        .mockResolvedValueOnce(true)  // VIP - already welcomed
        .mockResolvedValueOnce(false); // LEAD - not welcomed, no config

      (stateManager.getConfig as jest.Mock)
        .mockResolvedValueOnce({
          messages: [{ contentType: 'string', content: 'Welcome SOMO!' }],
          enabled: true,
        })
        .mockResolvedValueOnce(undefined); // LEAD has no config

      (stateManager.markTagWelcomed as jest.Mock).mockResolvedValue({});

      const result = await welcomeService.sendWelcomeForNewTags(
        identifier,
        platform,
        ['SOMO', 'VIP', 'LEAD'],
        sessionId
      );

      expect(result.sentWelcomes).toHaveLength(1);
      expect(result.sentWelcomes[0].tag).toBe('SOMO');
      expect(result.skippedTags).toEqual(['VIP', 'LEAD']);
      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [{ contentType: 'string', content: 'Welcome!' }],
        enabled: true,
      });
      mockApiClient.sendMessage.mockRejectedValue(new Error('API Error'));

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['SOMO'], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        tag: 'SOMO',
        error: 'API Error',
      });
      expect(stateManager.markTagWelcomed).not.toHaveBeenCalled();
    });

    it('should send welcome for default tag', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.markTagWelcomed as jest.Mock).mockResolvedValue({});

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['default'], sessionId);

      expect(result.sentWelcomes).toHaveLength(1);
      expect(result.sentWelcomes[0].messageCount).toBe(1);
      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(sessionId, {
        chatId,
        contentType: 'string',
        content: 'Welcome! You are now registered.',
        options: undefined,
      });
    });

    it('should return empty results for empty tags array', async () => {
      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, [], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.skippedTags).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip tag if messages array is empty', async () => {
      (stateManager.isTagWelcomed as jest.Mock).mockResolvedValue(false);
      (stateManager.getConfig as jest.Mock).mockResolvedValue({
        messages: [],
        enabled: true,
      });

      const result = await welcomeService.sendWelcomeForNewTags(identifier, platform, ['EMPTY'], sessionId);

      expect(result.sentWelcomes).toHaveLength(0);
      expect(result.skippedTags).toEqual(['EMPTY']);
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('listWelcomeMessages', () => {
    it('should return default messages plus configured messages', async () => {
      (stateManager.getAllConfig as jest.Mock).mockResolvedValue({
        'welcome_message_SOMO': {
          messages: [{ contentType: 'string', content: 'Welcome SOMO!' }],
          enabled: true,
        },
        'welcome_message_VIP': {
          messages: [{ contentType: 'string', content: 'Welcome VIP!' }],
          enabled: false,
        },
        'other_config': { value: 'something' },
      });

      const result = await welcomeService.listWelcomeMessages();

      expect(result).toEqual({
        default: {
          messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
          enabled: true,
        },
        SOMO: {
          messages: [{ contentType: 'string', content: 'Welcome SOMO!' }],
          enabled: true,
        },
        VIP: {
          messages: [{ contentType: 'string', content: 'Welcome VIP!' }],
          enabled: false,
        },
      });
    });

    it('should convert old single-message format in listing', async () => {
      (stateManager.getAllConfig as jest.Mock).mockResolvedValue({
        'welcome_message_OLD': { message: 'Old format message', enabled: true },
      });

      const result = await welcomeService.listWelcomeMessages();

      expect(result).toEqual({
        default: {
          messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
          enabled: true,
        },
        OLD: {
          messages: [{ contentType: 'string', content: 'Old format message' }],
          enabled: true,
        },
      });
    });

    it('should only return default if no configured messages', async () => {
      (stateManager.getAllConfig as jest.Mock).mockResolvedValue({});

      const result = await welcomeService.listWelcomeMessages();

      expect(result).toEqual({
        default: {
          messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
          enabled: true,
        },
      });
    });

    it('should filter out invalid config entries', async () => {
      (stateManager.getAllConfig as jest.Mock).mockResolvedValue({
        'welcome_message_GOOD': {
          messages: [{ contentType: 'string', content: 'Valid message' }],
          enabled: true,
        },
        'welcome_message_BAD': { noMessages: true }, // Missing messages field
        'welcome_message_INVALID': 'not an object',
      });

      const result = await welcomeService.listWelcomeMessages();

      expect(result).toEqual({
        default: {
          messages: [{ contentType: 'string', content: 'Welcome! You are now registered.' }],
          enabled: true,
        },
        GOOD: {
          messages: [{ contentType: 'string', content: 'Valid message' }],
          enabled: true,
        },
      });
    });
  });
});
