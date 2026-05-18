/**
 * LLM Service
 *
 * Provides conversational AI capabilities:
 * - Intent detection for free-text messages
 * - Dynamic welcome messages for unregistered users
 * - Tag-specific help generation
 *
 * Uses OpenRouter (OpenAI-compatible) with configurable model.
 * Separate from qdrantHandler which handles RAG memory.
 */

import OpenAI from 'openai';
import { llmConfig } from '../shared/config';
import {
  IntentDetectionResult,
  WelcomeGenerationInput,
  HelpGenerationInput,
  LlmCompletionResult,
  UserIntent,
} from '../types/llm';
import { getErrorMessage } from '../types/webhook';

class LlmServiceImpl {
  private openai: OpenAI | null = null;
  private initialized = false;

  /**
   * Initialize the OpenRouter client
   */
  initialize(): void {
    if (!llmConfig.enabled) {
      console.log('[LlmService] Disabled (set ENABLE_LLM=true to enable)');
      return;
    }

    if (!llmConfig.apiKey) {
      console.warn('[LlmService] No API key configured - LLM features disabled');
      return;
    }

    this.openai = new OpenAI({
      apiKey: llmConfig.apiKey,
      baseURL: llmConfig.baseUrl,
    });

    this.initialized = true;
    console.log(`[LlmService] Initialized with model: ${llmConfig.model}`);
  }

  isEnabled(): boolean {
    return this.initialized && this.openai !== null;
  }

