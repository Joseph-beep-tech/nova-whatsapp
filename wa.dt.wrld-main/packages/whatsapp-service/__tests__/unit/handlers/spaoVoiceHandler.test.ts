/**
 * Tests for SPAO Voice Handler.
 *
 * Verifies:
 * - Intent classification (greeting, call_request, progress, review, navigation, content_question)
 * - handleCallRequest initiates call via spaoClient
 * - handleProgress shows session history
 * - handleReview shows last session summary
 * - In-call note handling
 * - Fallback to content_question for unknown intents
 * - Uses event.sessionId (not hardcoded 'mysession')
 * - Message extraction from various data shapes
 */

// Set env before imports
process.env.ENABLE_SPAO = 'true';
process.env.SPAO_API_URL = 'http://localhost:5000';
process.env.SPAO_VOICE_API_URL = 'http://localhost:8054';
process.env.SPAO_API_KEY = 'test-spao-key';
process.env.SPAO_ENABLE_OUTBOUND_CALLS = 'true';
process.env.SPAO_VOICE_FROM_NUMBER = '+15551234567';
process.env.WHATSAPP_SESSION_ID = 'default-session';

// Mock spaoClient
jest.mock('../../../src/services/spaoClient', () => ({
  spaoClient: {
    enabled: true,
    initiateCall: jest.fn().mockResolvedValue({ success: true, callSid: 'CA_mock_001' }),
    getSessionHistory: jest.fn().mockResolvedValue([]),
    injectContext: jest.fn().mockResolvedValue({ success: true }),
    searchContent: jest.fn().mockResolvedValue({ success: true, results: [] }),
  },
}));

// Mock spaoEventHandler
jest.mock('../../../src/services/spaoEventHandler', () => ({
  spaoEventHandler: {
    isUserInCall: jest.fn().mockResolvedValue(false),
    getLastSession: jest.fn().mockResolvedValue(null),
    getActiveCallContext: jest.fn().mockResolvedValue(null),
  },
}));

// Mock llmService
jest.mock('../../../src/services/llmService', () => ({
  llmService: {
    isEnabled: jest.fn().mockReturnValue(false),
    detectIntent: jest.fn(),
  },
  LlmServiceImpl: jest.fn(),
}));

import { spaoVoiceHandler } from '../../../src/handlers/spaoVoiceHandler';
import { spaoClient } from '../../../src/services/spaoClient';
import { spaoEventHandler } from '../../../src/services/spaoEventHandler';
import type { RoutableEvent } from '../../../src/types/routing';

// Typed mock references
const mockSpaoClient = spaoClient as unknown as {
  enabled: boolean;
  initiateCall: jest.Mock;
  getSessionHistory: jest.Mock;
  injectContext: jest.Mock;
  searchContent: jest.Mock;
};

const mockEventHandler = spaoEventHandler as unknown as {
  isUserInCall: jest.Mock;
  getLastSession: jest.Mock;
  getActiveCallContext: jest.Mock;
};

// Mock WhatsAppApiClient
const mockSendMessage = jest.fn().mockResolvedValue({ success: true });
const mockApiClient = { sendMessage: mockSendMessage } as unknown as import('../../../src/dispatcher/whatsappApiClient').WhatsAppApiClient;

