/**
 * Keyword Handler
 *
 * Handles built-in keyword commands like echo, ping, help.
 * Migrated from n8n "WhatsApp Echo Reply" workflow.
 */

import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import { WhatsAppPlatform, DEFAULT_PLATFORM, toChatId } from '../utils/phoneNumber';
import { LlmServiceImpl } from '../services/llmService';

/**
 * Result of keyword handling
 */
export interface KeywordResponse {
  /** Whether the keyword was handled */
  handled: boolean;
  /** Response message (if handled) */
  response?: string;
  /** Keyword that was matched */
  keyword?: string;
}

/**
 * Context for keyword handling
 */
export interface KeywordContext {
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** WhatsApp session ID */
  sessionId: string;
  /** Message body */
  messageBody: string;
  /** User's tags */
  userTags: string[];
}

/**
 * Keyword configuration
 */
interface KeywordConfig {
  /** Keyword name */
  keyword: string;
  /** Pattern to match */
  pattern: RegExp;
  /** Handler function */
  handler: (match: RegExpMatchArray, context: KeywordContext) => Promise<KeywordResponse>;
  /** Whether this is an admin-only command */
  adminOnly?: boolean;
  /** Description for help text */
  description: string;
}

/**
 * Keyword Handler Service
 *
 * Processes keyword commands and sends responses.
 */
class KeywordHandlerService {
  private apiClient: WhatsAppApiClient | null = null;
  private llmService: LlmServiceImpl | null = null;
  private keywords: KeywordConfig[] = [];

  constructor() {
    this.registerBuiltinKeywords();
  }

  /**
   * Set the WhatsApp API client for sending responses
   */
  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
  }

  /**
   * Set the LLM service for dynamic help generation
   */
  setLlmService(service: LlmServiceImpl): void {
    this.llmService = service;
  }

  /**
   * Register built-in keyword handlers
   */
  private registerBuiltinKeywords(): void {
    // Echo - health check (migrated from n8n Echo Reply workflow)
    this.keywords.push({
      keyword: 'echo',
      pattern: /^echo\s+(.+)$/i,
      description: 'Echo back the message (health check)',
      handler: async (match) => ({
        handled: true,
        response: `Echo: ${match[1]}`,
        keyword: 'echo',
      }),
    });

    // Ping - simple health check
    this.keywords.push({
      keyword: 'ping',
      pattern: /^(ping|\/ping)\s*$/i,
      description: 'Ping-pong health check',
      handler: async () => ({
        handled: true,
        response: 'pong 🏓',
        keyword: 'ping',
      }),
    });

    // Help - show available commands (LLM-enhanced when available)
    this.keywords.push({
      keyword: 'help',
      pattern: /^(help|\/help)\s*$/i,
      description: 'Show available commands and guidance',
      handler: async (_, ctx) => ({
        handled: true,
        response: await this.generateHelpText(ctx.userTags),
        keyword: 'help',
      }),
    });

    // Status - admin-only service status
    this.keywords.push({
      keyword: 'status',
      pattern: /^\/status\s*$/i,
      description: 'Show service status (admin only)',
      adminOnly: true,
      handler: async () => ({
        handled: true,
        response: `✅ Service online\n📊 Queue: enabled\n🔍 Qdrant: enabled\n⏰ ${new Date().toISOString()}`,
        keyword: 'status',
      }),
    });
  }

  /**
   * Handle a message and check for keywords
   */
  async handle(context: KeywordContext): Promise<KeywordResponse> {
    for (const config of this.keywords) {
      const match = context.messageBody.match(config.pattern);

      if (match) {
        // Check admin-only commands
        if (config.adminOnly && !context.userTags.includes('ADMIN')) {
          continue; // Skip this keyword, try next
        }

        const result = await config.handler(match, context);

        // Send response if we have a client and a response
        if (result.handled && result.response && this.apiClient) {
          try {
            const chatId = toChatId(context.identifier, context.platform);
            await this.apiClient.sendMessage(context.sessionId, {
              chatId,
              contentType: 'string',
              content: result.response,
            });
            console.log(`[KeywordHandler] Sent ${config.keyword} response to ${context.identifier}`);
          } catch (error) {
            console.error(`[KeywordHandler] Failed to send response:`, error);
          }
        }

        return result;
      }
    }

    return { handled: false };
  }

  /**
   * Generate help text.
   * Uses LLM for dynamic, context-aware help when available.
   * Falls back to static keyword list.
   */
  private async generateHelpText(userTags: string[]): Promise<string> {
    const isAdmin = userTags.includes('ADMIN');
    const available = this.keywords.filter((k) => !k.adminOnly || isAdmin);
    const commands = available.map(k => ({ keyword: k.keyword, description: k.description }));

    // Try LLM-enhanced help
    if (this.llmService?.isEnabled()) {
      try {
        return await this.llmService.generateHelp({
          userTags,
          commands,
          tagDisplayNames: {},
        });
      } catch {
        // Fall through to static help
      }
    }

    // Static fallback
    const lines = ['*Available commands:*', ''];
    for (const config of available) {
      lines.push(`• *${config.keyword}* - ${config.description}`);
    }

    return lines.join('\n');
  }

  /**
   * Register a custom keyword handler
   */
  registerKeyword(config: KeywordConfig): void {
    // Remove existing if present
    this.keywords = this.keywords.filter((k) => k.keyword !== config.keyword);
    this.keywords.push(config);
    console.log(`[KeywordHandler] Registered keyword: ${config.keyword}`);
  }

  /**
   * Unregister a keyword handler
   */
  unregisterKeyword(keyword: string): boolean {
    const initialLength = this.keywords.length;
    this.keywords = this.keywords.filter((k) => k.keyword !== keyword);
    return this.keywords.length < initialLength;
  }

  /**
   * Get all registered keywords (for testing/monitoring)
   */
  getRegisteredKeywords(): string[] {
    return this.keywords.map((k) => k.keyword);
  }

  /**
   * Check if a keyword is registered
   */
  hasKeyword(keyword: string): boolean {
    return this.keywords.some((k) => k.keyword === keyword);
  }
}

// Singleton instance
export const keywordHandler = new KeywordHandlerService();

// Export class for testing
export { KeywordHandlerService };
