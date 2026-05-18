/**
 * Tests for SPAO Client Service.
 *
 * Verifies:
 * - initiateCall success/failure/disabled
 * - getSessionHistory success/empty/failure
 * - injectContext success/failure
 * - searchContent success/failure
 * - Disabled mode (ENABLE_SPAO=false) — all methods return safe defaults
 * - healthCheck endpoint calls
 * - Timeout handling
 */

// Set env before imports — start with SPAO DISABLED
process.env.ENABLE_SPAO = 'false';
process.env.SPAO_API_URL = '';
process.env.SPAO_VOICE_API_URL = '';
process.env.SPAO_API_KEY = '';
process.env.SPAO_ENABLE_OUTBOUND_CALLS = 'false';
process.env.SPAO_VOICE_FROM_NUMBER = '';

import { spaoClient } from '../../../src/services/spaoClient';

describe('SpaoClientService (disabled mode)', () => {
  // -------------------------------------------------------------------------
  // Disabled Mode
  // -------------------------------------------------------------------------

  describe('when ENABLE_SPAO=false', () => {
    it('reports enabled as false', () => {
      expect(spaoClient.enabled).toBe(false);
    });

    it('initiateCall returns failure', async () => {
      const result = await spaoClient.initiateCall('+254722833440');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('getSessionHistory returns empty array', async () => {
      const result = await spaoClient.getSessionHistory('254722833440');
      expect(result).toEqual([]);
    });

    it('getLatestSession returns null', async () => {
      const result = await spaoClient.getLatestSession('254722833440');
      expect(result).toBeNull();
    });

    it('searchContent returns failure', async () => {
      const result = await spaoClient.searchContent('test query');
      expect(result.success).toBe(false);
    });

    it('injectContext returns failure', async () => {
      const result = await spaoClient.injectContext('CA_test', 'some text');
      expect(result.success).toBe(false);
    });

    it('getPromptConfigs returns empty array', async () => {
      const result = await spaoClient.getPromptConfigs();
      expect(result).toEqual([]);
    });

    it('healthCheck returns both false', async () => {
      const result = await spaoClient.healthCheck();
      expect(result.control).toBe(false);
      expect(result.voice).toBe(false);
    });
  });
});

// =============================================================================
// Enabled Mode Tests (use jest.resetModules to re-import with new env)
// =============================================================================

describe('SpaoClientService (enabled mode)', () => {
  let enabledClient: typeof spaoClient;
  let mockAxiosCreate: jest.Mock;
  let mockControlPlaneGet: jest.Mock;
  let mockControlPlanePost: jest.Mock;
  let mockVoiceGet: jest.Mock;
  let mockVoicePost: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    // Set env for enabled mode
    process.env.ENABLE_SPAO = 'true';
    process.env.SPAO_API_URL = 'http://spao-api:5000';
    process.env.SPAO_VOICE_API_URL = 'http://spao-voice:8054';
    process.env.SPAO_API_KEY = 'test-spao-key';
    process.env.SPAO_ENABLE_OUTBOUND_CALLS = 'true';
    process.env.SPAO_VOICE_FROM_NUMBER = '+15551234567';
    process.env.SPAO_VOICE_TWIML_URL = 'https://voice.example.com/twiml';

    // Create mock axios instances
    mockControlPlaneGet = jest.fn();
    mockControlPlanePost = jest.fn();
    mockVoiceGet = jest.fn();
    mockVoicePost = jest.fn();

    mockAxiosCreate = jest.fn().mockImplementation((config: Record<string, unknown>) => {
      const baseURL = config.baseURL as string;
      if (baseURL.includes('5000')) {
        return { get: mockControlPlaneGet, post: mockControlPlanePost };
      }
      return { get: mockVoiceGet, post: mockVoicePost };
    });

    jest.mock('axios', () => ({
      create: mockAxiosCreate,
      __esModule: true,
      default: { create: mockAxiosCreate },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../src/services/spaoClient') as { spaoClient: typeof spaoClient };
    enabledClient = mod.spaoClient;
  });

  afterEach(() => {
    // Reset env to disabled to not affect other test files
    process.env.ENABLE_SPAO = 'false';
  });

  // -------------------------------------------------------------------------
  // initiateCall
  // -------------------------------------------------------------------------

  describe('initiateCall', () => {
    it('calls voice API /make-outbound-call on success', async () => {
      mockVoicePost.mockResolvedValue({
        data: { call_sid: 'CA_initiated_001' },
      });

      const result = await enabledClient.initiateCall('+254722833440');

      expect(result.success).toBe(true);
      expect(result.callSid).toBe('CA_initiated_001');
      expect(mockVoicePost).toHaveBeenCalledWith(
        '/make-outbound-call',
        expect.objectContaining({
          to: '+254722833440',
          from: '+15551234567',
        })
      );
    });

    it('prepends + to phone number if missing', async () => {
      mockVoicePost.mockResolvedValue({
        data: { call_sid: 'CA_plus_001' },
      });

      await enabledClient.initiateCall('254722833440');

      expect(mockVoicePost).toHaveBeenCalledWith(
        '/make-outbound-call',
        expect.objectContaining({
          to: '+254722833440',
        })
      );
    });

    it('returns failure on API error', async () => {
      mockVoicePost.mockRejectedValue(new Error('Connection refused'));

      const result = await enabledClient.initiateCall('+254722833440');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('uses alternative call_sid field name (sid)', async () => {
      mockVoicePost.mockResolvedValue({
        data: { sid: 'CA_alt_sid_001' },
      });

      const result = await enabledClient.initiateCall('+254722833440');

      expect(result.success).toBe(true);
      expect(result.callSid).toBe('CA_alt_sid_001');
    });

    it('includes TwiML URL when configured', async () => {
      mockVoicePost.mockResolvedValue({
        data: { call_sid: 'CA_twiml_001' },
      });

      await enabledClient.initiateCall('+254722833440');

      expect(mockVoicePost).toHaveBeenCalledWith(
        '/make-outbound-call',
        expect.objectContaining({
          url: 'https://voice.example.com/twiml',
        })
      );
    });

    it('allows custom from number and TwiML URL', async () => {
      mockVoicePost.mockResolvedValue({
        data: { call_sid: 'CA_custom_001' },
      });

      await enabledClient.initiateCall('+254722833440', '+15559876543', 'https://custom.twiml.url');

      expect(mockVoicePost).toHaveBeenCalledWith(
        '/make-outbound-call',
        expect.objectContaining({
          from: '+15559876543',
          url: 'https://custom.twiml.url',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // initiateCall — disabled outbound
  // -------------------------------------------------------------------------

  describe('initiateCall (outbound disabled)', () => {
    beforeEach(() => {
      jest.resetModules();

      process.env.ENABLE_SPAO = 'true';
      process.env.SPAO_API_URL = 'http://spao-api:5000';
      process.env.SPAO_VOICE_API_URL = 'http://spao-voice:8054';
      process.env.SPAO_ENABLE_OUTBOUND_CALLS = 'false';
      process.env.SPAO_VOICE_FROM_NUMBER = '+15551234567';

      jest.mock('axios', () => ({
        create: jest.fn().mockReturnValue({ get: jest.fn(), post: jest.fn() }),
        __esModule: true,
        default: { create: jest.fn().mockReturnValue({ get: jest.fn(), post: jest.fn() }) },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../../src/services/spaoClient') as { spaoClient: typeof spaoClient };
      enabledClient = mod.spaoClient;
    });

    it('returns failure when outbound calls are disabled', async () => {
      const result = await enabledClient.initiateCall('+254722833440');

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  // -------------------------------------------------------------------------
  // getSessionHistory
  // -------------------------------------------------------------------------

  describe('getSessionHistory', () => {
    it('returns session summaries on success', async () => {
      const sessions = [
        {
          id: 'sess-1',
          phone: '254722833440',
          channel: 'voice',
          status: 'completed',
          workflow_name: 'Marketing Basics',
          started_at: '2026-03-01T10:00:00Z',
        },
      ];

      mockControlPlaneGet.mockResolvedValue({
        data: { items: sessions },
      });

      const result = await enabledClient.getSessionHistory('254722833440', 5);

      expect(result).toEqual(sessions);
      expect(mockControlPlaneGet).toHaveBeenCalledWith(
        '/api/v1/client/storage/sessions',
        expect.objectContaining({
          params: expect.objectContaining({
            phone: '254722833440',
            limit: 5,
            channel: 'voice',
          }),
        })
      );
    });

    it('strips leading + from phone number', async () => {
      mockControlPlaneGet.mockResolvedValue({ data: [] });

      await enabledClient.getSessionHistory('+254722833440');

      expect(mockControlPlaneGet).toHaveBeenCalledWith(
        '/api/v1/client/storage/sessions',
        expect.objectContaining({
          params: expect.objectContaining({
            phone: '254722833440',
          }),
        })
      );
    });

    it('returns empty array on API error', async () => {
      mockControlPlaneGet.mockRejectedValue(new Error('Network error'));

      const result = await enabledClient.getSessionHistory('254722833440');

      expect(result).toEqual([]);
    });

    it('handles response.data as direct array', async () => {
      const sessions = [{ id: 'sess-direct', phone: '254722833440', channel: 'voice', status: 'completed' }];
      mockControlPlaneGet.mockResolvedValue({ data: sessions });

      const result = await enabledClient.getSessionHistory('254722833440');

      expect(result).toEqual(sessions);
    });

    it('defaults limit to 10', async () => {
      mockControlPlaneGet.mockResolvedValue({ data: [] });

      await enabledClient.getSessionHistory('254722833440');

      expect(mockControlPlaneGet).toHaveBeenCalledWith(
        '/api/v1/client/storage/sessions',
        expect.objectContaining({
          params: expect.objectContaining({ limit: 10 }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getLatestSession
  // -------------------------------------------------------------------------

  describe('getLatestSession', () => {
    it('returns the first session from history', async () => {
      const session = {
        id: 'latest-1',
        phone: '254722833440',
        channel: 'voice',
        status: 'completed',
      };
      mockControlPlaneGet.mockResolvedValue({ data: { items: [session] } });

      const result = await enabledClient.getLatestSession('254722833440');

      expect(result).toEqual(session);
    });

    it('returns null when no sessions', async () => {
      mockControlPlaneGet.mockResolvedValue({ data: { items: [] } });

      const result = await enabledClient.getLatestSession('254722833440');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // injectContext
  // -------------------------------------------------------------------------

  describe('injectContext', () => {
    it('posts to /active-call/:callSid/inject-context', async () => {
      mockVoicePost.mockResolvedValue({
        data: { status: 'success' },
      });

      const result = await enabledClient.injectContext('CA_inject_001', 'Ask about pricing');

      expect(result.success).toBe(true);
      expect(mockVoicePost).toHaveBeenCalledWith(
        '/active-call/CA_inject_001/inject-context',
        { text: 'Ask about pricing' }
      );
    });

    it('returns failure on API error', async () => {
      mockVoicePost.mockRejectedValue(new Error('Call not found'));

      const result = await enabledClient.injectContext('CA_notfound', 'test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Call not found');
    });

    it('returns failure when status is not success', async () => {
      mockVoicePost.mockResolvedValue({
        data: { status: 'error', message: 'Call ended' },
      });

      const result = await enabledClient.injectContext('CA_ended', 'test');

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // searchContent (RAG)
  // -------------------------------------------------------------------------

  describe('searchContent', () => {
    it('posts to /rag/search with query and collection', async () => {
      const mockResults = {
        success: true,
        query: 'marketing',
        results: [
          { text: 'Marketing is...', score: 0.9, source: 'doc1' },
        ],
        total_results: 1,
      };
      mockVoicePost.mockResolvedValue({ data: mockResults });

      const result = await enabledClient.searchContent('marketing', 'somo_buruka', 3);

      expect(result).toEqual(mockResults);
      expect(mockVoicePost).toHaveBeenCalledWith('/rag/search', {
        query: 'marketing',
        collection_name: 'somo_buruka',
        n_results: 3,
      });
    });

    it('uses default collection name "documents"', async () => {
      mockVoicePost.mockResolvedValue({ data: { success: true, results: [] } });

      await enabledClient.searchContent('test query');

      expect(mockVoicePost).toHaveBeenCalledWith('/rag/search', {
        query: 'test query',
        collection_name: 'documents',
        n_results: 5,
      });
    });

    it('returns failure on API error', async () => {
      mockVoicePost.mockRejectedValue(new Error('Service unavailable'));

      const result = await enabledClient.searchContent('test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getPromptConfigs
  // -------------------------------------------------------------------------

  describe('getPromptConfigs', () => {
    it('fetches prompt configs from control plane', async () => {
      const configs = [
        { id: 'pc-1', name: 'Somo Buruka', behavior_name: 'somo_buruka' },
      ];
      mockControlPlaneGet.mockResolvedValue({ data: { items: configs } });

      const result = await enabledClient.getPromptConfigs();

      expect(result).toEqual(configs);
      expect(mockControlPlaneGet).toHaveBeenCalledWith('/api/v1/client/storage/prompt-configs');
    });

    it('returns empty array on error', async () => {
      mockControlPlaneGet.mockRejectedValue(new Error('Not found'));

      const result = await enabledClient.getPromptConfigs();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // healthCheck
  // -------------------------------------------------------------------------

  describe('healthCheck', () => {
    it('returns both true when both endpoints respond', async () => {
      mockControlPlaneGet.mockResolvedValue({ status: 200 });
      mockVoiceGet.mockResolvedValue({ status: 200 });

      const result = await enabledClient.healthCheck();

      expect(result.control).toBe(true);
      expect(result.voice).toBe(true);
    });

    it('returns control=false when control plane is down', async () => {
      mockControlPlaneGet.mockRejectedValue(new Error('Connection refused'));
      mockVoiceGet.mockResolvedValue({ status: 200 });

      const result = await enabledClient.healthCheck();

      expect(result.control).toBe(false);
      expect(result.voice).toBe(true);
    });

    it('returns voice=false when voice API is down', async () => {
      mockControlPlaneGet.mockResolvedValue({ status: 200 });
      mockVoiceGet.mockRejectedValue(new Error('Connection refused'));

      const result = await enabledClient.healthCheck();

      expect(result.control).toBe(true);
      expect(result.voice).toBe(false);
    });

    it('returns both false when both endpoints are down', async () => {
      mockControlPlaneGet.mockRejectedValue(new Error('Down'));
      mockVoiceGet.mockRejectedValue(new Error('Down'));

      const result = await enabledClient.healthCheck();

      expect(result.control).toBe(false);
      expect(result.voice).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Timeout Handling
  // -------------------------------------------------------------------------

  describe('timeout handling', () => {
    it('creates axios instances with 10s timeout', () => {
      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('getSessionHistory gracefully handles timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      (timeoutError as unknown as Record<string, unknown>).code = 'ECONNABORTED';
      mockControlPlaneGet.mockRejectedValue(timeoutError);

      const result = await enabledClient.getSessionHistory('254722833440');

      expect(result).toEqual([]);
    });

    it('initiateCall gracefully handles timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      (timeoutError as unknown as Record<string, unknown>).code = 'ECONNABORTED';
      mockVoicePost.mockRejectedValue(timeoutError);

      const result = await enabledClient.initiateCall('+254722833440');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});
