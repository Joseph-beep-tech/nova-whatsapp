/**
 * SPAO Event Handler Service
 *
 * Processes voice session lifecycle events from SPAO:
 * - Updates user metadata in MongoDB (call state, voice minutes)
 * - Sends WhatsApp messages (post-call summaries, progress updates)
 * - Stores voice session data for cross-channel context
 *
 * Follows the singleton pattern used by other services.
 */

import { stateManager } from '../utils/stateManager';
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import { DEFAULT_PLATFORM, toChatId } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import { spaoConfig } from '../shared/config';
import { qdrantHandler } from './qdrantHandler';
import {
  SpaoEvent,
  CallStartedData,
  CallEndedData,
  TranscriptSummaryData,
  ModuleCompletedData,
  McpToolCallData,
  TranscriptChunkData,
} from '../types/spao';

class SpaoEventHandlerService {
  private apiClient: WhatsAppApiClient | null = null;
  private llmService: { complete: (systemPrompt: string, userMessage: string) => Promise<{ text: string; success: boolean }> } | null = null;
  private sessionId = spaoConfig.whatsappSessionId;
  private processedEventIds: Set<string> = new Set();
  private maxProcessedIds = 10000;

  /**
   * Set the WhatsApp API client for sending messages
   */
  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
    console.log('[SpaoEventHandler] API client configured');
  }

  /**
   * Set the LLM service for generating comprehension questions
   */
  setLlmService(service: { complete: (systemPrompt: string, userMessage: string) => Promise<{ text: string; success: boolean }> }): void {
    this.llmService = service;
    console.log('[SpaoEventHandler] LLM service configured');
  }

  /**
   * Set the WhatsApp session ID for sending messages
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Process an incoming SPAO event. Dispatches to type-specific handlers.
   */
  async processEvent(event: SpaoEvent): Promise<void> {
    // Idempotency check
    if (this.processedEventIds.has(event.event_id)) {
      console.log(`[SpaoEventHandler] Duplicate event ${event.event_id}, skipping`);
      return;
    }

    this.processedEventIds.add(event.event_id);

    // Evict old IDs to prevent memory leak
    if (this.processedEventIds.size > this.maxProcessedIds) {
      const iterator = this.processedEventIds.values();
      for (let i = 0; i < this.maxProcessedIds / 2; i++) {
        const result = iterator.next();
        if (result.done) break;
        this.processedEventIds.delete(result.value);
      }
    }

    switch (event.event_type) {
      case 'voice.call.started':
        await this.handleCallStarted(event);
        break;
      case 'voice.call.ended':
        await this.handleCallEnded(event);
        break;
      case 'voice.transcript.summary':
        await this.handleTranscriptSummary(event);
        break;
      case 'voice.module.completed':
        await this.handleModuleCompleted(event);
        break;
      case 'voice.mcp.tool_call':
        await this.handleMcpToolCall(event);
        break;
      case 'voice.transcript.chunk':
        await this.handleTranscriptChunk(event);
        break;
      default:
        console.warn(`[SpaoEventHandler] Unknown event type: ${event.event_type}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle voice.call.started — Update user metadata with active call info
   */
  private async handleCallStarted(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as CallStartedData;

    console.log(`[SpaoEventHandler] Call started for ${event.phone} (call_sid=${event.call_sid}, behavior=${data.behavior_name})`);

    try {
      // Update user metadata with active call state
      await stateManager.setConfig(`spao_active_call_${event.phone}`, {
        callSid: event.call_sid,
        behaviorName: data.behavior_name,
        direction: data.direction || 'inbound',
        startedAt: event.timestamp,
        phone: event.phone,
        tag: event.tag,
      });
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to store call started state:', getErrorMessage(error));
    }
  }

  /**
   * Handle voice.call.ended — Store session, send summary, track usage
   */
  private async handleCallEnded(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as CallEndedData;

    console.log(`[SpaoEventHandler] Call ended for ${event.phone} (duration=${data.duration_seconds}s, status=${data.status})`);

    try {
      // Clear active call state
      await stateManager.deleteConfig(`spao_active_call_${event.phone}`);

      // Store session record
      await stateManager.setConfig(`spao_last_session_${event.phone}`, {
        callSid: event.call_sid,
        endedAt: event.timestamp,
        durationSeconds: data.duration_seconds,
        status: data.status,
        summary: data.summary,
        topics: data.topics,
        tag: event.tag,
      });

      // Track voice minutes on user document
      if (data.duration_seconds && data.duration_seconds > 0) {
        await this.trackVoiceMinutes(event.phone, data.duration_seconds, event.call_sid);
      }

      // Send post-call summary via WhatsApp
      if (data.summary && spaoConfig.enableSessionSummaries) {
        await this.sendWhatsAppMessage(
          event.phone,
          `*Voice Session Complete* (${Math.ceil((data.duration_seconds || 0) / 60)} min)\n\n${data.summary}`
        );
      }
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to process call ended:', getErrorMessage(error));
    }
  }

  /**
   * Handle voice.transcript.summary — Store summary for cross-channel context
   */
  private async handleTranscriptSummary(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as TranscriptSummaryData;

    console.log(`[SpaoEventHandler] Transcript summary for ${event.phone}: "${data.summary.slice(0, 80)}..."`);

    try {
      // Store summary indexed by phone
      const summaryKey = `spao_summary_${event.phone}_${Date.now()}`;
      await stateManager.setConfig(summaryKey, {
        phone: event.phone,
        callSid: event.call_sid,
        sessionId: data.session_id,
        summary: data.summary,
        topics: data.topics,
        moduleName: data.module_name,
        tag: event.tag,
        timestamp: event.timestamp,
      });

      // Embed summary into voice_summaries_{tag} Qdrant collection for cross-channel context
      if (event.tag && qdrantHandler.isEnabled()) {
        await qdrantHandler.storeVoiceSummary(
          event.tag,
          event.phone,
          data.summary,
          {
            type: 'transcript_summary',
            callSid: event.call_sid,
            sessionId: data.session_id,
            topics: data.topics,
            timestamp: event.timestamp,
          }
        );
      }

      // Generate and send post-call comprehension questions
      if (spaoConfig.enablePostCallReview && this.llmService) {
        await this.sendComprehensionQuestions(event.phone, data.summary, event.tag);
      }
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to store transcript summary:', getErrorMessage(error));
    }
  }

  /**
   * Handle voice.module.completed — Update progress, send congratulations
   */
  private async handleModuleCompleted(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as ModuleCompletedData;

    console.log(`[SpaoEventHandler] Module completed for ${event.phone}: ${data.module_name}`);

    try {
      // Update learning progress via stateManager
      if (event.tag) {
        await stateManager.updateLearningProgress(
          event.phone,
          event.tag,
          {
            moduleId: data.module_id,
            moduleCompleted: true,
          }
        );
      }

      // Send congratulations message
      let message = `Congratulations! You've completed *${data.module_name}*`;
      if (data.score !== undefined) {
        message += ` with a score of ${data.score}%`;
      }
      message += '.';

      if (data.next_module) {
        message += `\n\nNext up: *${data.next_module}*\nSay "Call me about ${data.next_module}" to start!`;
      }

      await this.sendWhatsAppMessage(event.phone, message);
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to process module completion:', getErrorMessage(error));
    }
  }

  /**
   * Handle voice.mcp.tool_call — Log tool invocation for user context
   */
  private async handleMcpToolCall(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as McpToolCallData;

    console.log(`[SpaoEventHandler] MCP tool call: ${data.tool_name} (success=${data.success})`);

    // Embed human-readable tool call description into voice_summaries_{tag} Qdrant collection
    if (event.tag && qdrantHandler.isEnabled() && data.tool_name) {
      const description = data.result_summary
        ? `During your voice session, the AI used ${data.tool_name}: ${data.result_summary}`
        : `During your voice session, the AI invoked ${data.tool_name}`;

      await qdrantHandler.storeVoiceSummary(
        event.tag,
        event.phone,
        description,
        {
          type: 'mcp_tool_call',
          callSid: event.call_sid,
          toolName: data.tool_name,
          timestamp: event.timestamp,
        }
      );
    }
  }

  /**
   * Handle voice.transcript.chunk — Append to active session context
   */
  private async handleTranscriptChunk(event: SpaoEvent): Promise<void> {
    const data = event.data as unknown as TranscriptChunkData;

    // Lightweight — just update active call context for mid-call WhatsApp queries
    try {
      const activeCallKey = `spao_active_call_${event.phone}`;
      const activeCall = await stateManager.getConfig(activeCallKey) as Record<string, unknown> | null;

      if (activeCall) {
        const transcripts = (activeCall.recentTranscripts as string[] || []);
        transcripts.push(`[${data.role}]: ${data.text}`);

        // Keep last 10 chunks
        if (transcripts.length > 10) {
          transcripts.splice(0, transcripts.length - 10);
        }

        await stateManager.setConfig(activeCallKey, {
          ...activeCall,
          recentTranscripts: transcripts,
          lastTranscriptAt: event.timestamp,
        });
      }
    } catch (error: unknown) {
      // Transcript chunks are high-volume — log at debug level
      console.debug('[SpaoEventHandler] Failed to store transcript chunk:', getErrorMessage(error));
    }
  }

  // ---------------------------------------------------------------------------
  // Post-Call Comprehension Questions
  // ---------------------------------------------------------------------------

  /**
   * Generate 1-2 comprehension questions from a session summary and send via WhatsApp.
   * Stores the pending questions so the spaoVoiceHandler can process answers.
   */
  private async sendComprehensionQuestions(
    phone: string,
    summary: string,
    tag?: string
  ): Promise<void> {
    if (!this.llmService) return;

    try {
      const result = await this.llmService.complete(
        'You are a learning assessment assistant. Given a summary of a voice learning session, ' +
        'generate 1-2 short comprehension questions to check understanding. ' +
        'Format: one question per line, numbered. Keep questions simple and direct. ' +
        'Do not include answers.',
        `Session summary:\n${summary}`
      );

      if (!result.success || !result.text) return;

      const questions = result.text.trim();

      // Store pending questions for answer processing
      await stateManager.setConfig(`spao_pending_questions_${phone}`, {
        questions,
        summary,
        tag,
        sentAt: new Date().toISOString(),
      });

      // Send questions via WhatsApp with a brief delay for the summary to arrive first
      await new Promise(resolve => setTimeout(resolve, 3000));

      await this.sendWhatsAppMessage(
        phone,
        `*Quick check from your call!*\n\n${questions}\n\n_Reply with your answers._`
      );

      console.log(`[SpaoEventHandler] Comprehension questions sent to ${phone}`);
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to generate comprehension questions:', getErrorMessage(error));
    }
  }

  /**
   * Check if a user has pending comprehension questions
   */
  async getPendingQuestions(phone: string): Promise<Record<string, unknown> | null> {
    return await stateManager.getConfig(`spao_pending_questions_${phone}`) as Record<string, unknown> | null;
  }

  /**
   * Clear pending questions after they've been answered
   */
  async clearPendingQuestions(phone: string): Promise<void> {
    await stateManager.deleteConfig(`spao_pending_questions_${phone}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a user has an active voice call
   */
  async isUserInCall(phone: string): Promise<boolean> {
    const activeCall = await stateManager.getConfig(`spao_active_call_${phone}`);
    return activeCall !== null;
  }

  /**
   * Get active call context for a user (for mid-call WhatsApp queries)
   */
  async getActiveCallContext(phone: string): Promise<Record<string, unknown> | null> {
    return await stateManager.getConfig(`spao_active_call_${phone}`) as Record<string, unknown> | null;
  }

  /**
   * Get the most recent voice session for a user
   */
  async getLastSession(phone: string): Promise<Record<string, unknown> | null> {
    return await stateManager.getConfig(`spao_last_session_${phone}`) as Record<string, unknown> | null;
  }

  /**
   * Track voice minutes for billing
   */
  private async trackVoiceMinutes(phone: string, durationSeconds: number, callSid?: string): Promise<void> {
    try {
      const usageKey = `spao_usage_${phone}`;
      const usage = (await stateManager.getConfig(usageKey) as Record<string, unknown>) || {};

      const totalSeconds = ((usage.voiceTotalSeconds as number) || 0) + durationSeconds;
      const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
      const monthlySeconds = ((usage[`voiceSeconds_${monthKey}`] as number) || 0) + durationSeconds;
      const sessions = ((usage.voiceSessionsTotal as number) || 0) + 1;

      await stateManager.setConfig(usageKey, {
        ...usage,
        voiceTotalSeconds: totalSeconds,
        [`voiceSeconds_${monthKey}`]: monthlySeconds,
        voiceSessionsTotal: sessions,
        lastCallSid: callSid,
        lastCallAt: new Date().toISOString(),
      });

      console.log(`[SpaoEventHandler] Voice usage for ${phone}: ${Math.ceil(totalSeconds / 60)} min total, ${sessions} sessions`);
    } catch (error: unknown) {
      console.error('[SpaoEventHandler] Failed to track voice minutes:', getErrorMessage(error));
    }
  }

  /**
   * Send a WhatsApp message to a phone number
   */
  private async sendWhatsAppMessage(phone: string, text: string): Promise<void> {
    if (!this.apiClient) {
      console.warn('[SpaoEventHandler] No API client configured, cannot send WhatsApp message');
      return;
    }

    try {
      const chatId = toChatId(phone, DEFAULT_PLATFORM);
      await this.apiClient.sendMessage(this.sessionId, {
        chatId,
        contentType: 'string',
        content: text,
      });
      console.log(`[SpaoEventHandler] WhatsApp message sent to ${phone}`);
    } catch (error: unknown) {
      console.error(`[SpaoEventHandler] Failed to send WhatsApp to ${phone}:`, getErrorMessage(error));
    }
  }
}

export const spaoEventHandler = new SpaoEventHandlerService();
