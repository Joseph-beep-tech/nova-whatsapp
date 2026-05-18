/**
 * SPAO Voice Handler
 *
 * Local handler that interprets WhatsApp messages as SPAO voice platform actions.
 * The WhatsApp bot acts as a "remote control" for the SPAO voice AI.
 *
 * Intent classification:
 * - call_request — "Call me about marketing", "Start module 3"
 * - progress — "My progress", "How am I doing?"
 * - review — "What did I learn?", "Last call summary"
 * - navigation — "Menu", "What modules?", "Help"
 * - in_call_note — Any message while voice call is active
 * - content_question — Curriculum questions → delegates to qdrant_rag fallback
 * - greeting — "Hi", "Hello" → welcome + show menu
 *
 * Registered as local handler 'spao_voice_handler' in eventRouter.
 */

import { RoutableEvent } from '../types/routing';
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import { toChatId } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import { spaoClient } from '../services/spaoClient';
import { spaoEventHandler } from '../services/spaoEventHandler';
import { LlmServiceImpl } from '../services/llmService';

/** Detected intent from user message */
export type SpaoIntent =
  | 'call_request'
  | 'progress'
  | 'review'
  | 'navigation'
  | 'in_call_note'
  | 'content_question'
  | 'greeting';

interface IntentResult {
  intent: SpaoIntent;
  confidence: number;
  topic?: string;
}