// Helper to create RoutableEvent
function makeRoutableEvent(body: string, overrides: Partial<RoutableEvent> = {}): RoutableEvent {
  return {
    sessionId: 'test-wa-session',
    dataType: 'message_create',
    data: { body },
    identifier: '254722833440',
    platform: 'c.us',
    tags: ['SOMO'],
    receivedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SpaoVoiceHandlerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spaoVoiceHandler.setApiClient(mockApiClient);
    spaoVoiceHandler.setSessionId('default-session');
    mockEventHandler.isUserInCall.mockResolvedValue(false);
    mockEventHandler.getLastSession.mockResolvedValue(null);
    mockEventHandler.getActiveCallContext.mockResolvedValue(null);
    mockSpaoClient.initiateCall.mockResolvedValue({ success: true, callSid: 'CA_mock_001' });
    mockSpaoClient.getSessionHistory.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // Intent Classification
  // -------------------------------------------------------------------------

  describe('intent classification', () => {
    describe('greeting', () => {
      it.each([
        'Hi',
        'hello',
        'Hey there',
        'Hola amigos',
        'jambo',
        'sasa',
        'niaje',
        'Mambo vipi',
      ])('classifies "%s" as greeting', async (message) => {
        const event = makeRoutableEvent(message);
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.success).toBe(true);
        expect(result.action).toBe('greeting_sent');
      });

      it('sends greeting message with menu hint', async () => {
        const event = makeRoutableEvent('Hello');
        await spaoVoiceHandler.handle(event);

        expect(mockSendMessage).toHaveBeenCalledWith(
          'test-wa-session',
          expect.objectContaining({
            content: expect.stringContaining('menu'),
          })
        );
      });
    });

    describe('call_request', () => {
      it.each([
        'Call me',
        'Call me about marketing',
        'Start a call',
        'phone me',
        'Ring me please',
        "Let's talk",
        'voice call',
        'voice session',
        'Start module 3',
        'lesson 2',
        'begin',
      ])('classifies "%s" as call_request', async (message) => {
        const event = makeRoutableEvent(message);
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.action).toBe('call_initiated');
      });
    });

    describe('progress', () => {
      it.each([
        'My progress',
        'how am i doing',
        'where am i',
        'my stats',
        'my score',
        'how far',
      ])('classifies "%s" as progress', async (message) => {
        const event = makeRoutableEvent(message);
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.success).toBe(true);
        expect(result.action).toBe('progress_shown');
      });
    });

    describe('review', () => {
      it.each([
        'What did I learn',
        'last call',
        'last session',
        'review',
        'summary',
        'recap',
      ])('classifies "%s" as review', async (message) => {
        const event = makeRoutableEvent(message);
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.success).toBe(true);
        expect(result.action).toBe('review_shown');
      });
    });

    describe('navigation', () => {
      it.each([
        'menu',
        'modules',
        'topics',
        'help',
        'options',
        'what can I do',
        'what can you do',
      ])('classifies "%s" as navigation', async (message) => {
        const event = makeRoutableEvent(message);
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.success).toBe(true);
        expect(result.action).toBe('navigation_shown');
      });
    });

    describe('content_question (fallback)', () => {
      it('returns fallback for unrecognized messages', async () => {
        const event = makeRoutableEvent('What is the difference between B2B and B2C marketing?');
        const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

        expect(result.fallback).toBe(true);
        expect(result.reason).toBe('content_question');
      });
    });
  });

  // -------------------------------------------------------------------------
  // handleCallRequest
  // -------------------------------------------------------------------------

  describe('handleCallRequest', () => {
    it('sends "starting a voice session" message before initiating call', async () => {
      const event = makeRoutableEvent('Call me');
      await spaoVoiceHandler.handle(event);

      // First call should be the "starting" message
      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('voice session'),
        })
      );
    });

    it('initiates call via spaoClient', async () => {
      const event = makeRoutableEvent('Call me');
      await spaoVoiceHandler.handle(event);

      expect(mockSpaoClient.initiateCall).toHaveBeenCalledWith('254722833440');
    });

    it('returns success with callSid on successful initiation', async () => {
      mockSpaoClient.initiateCall.mockResolvedValue({ success: true, callSid: 'CA_success' });

      const event = makeRoutableEvent('Call me');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('call_initiated');
      expect(result.callSid).toBe('CA_success');
    });

    it('sends error message and returns failure on failed initiation', async () => {
      mockSpaoClient.initiateCall.mockResolvedValue({ success: false, error: 'Service unavailable' });

      const event = makeRoutableEvent('Call me');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(false);
      expect(result.action).toBe('call_failed');

      // Should send an error message to the user
      const sendCalls = mockSendMessage.mock.calls;
      const errorMessage = sendCalls.find(
        (call: unknown[]) => ((call[1] as Record<string, unknown>).content as string).includes('couldn\'t start')
      );
      expect(errorMessage).toBeDefined();
    });

    it('extracts topic from "Call me about marketing"', async () => {
      const event = makeRoutableEvent('Call me about marketing');
      await spaoVoiceHandler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('marketing'),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleProgress
  // -------------------------------------------------------------------------

  describe('handleProgress', () => {
    it('shows "no sessions yet" when history is empty', async () => {
      mockSpaoClient.getSessionHistory.mockResolvedValue([]);

      const event = makeRoutableEvent('My progress');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('progress_shown');
      expect(result.sessions).toBe(0);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining("haven't had any voice sessions"),
        })
      );
    });

    it('shows session list when history exists', async () => {
      mockSpaoClient.getSessionHistory.mockResolvedValue([
        {
          id: 'sess-1',
          phone: '254722833440',
          channel: 'voice',
          status: 'completed',
          workflow_name: 'Marketing Basics',
          started_at: '2026-03-01T10:00:00Z',
        },
        {
          id: 'sess-2',
          phone: '254722833440',
          channel: 'voice',
          status: 'completed',
          workflow_name: 'Sales 101',
          started_at: '2026-03-02T14:00:00Z',
        },
      ]);

      const event = makeRoutableEvent('My progress');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.sessions).toBe(2);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('Your Voice Sessions'),
        })
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('Marketing Basics'),
        })
      );
    });

    it('fetches session history from spaoClient with limit 5', async () => {
      const event = makeRoutableEvent('My progress');
      await spaoVoiceHandler.handle(event);

      expect(mockSpaoClient.getSessionHistory).toHaveBeenCalledWith('254722833440', 5);
    });
  });

  // -------------------------------------------------------------------------
  // handleReview
  // -------------------------------------------------------------------------

  describe('handleReview', () => {
    it('shows "no recent session" when no last session exists', async () => {
      mockEventHandler.getLastSession.mockResolvedValue(null);

      const event = makeRoutableEvent('Review');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('review_shown');
      expect(result.hasSession).toBe(false);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('No recent session'),
        })
      );
    });

    it('shows session summary when last session exists', async () => {
      mockEventHandler.getLastSession.mockResolvedValue({
        callSid: 'CA_review_001',
        summary: 'We covered the fundamentals of digital marketing including SEO and SEM.',
        durationSeconds: 420,
        topics: ['SEO', 'SEM', 'digital marketing'],
      });

      const event = makeRoutableEvent('Last session');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.hasSession).toBe(true);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('Last Voice Session Review'),
        })
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('digital marketing including SEO'),
        })
      );
    });

    it('includes duration in review message', async () => {
      mockEventHandler.getLastSession.mockResolvedValue({
        summary: 'Test',
        durationSeconds: 300,
        topics: [],
      });

      const event = makeRoutableEvent('Recap');
      await spaoVoiceHandler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('5 min'),
        })
      );
    });

    it('includes topics in review message', async () => {
      mockEventHandler.getLastSession.mockResolvedValue({
        summary: 'Test',
        durationSeconds: 120,
        topics: ['branding', 'social media'],
      });

      const event = makeRoutableEvent('Review');
      await spaoVoiceHandler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('branding, social media'),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // In-Call Note Handling
  // -------------------------------------------------------------------------

  describe('in-call note handling', () => {
    it('detects user is in call and handles as in_call_note', async () => {
      mockEventHandler.isUserInCall.mockResolvedValue(true);
      mockEventHandler.getActiveCallContext.mockResolvedValue({
        callSid: 'CA_incall_001',
        whatsappNotes: [],
      });

      const event = makeRoutableEvent('Remember to ask about pricing');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('in_call_note_stored');
    });

    it('sends acknowledgment message for in-call note', async () => {
      mockEventHandler.isUserInCall.mockResolvedValue(true);
      mockEventHandler.getActiveCallContext.mockResolvedValue({
        callSid: 'CA_incall_002',
        whatsappNotes: [],
      });

      const event = makeRoutableEvent('Can you also cover SEO?');
      await spaoVoiceHandler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('noted'),
        })
      );
    });

    it('injects context into active voice session via spaoClient', async () => {
      mockEventHandler.isUserInCall.mockResolvedValue(true);
      mockEventHandler.getActiveCallContext.mockResolvedValue({
        callSid: 'CA_inject_001',
        whatsappNotes: [],
      });
      mockSpaoClient.enabled = true;

      const event = makeRoutableEvent('Ask about email marketing');
      await spaoVoiceHandler.handle(event);

      // injectContext is fire-and-forget, give it a tick
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockSpaoClient.injectContext).toHaveBeenCalledWith(
        'CA_inject_001',
        'Ask about email marketing'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Session ID Usage
  // -------------------------------------------------------------------------

  describe('sessionId handling', () => {
    it('uses event.sessionId for sending messages (not hardcoded)', async () => {
      const event = makeRoutableEvent('Hello', {
        sessionId: 'custom-wa-session-42',
      });

      await spaoVoiceHandler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'custom-wa-session-42',
        expect.any(Object)
      );
    });

    it('falls back to defaultSessionId when event has no sessionId', async () => {
      spaoVoiceHandler.setSessionId('fallback-session');

      const event = makeRoutableEvent('Hello', {
        sessionId: '',
      });

      await spaoVoiceHandler.handle(event);

      // Empty string is falsy, should fall back to defaultSessionId
      expect(mockSendMessage).toHaveBeenCalledWith(
        'fallback-session',
        expect.any(Object)
      );

      spaoVoiceHandler.setSessionId('default-session');
    });
  });

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  describe('handleNavigation', () => {
    it('shows menu with available options', async () => {
      const event = makeRoutableEvent('Menu');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('navigation_shown');

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-wa-session',
        expect.objectContaining({
          content: expect.stringContaining('Call me'),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Message Body Extraction
  // -------------------------------------------------------------------------

  describe('message body extraction', () => {
    it('extracts body from data.body', async () => {
      const event = makeRoutableEvent('Hello');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.action).toBe('greeting_sent');
    });

    it('extracts body from data.message', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-wa-session',
        dataType: 'message_create',
        data: { message: 'Hello' },
        identifier: '254722833440',
        platform: 'c.us',
        tags: ['SOMO'],
        receivedAt: new Date().toISOString(),
      };

      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;
      expect(result.success).toBe(true);
    });

    it('extracts body from data.content', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-wa-session',
        dataType: 'message_create',
        data: { content: 'Hello' },
        identifier: '254722833440',
        platform: 'c.us',
        tags: ['SOMO'],
        receivedAt: new Date().toISOString(),
      };

      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;
      expect(result.success).toBe(true);
    });

    it('extracts body from data.text', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-wa-session',
        dataType: 'message_create',
        data: { text: 'Hello' },
        identifier: '254722833440',
        platform: 'c.us',
        tags: ['SOMO'],
        receivedAt: new Date().toISOString(),
      };

      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;
      expect(result.success).toBe(true);
    });

    it('returns skipped when no message body found', async () => {
      const event: RoutableEvent = {
        sessionId: 'test-wa-session',
        dataType: 'message_create',
        data: { someOtherField: 123 },
        identifier: '254722833440',
        platform: 'c.us',
        tags: ['SOMO'],
        receivedAt: new Date().toISOString(),
      };

      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_message_body');
    });

    it('returns skipped for empty string body', async () => {
      const event = makeRoutableEvent('   ');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      // Trimmed empty string should be treated as no body
      expect(result.skipped).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // No API Client
  // -------------------------------------------------------------------------

  describe('without API client', () => {
    it('does not crash when no API client is set', async () => {
      spaoVoiceHandler.setApiClient(null as unknown as import('../../../src/dispatcher/whatsappApiClient').WhatsAppApiClient);

      const event = makeRoutableEvent('Hello');
      const result = await spaoVoiceHandler.handle(event) as Record<string, unknown>;

      // Should still process intent, just not send the message
      expect(result.success).toBe(true);
      expect(mockSendMessage).not.toHaveBeenCalled();

      // Restore
      spaoVoiceHandler.setApiClient(mockApiClient);
    });
  });
});
