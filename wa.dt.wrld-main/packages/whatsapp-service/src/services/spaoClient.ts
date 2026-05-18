/**
 * SPAO Client Service
 *
 * REST client for the SPAO control plane and voice AI APIs.
 * Used by the spaoVoiceHandler to:
 * - Fetch session history and summaries
 * - Initiate outbound voice calls via SPAO's Twilio integration
 * - Search content via SPAO's RAG API
 *
 * Follows the singleton pattern used by erpnextSync.ts.
 */

import axios, { AxiosInstance } from 'axios';
import { spaoConfig } from '../shared/config';
import { getErrorMessage } from '../types/webhook';
import { SpaoRagSearchResult, SpaoSessionSummary } from '../types/spao';

export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

export interface PromptConfig {
  id: string;
  name: string;
  description?: string;
  behavior_name?: string;
}

class SpaoClientService {
  private controlPlaneClient: AxiosInstance | null = null;
  private voiceApiClient: AxiosInstance | null = null;
  readonly enabled: boolean;

  constructor() {
    this.enabled = spaoConfig.enabled;

    if (this.enabled && spaoConfig.apiUrl) {
      this.controlPlaneClient = axios.create({
        baseURL: spaoConfig.apiUrl,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(spaoConfig.apiKey ? { 'x-api-key': spaoConfig.apiKey } : {}),
        },
      });
    }

    if (this.enabled && spaoConfig.voiceApiUrl) {
      this.voiceApiClient = axios.create({
        baseURL: spaoConfig.voiceApiUrl,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(spaoConfig.apiKey ? { 'x-api-key': spaoConfig.apiKey } : {}),
        },
      });
    }

    if (this.enabled) {
      console.log(`[SpaoClient] Initialized (control=${spaoConfig.apiUrl}, voice=${spaoConfig.voiceApiUrl})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Session History
  // ---------------------------------------------------------------------------

  /**
   * Get session history for a phone number from SPAO storage API
   */
  async getSessionHistory(phone: string, limit = 10): Promise<SpaoSessionSummary[]> {
    if (!this.enabled || !this.controlPlaneClient) return [];

    try {
      const response = await this.controlPlaneClient.get('/api/v1/client/storage/sessions', {
        params: { phone: phone.replace(/^\+/, ''), limit, channel: 'voice' },
      });

      return (response.data?.items || response.data || []) as SpaoSessionSummary[];
    } catch (error: unknown) {
      console.warn('[SpaoClient] Failed to fetch session history:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get the latest voice session for a phone number
   */
  async getLatestSession(phone: string): Promise<SpaoSessionSummary | null> {
    const sessions = await this.getSessionHistory(phone, 1);
    return sessions[0] || null;
  }

  // ---------------------------------------------------------------------------
  // Content Search (RAG)
  // ---------------------------------------------------------------------------

  /**
   * Search content via SPAO's RAG search API
   */
  async searchContent(query: string, collectionName = 'documents', nResults = 5): Promise<SpaoRagSearchResult> {
    if (!this.enabled || !this.voiceApiClient) {
      return { success: false, error: 'SPAO client not configured' };
    }

    try {
      const response = await this.voiceApiClient.post<SpaoRagSearchResult>('/rag/search', {
        query,
        collection_name: collectionName,
        n_results: nResults,
      });

      return response.data;
    } catch (error: unknown) {
      console.warn('[SpaoClient] RAG search failed:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Inject real-time context (e.g. from WhatsApp) into an active voice session.
   */
  async injectContext(callSid: string, text: string): Promise<{ success: boolean; error?: string }> {
    if (!this.enabled || !this.voiceApiClient) {
      return { success: false, error: 'SPAO client not configured' };
    }

    try {
      const response = await this.voiceApiClient.post(`/active-call/${callSid}/inject-context`, {
        text,
      });

      return { success: response.data.status === 'success' };
    } catch (error: unknown) {
      console.warn(`[SpaoClient] Context injection failed for call ${callSid}:`, getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ---------------------------------------------------------------------------
  // Outbound Call Initiation
  // ---------------------------------------------------------------------------

  /**
   * Initiate an outbound voice call via SPAO's voice service.
   * SPAO's /make-outbound-call endpoint handles Twilio + TwiML setup.
   */
  async initiateCall(
    toPhone: string,
    fromNumber?: string,
    twimlUrl?: string
  ): Promise<CallResult> {
    if (!this.enabled || !this.voiceApiClient) {
      return { success: false, error: 'SPAO client not configured' };
    }

    if (!spaoConfig.enableOutboundCalls) {
      return { success: false, error: 'Outbound calls disabled' };
    }

    const to = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;
    const from = fromNumber || spaoConfig.voiceFromNumber;
    const url = twimlUrl || spaoConfig.voiceTwimlUrl;

    if (!from) {
      return { success: false, error: 'No voice from number configured' };
    }

    try {
      // Call SPAO's outbound call endpoint
      const response = await this.voiceApiClient.post('/make-outbound-call', {
        to,
        from: from,
        url,
      });

      const data = response.data as Record<string, unknown>;
      return {
        success: true,
        callSid: data.call_sid as string || data.sid as string,
      };
    } catch (error: unknown) {
      console.error('[SpaoClient] Failed to initiate call:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt Configs
  // ---------------------------------------------------------------------------

  /**
   * Get available prompt configurations (voice behaviors/modules)
   */
  async getPromptConfigs(): Promise<PromptConfig[]> {
    if (!this.enabled || !this.controlPlaneClient) return [];

    try {
      const response = await this.controlPlaneClient.get('/api/v1/client/storage/prompt-configs');
      return (response.data?.items || response.data || []) as PromptConfig[];
    } catch (error: unknown) {
      console.warn('[SpaoClient] Failed to fetch prompt configs:', getErrorMessage(error));
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{ control: boolean; voice: boolean }> {
    const results = { control: false, voice: false };

    if (this.controlPlaneClient) {
      try {
        const resp = await this.controlPlaneClient.get('/health', { timeout: 3000 });
        results.control = resp.status === 200;
      } catch {
        // unavailable
      }
    }

    if (this.voiceApiClient) {
      try {
        const resp = await this.voiceApiClient.get('/health', { timeout: 3000 });
        results.voice = resp.status === 200;
      } catch {
        // unavailable
      }
    }

    return results;
  }
}

export const spaoClient = new SpaoClientService();