class SpaoVoiceHandlerService {
  private apiClient: WhatsAppApiClient | null = null;
  private llmService: LlmServiceImpl | null = null;
  private defaultSessionId = 'mysession';

  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
  }

  setLlmService(service: LlmServiceImpl): void {
    this.llmService = service;
  }

  setSessionId(sessionId: string): void {
    this.defaultSessionId = sessionId;
  }

  /**
   * Main handler — called by eventRouter when routing target is local_handler(spao_voice_handler)
   */
  async handle(event: RoutableEvent, _config?: Record<string, unknown>): Promise<unknown> {
    const messageBody = this.extractMessageBody(event.data);
    if (!messageBody) {
      return { skipped: true, reason: 'no_message_body' };
    }

    const phone = event.identifier;

    // Check if user is currently in an active voice call
    const inCall = await spaoEventHandler.isUserInCall(phone);
    if (inCall) {
      return await this.handleInCallNote(event, messageBody);
    }

    // Classify intent
    const intentResult = await this.classifyIntent(messageBody);

    console.log(`[SpaoVoiceHandler] Intent: ${intentResult.intent} (confidence=${intentResult.confidence}) for ${phone}`);

    switch (intentResult.intent) {
      case 'call_request':
        return await this.handleCallRequest(event, messageBody, intentResult.topic);
      case 'progress':
        return await this.handleProgress(event);
      case 'review':
        return await this.handleReview(event);
      case 'navigation':
        return await this.handleNavigation(event);
      case 'greeting':
        return await this.handleGreeting(event);
      case 'content_question':
        // Return a signal to eventRouter to try the fallback (qdrant_rag)
        return { fallback: true, reason: 'content_question' };
      case 'in_call_note':
        return await this.handleInCallNote(event, messageBody);
      default:
        return { fallback: true, reason: 'unknown_intent' };
    }
  }

  // ---------------------------------------------------------------------------
  // Intent Classification
  // ---------------------------------------------------------------------------

  /**
   * Classify user message intent using pattern matching + optional LLM
   */
  private async classifyIntent(message: string): Promise<IntentResult> {
    const lower = message.toLowerCase().trim();

    // Pattern-based classification (fast path)
    if (/^(hi|hello|hey|hola|jambo|sasa|niaje|mambo)\b/i.test(lower)) {
      return { intent: 'greeting', confidence: 0.95 };
    }

    if (/\b(call me|start (a |the )?call|phone me|ring me|let'?s talk|voice (call|session))\b/i.test(lower)) {
      const topic = this.extractTopic(lower);
      return { intent: 'call_request', confidence: 0.9, topic };
    }

    if (/\b(my progress|how am i doing|where am i|my stats|my score|how far)\b/i.test(lower)) {
      return { intent: 'progress', confidence: 0.9 };
    }

    if (/\b(what did i learn|last (call|session)|review|summary|recap)\b/i.test(lower)) {
      return { intent: 'review', confidence: 0.9 };
    }

    if (/^(menu|modules?|topics?|help|options|what can (i|you) do)\b/i.test(lower)) {
      return { intent: 'navigation', confidence: 0.9 };
    }

    if (/\b(start module|module \d|lesson \d|begin|continue)\b/i.test(lower)) {
      const topic = this.extractTopic(lower);
      return { intent: 'call_request', confidence: 0.85, topic };
    }

    // If LLM is available, use it for ambiguous messages
    if (this.llmService?.isEnabled()) {
      return await this.classifyWithLlm(message);
    }

    // Default: treat as content question (fallback to RAG)
    return { intent: 'content_question', confidence: 0.5 };
  }

  /**
   * Use LLM for intent classification when pattern matching is uncertain
   */
  private async classifyWithLlm(message: string): Promise<IntentResult> {
    if (!this.llmService) {
      return { intent: 'content_question', confidence: 0.5 };
    }

    try {
      const result = await this.llmService.detectIntent(message, []);

      // Map LLM intents to SPAO intents
      switch (result.intent) {
        case 'greeting':
          return { intent: 'greeting', confidence: result.confidence };
        case 'help':
          return { intent: 'navigation', confidence: result.confidence };
        case 'question':
          return { intent: 'content_question', confidence: result.confidence };
        default:
          return { intent: 'content_question', confidence: 0.5 };
      }
    } catch {
      return { intent: 'content_question', confidence: 0.5 };
    }
  }

  /**
   * Extract topic/module name from message
   */
  private extractTopic(message: string): string | undefined {
    // "Call me about marketing" → "marketing"
    const aboutMatch = message.match(/about\s+(.+)/i);
    if (aboutMatch) return aboutMatch[1].trim();

    // "Start module 3" → "module 3"
    const moduleMatch = message.match(/(module|lesson)\s+(\d+\w*)/i);
    if (moduleMatch) return `${moduleMatch[1]} ${moduleMatch[2]}`;

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Intent Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle call request — initiate outbound voice call via SPAO
   */
  private async handleCallRequest(
    event: RoutableEvent,
    _message: string,
    topic?: string
  ): Promise<unknown> {
    const phone = event.identifier;

    const topicText = topic ? ` about *${topic}*` : '';
    await this.sendMessage(event, `Starting a voice session${topicText}. You'll receive a call shortly...`);

    const result = await spaoClient.initiateCall(phone);

    if (result.success) {
      console.log(`[SpaoVoiceHandler] Call initiated for ${phone} (sid=${result.callSid})`);
      return { success: true, action: 'call_initiated', callSid: result.callSid };
    }

    await this.sendMessage(event, `Sorry, I couldn't start the call right now. ${result.error || 'Please try again later.'}`);
    return { success: false, action: 'call_failed', error: result.error };
  }

  /**
   * Handle progress inquiry — fetch session history and compose summary
   */
  private async handleProgress(event: RoutableEvent): Promise<unknown> {
    const phone = event.identifier;
    const sessions = await spaoClient.getSessionHistory(phone, 5);

    if (sessions.length === 0) {
      await this.sendMessage(event,
        "You haven't had any voice sessions yet.\n\n" +
        'Say *"Call me"* to start your first session!'
      );
      return { success: true, action: 'progress_shown', sessions: 0 };
    }

    const lines = sessions.map((s, i) => {
      const date = s.started_at ? new Date(s.started_at).toLocaleDateString() : 'Unknown date';
      const status = s.status === 'completed' ? '✓' : '…';
      return `${i + 1}. ${status} ${s.workflow_name || 'Session'} — ${date}`;
    });

    await this.sendMessage(event,
      `*Your Voice Sessions* (${sessions.length} total)\n\n` +
      lines.join('\n') +
      '\n\nSay *"review"* for details on your last session.'
    );

    return { success: true, action: 'progress_shown', sessions: sessions.length };
  }

  /**
   * Handle review request — fetch latest session summary
   */
  private async handleReview(event: RoutableEvent): Promise<unknown> {
    const phone = event.identifier;
    const lastSession = await spaoEventHandler.getLastSession(phone);

    if (!lastSession) {
      await this.sendMessage(event,
        "No recent session to review.\n\nSay *\"Call me\"* to start a session!"
      );
      return { success: true, action: 'review_shown', hasSession: false };
    }

    const summary = lastSession.summary as string || 'No summary available for this session.';
    const duration = lastSession.durationSeconds as number;
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown duration';
    const topics = (lastSession.topics as string[] || []).join(', ');

    let message = `*Last Voice Session Review*\n\nDuration: ${durationText}`;
    if (topics) message += `\nTopics: ${topics}`;
    message += `\n\n${summary}`;

    await this.sendMessage(event, message);

    return { success: true, action: 'review_shown', hasSession: true };
  }

  /**
   * Handle navigation — show available modules/options
   */
  private async handleNavigation(event: RoutableEvent): Promise<unknown> {
    const menu = [
      '*What can I do?*\n',
      '📞 *"Call me"* — Start a voice learning session',
      '📊 *"My progress"* — See your session history',
      '📝 *"Review"* — Review your last session',
      '❓ Ask any question — I\'ll find the answer from the curriculum',
      '',
      '_You can also ask about specific topics:_',
      '_"Call me about marketing"_',
      '_"What is digital marketing?"_',
    ];

    await this.sendMessage(event, menu.join('\n'));

    return { success: true, action: 'navigation_shown' };
  }

  /**
   * Handle greeting — welcome + show menu
   */
  private async handleGreeting(event: RoutableEvent): Promise<unknown> {
    await this.sendMessage(event,
      'Hello! 👋 I\'m your learning assistant.\n\n' +
      'I can connect you to voice learning sessions, track your progress, and answer questions.\n\n' +
      'Say *"menu"* to see what I can do, or *"call me"* to start a voice session.'
    );

    return { success: true, action: 'greeting_sent' };
  }

  /**
   * Handle in-call note — user sent a message during an active voice call
   */
  private async handleInCallNote(event: RoutableEvent, message: string): Promise<unknown> {
    const phone = event.identifier;
    const activeCall = await spaoEventHandler.getActiveCallContext(phone);

    console.log(`[SpaoVoiceHandler] In-call note from ${phone}: "${message.slice(0, 50)}"`);

    // Store the note in the active call context
    if (activeCall) {
      const notes = (activeCall.whatsappNotes as string[] || []);
      notes.push(`[${new Date().toISOString()}] ${message}`);
      
      // Fire-and-forget: inject context into the active voice session via SPAO.
      // Don't block the WhatsApp reply on SPAO response time.
      const callSid = activeCall.callSid as string;
      if (callSid && spaoClient.enabled) {
        spaoClient.injectContext(callSid, message).catch(() => { /* logged inside spaoClient */ });
      }
    }

    await this.sendMessage(event,
      "Got it, I've noted that down. You can also ask about it on your current call."
    );

    return { success: true, action: 'in_call_note_stored' };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractMessageBody(data: Record<string, unknown>): string | null {
    const candidates = [
      data.body,
      data.message,
      data.content,
      data.text,
      (data.message as Record<string, unknown>)?.body,
      (data.msg as Record<string, unknown>)?.body,
      (data.data as Record<string, unknown>)?.body,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private async sendMessage(event: RoutableEvent, text: string): Promise<void> {
    if (!this.apiClient) {
      console.warn('[SpaoVoiceHandler] No API client configured');
      return;
    }

    try {
      const chatId = toChatId(event.identifier, event.platform);
      // Use the session from the routed event (correct for multi-session)
      const sessionId = event.sessionId || this.defaultSessionId;
      await this.apiClient.sendMessage(sessionId, {
        chatId,
        contentType: 'string',
        content: text,
      });
    } catch (error: unknown) {
      console.error('[SpaoVoiceHandler] Failed to send message:', getErrorMessage(error));
    }
  }
}

export const spaoVoiceHandler = new SpaoVoiceHandlerService();
