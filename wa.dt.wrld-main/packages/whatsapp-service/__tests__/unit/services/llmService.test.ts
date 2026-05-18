/**
 * LLM Service Tests
 *
 * Tests for intent detection, welcome generation, and help generation.
 * Mocks the OpenAI client to avoid real API calls.
 */

// Set env before imports
process.env.API_KEY = 'test-api-key';
process.env.ENABLE_LLM = 'true';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.LLM_MODEL = 'x-ai/grok-2';
process.env.BRAND_NAME = 'Test Org';

import { LlmServiceImpl } from '../../../src/services/llmService';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

describe('LlmService', () => {
  let service: LlmServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LlmServiceImpl();
    service.initialize();
  });

  describe('initialize', () => {
    it('should be enabled after initialization with valid config', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should be disabled before initialization', () => {
      const svc = new LlmServiceImpl();
      expect(svc.isEnabled()).toBe(false);
    });
  });

  describe('detectIntent', () => {
    it('should detect tag_interest intent', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '{"intent":"tag_interest","tag":"SOMO","confidence":0.95,"reasoning":"User asking about SOMO"}',
          },
        }],
      });

      const result = await service.detectIntent('Tell me about SOMO', ['SOMO', 'HELLO_TRACTOR']);

      expect(result.intent).toBe('tag_interest');
      expect(result.tag).toBe('SOMO');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect greeting intent', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '{"intent":"greeting","tag":null,"confidence":0.9,"reasoning":"Simple greeting"}',
          },
        }],
      });

      const result = await service.detectIntent('Hello!', ['SOMO']);

      expect(result.intent).toBe('greeting');
      expect(result.tag).toBeUndefined();
    });

    it('should detect help intent', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '{"intent":"help","tag":null,"confidence":0.85,"reasoning":"Asking for help"}',
          },
        }],
      });

      const result = await service.detectIntent('What can I do here?', ['SOMO']);

      expect(result.intent).toBe('help');
    });

    it('should handle malformed JSON response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: 'not valid json' },
        }],
      });

      const result = await service.detectIntent('test', ['SOMO']);

      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle JSON wrapped in markdown code fences', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '```json\n{"intent":"greeting","tag":null,"confidence":0.8,"reasoning":"Hi"}\n```',
          },
        }],
      });

      const result = await service.detectIntent('Hi', ['SOMO']);

      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBe(0.8);
    });

    it('should return unknown on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API timeout'));

      const result = await service.detectIntent('test', ['SOMO']);

      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should uppercase detected tag', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: '{"intent":"tag_interest","tag":"somo","confidence":0.9}',
          },
        }],
      });

      const result = await service.detectIntent('somo please', ['SOMO']);

      expect(result.tag).toBe('SOMO');
    });
  });

  describe('generateWelcome', () => {
    it('should generate welcome via LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Welcome to Test Org! We have great programs for you.',
          },
        }],
      });

      const result = await service.generateWelcome({
        availableTags: [
          { tag: 'SOMO', displayName: 'SOMO Learning' },
          { tag: 'HELLO_TRACTOR' },
        ],
      });

      expect(result).toContain('Welcome');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should fall back to static welcome on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await service.generateWelcome({
        availableTags: [
          { tag: 'SOMO', displayName: 'SOMO Learning' },
        ],
      });

      expect(result).toContain('Test Org');
      expect(result).toContain('SOMO');
    });
  });

  describe('generateHelp', () => {
    it('should generate dynamic help via LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Here\'s what you can do with your SOMO program...',
          },
        }],
      });

      const result = await service.generateHelp({
        userTags: ['SOMO'],
        commands: [
          { keyword: 'help', description: 'Show help' },
          { keyword: 'ping', description: 'Health check' },
        ],
        tagDisplayNames: { SOMO: 'SOMO Learning' },
      });

      expect(result).toContain('SOMO');
    });

    it('should fall back to static help on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await service.generateHelp({
        userTags: ['SOMO'],
        commands: [
          { keyword: 'help', description: 'Show help' },
        ],
        tagDisplayNames: {},
      });

      expect(result).toContain('help');
      expect(result).toContain('SOMO');
    });
  });

  describe('generateUnregisteredResponse', () => {
    it('should generate contextual response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Great question! You can join SOMO to learn more.',
          },
        }],
      });

      const result = await service.generateUnregisteredResponse(
        'What programs do you have?',
        [{ tag: 'SOMO', displayName: 'SOMO Learning' }]
      );

      expect(result).toContain('SOMO');
    });
  });

  describe('when disabled', () => {
    it('should return unknown intent', async () => {
      const disabledService = new LlmServiceImpl();
      // Don't initialize

      const result = await disabledService.detectIntent('test', ['SOMO']);
      expect(result.intent).toBe('unknown');
    });

    it('should return fallback welcome', async () => {
      const disabledService = new LlmServiceImpl();

      const result = await disabledService.generateWelcome({
        availableTags: [{ tag: 'SOMO' }],
      });

      expect(result).toContain('SOMO');
      expect(result).toContain('Test Org');
    });

    it('should return fallback help', async () => {
      const disabledService = new LlmServiceImpl();

      const result = await disabledService.generateHelp({
        userTags: [],
        commands: [{ keyword: 'help', description: 'Show help' }],
        tagDisplayNames: {},
      });

      expect(result).toContain('help');
    });
  });
});