  /**
   * Detect user intent from a free-text message.
   *
   * Returns a structured intent classification with optional tag match.
   * Uses a fast, focused prompt to minimize latency.
   */
  async detectIntent(
    messageBody: string,
    availableTags: string[]
  ): Promise<IntentDetectionResult> {
    if (!this.openai) {
      return { intent: 'unknown', confidence: 0 };
    }

    const tagList = availableTags.join(', ');

    try {
      const completion = await this.openai.chat.completions.create({
        model: llmConfig.model,
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for ${llmConfig.brandName}'s WhatsApp service. Available programs/tags: [${tagList}].

Classify the user's message into one of these intents:
- tag_interest: User is asking about, mentioning, or wants to join a specific program/tag
- help: User is asking for help or guidance on what they can do
- greeting: Simple greeting (hi, hello, hey, etc.)
- question: General question not specific to any program
- unknown: Cannot determine intent

Respond in JSON only: {"intent":"<type>","tag":"<TAG or null>","confidence":<0-1>,"reasoning":"<brief>"}`,
          },
          { role: 'user', content: messageBody },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      return this.parseIntentResponse(raw);
    } catch (error) {
      console.error('[LlmService] Intent detection failed:', getErrorMessage(error));
      return { intent: 'unknown', confidence: 0 };
    }
  }

  /**
   * Generate a welcome message for an unregistered user.
   *
   * Lists available programs/tags in a concise, friendly format.
   */
  async generateWelcome(input: WelcomeGenerationInput): Promise<string> {
    if (!this.openai) {
      return this.fallbackWelcome(input);
    }

    const tagDescriptions = input.availableTags
      .map(t => t.displayName ? `${t.tag} (${t.displayName})` : t.tag)
      .join(', ');

    try {
      const result = await this.complete(
        `You are ${llmConfig.brandName}'s WhatsApp assistant. A new user just messaged for the first time. Generate a warm, brief welcome message (max 3 sentences) that:
1. Welcomes them to ${llmConfig.brandName}
2. Lists available programs they can join: ${tagDescriptions}
3. Tells them to send a program name to get started

Keep it concise for WhatsApp. Use bullet points for the program list. No emojis except one at the start.`,
        'Generate a welcome message.'
      );

      return result.success ? result.text : this.fallbackWelcome(input);
    } catch {
      return this.fallbackWelcome(input);
    }
  }

  /**
   * Generate dynamic help text based on user's tags and available commands.
   */
  async generateHelp(input: HelpGenerationInput): Promise<string> {
    if (!this.openai) {
      return this.fallbackHelp(input);
    }

    const tagInfo = input.userTags.length > 0
      ? `User is enrolled in: ${input.userTags.map(t => input.tagDisplayNames[t] || t).join(', ')}`
      : 'User is not enrolled in any program';

    const cmdList = input.commands
      .map(c => `${c.keyword}: ${c.description}`)
      .join('\n');

    try {
      const result = await this.complete(
        `You are ${llmConfig.brandName}'s WhatsApp assistant. Generate a brief help message for this user.

${tagInfo}

Available commands:
${cmdList}

Write a short, friendly help message (max 5 lines) that:
1. Lists what they can do based on their enrolled programs
2. Shows available commands as a bulleted list
3. If enrolled in a program, suggest they can ask questions about it

Keep it concise for WhatsApp.`,
        'Show me what I can do.'
      );

      return result.success ? result.text : this.fallbackHelp(input);
    } catch {
      return this.fallbackHelp(input);
    }
  }

  /**
   * Generate a conversational response for an unregistered user.
   *
   * Used when intent detection identifies a general question or greeting
   * from someone without tags.
   */
  async generateUnregisteredResponse(
    messageBody: string,
    availableTags: Array<{ tag: string; displayName?: string }>
  ): Promise<string> {
    if (!this.openai) {
      return this.fallbackWelcome({ availableTags });
    }

    const tagDescriptions = availableTags
      .map(t => t.displayName ? `${t.tag} (${t.displayName})` : t.tag)
      .join(', ');

    try {
      const result = await this.complete(
        `You are ${llmConfig.brandName}'s WhatsApp assistant. The user is not enrolled in any program yet. Available programs: ${tagDescriptions}.

Respond briefly (2-3 sentences max) to their message. Always mention that they can join a program by sending its name. Be helpful and concise for WhatsApp.`,
        messageBody
      );

      return result.success ? result.text : this.fallbackWelcome({ availableTags });
    } catch {
      return this.fallbackWelcome({ availableTags });
    }
  }

  /**
   * Low-level completion call to OpenRouter
   */
  async complete(systemPrompt: string, userMessage: string): Promise<LlmCompletionResult> {
    if (!this.openai) {
      return { text: '', success: false, error: 'LLM not initialized', durationMs: 0 };
    }

    const startTime = Date.now();

    try {
      const completion = await this.openai.chat.completions.create({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: llmConfig.maxTokens,
        temperature: llmConfig.temperature,
      });

      const text = completion.choices[0]?.message?.content?.trim() || '';

      return {
        text,
        success: true,
        tokensUsed: completion.usage?.total_tokens,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        text: '',
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse the JSON response from intent detection.
   * Handles malformed JSON gracefully.
   */
  private parseIntentResponse(raw: string): IntentDetectionResult {
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      const validIntents: UserIntent[] = ['tag_interest', 'help', 'greeting', 'question', 'unknown'];
      const intent = validIntents.includes(parsed.intent as UserIntent)
        ? (parsed.intent as UserIntent)
        : 'unknown';

      return {
        intent,
        tag: typeof parsed.tag === 'string' ? parsed.tag.toUpperCase() : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
      };
    } catch {
      console.warn('[LlmService] Failed to parse intent response:', raw);
      return { intent: 'unknown', confidence: 0 };
    }
  }

  /**
   * Fallback welcome when LLM is unavailable
   */
  private fallbackWelcome(input: WelcomeGenerationInput): string {
    const tagList = input.availableTags
      .map(t => `• *${t.tag}*${t.displayName ? ` - ${t.displayName}` : ''}`)
      .join('\n');

    return `Welcome to ${llmConfig.brandName}!\n\nAvailable programs:\n${tagList}\n\nSend a program name to get started.`;
  }

  /**
   * Fallback help when LLM is unavailable
   */
  private fallbackHelp(input: HelpGenerationInput): string {
    const lines = ['*Available commands:*', ''];
    for (const cmd of input.commands) {
      lines.push(`• *${cmd.keyword}* - ${cmd.description}`);
    }
    if (input.userTags.length > 0) {
      lines.push('', `Your programs: ${input.userTags.join(', ')}`, 'Send a message to chat about your program.');
    }
    return lines.join('\n');
  }
}

/** Singleton instance */
export const llmService = new LlmServiceImpl();

/** Export class for testing */
export { LlmServiceImpl };
