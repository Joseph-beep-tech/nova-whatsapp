/**
 * Message Router Handler
 *
 * Core routing logic migrated from n8n Router workflow.
 * Implements:
 * - Feedback loop prevention (fromMe filter)
 * - Deduplication (Redis-backed or in-memory fallback)
 * - Tag detection (SOMO, HELLO_TRACTOR, etc.)
 * - Keyword detection (echo, ping, help)
 */

import { RoutableEvent } from '../types/routing';
import { deduplicationService } from '../services/deduplicationService';
import { deduplicationConfig } from '../shared/config';

/**
 * Routing decision result
 */
export interface RoutingDecision {
  /** Whether the message should be processed */
  shouldProcess: boolean;
  /** Reason for skipping (if shouldProcess is false) */
  skipReason?: 'own_message' | 'duplicate' | 'invalid_event';
  /** Tags detected in the message content */
  detectedTags: string[];
  /** Keywords detected in the message content */
  keywords: string[];
  /** Whether the message is from a group */
  isGroup: boolean;
  /** Extracted message body */
  messageBody: string;
  /** Whether the message is from the bot itself */
  fromMe: boolean;
}

/**
 * Configuration for the message router
 */
export interface MessageRouterConfig {
  /** Deduplication window in milliseconds (default: 60000) */
  deduplicationWindowMs: number;
  /** Tag patterns to detect (tag name -> regex) */
  tagPatterns: Map<string, RegExp>;
  /** Keyword patterns to detect (keyword name -> regex) */
  keywordPatterns: Map<string, RegExp>;
  /** Use enhanced deduplication service (default: true if enabled in config) */
  useDeduplicationService: boolean;
}

/**
 * Default tag patterns
 */
const DEFAULT_TAG_PATTERNS = new Map<string, RegExp>([
  ['SOMO', /\bSOMO\b/i],
  ['HELLO_TRACTOR', /\bHELLO[_\s]?TRACTOR\b/i],
]);

/**
 * Default keyword patterns
 */
const DEFAULT_KEYWORD_PATTERNS = new Map<string, RegExp>([
  ['echo', /^echo\s+(.+)$/i],
  ['ping', /^(ping|\/ping)\s*$/i],
  ['help', /^(help|\/help)\s*$/i],
  ['status', /^\/status\s*$/i],
]);

/**
 * Message Router Service
 *
 * Provides central routing decision logic for incoming messages.
 * Migrated from n8n "Extract & Route" code node.
 */
class MessageRouterService {
  private recentMessages: Map<string, number> = new Map();
  private config: MessageRouterConfig;

  constructor(config?: Partial<MessageRouterConfig>) {
    this.config = {
      deduplicationWindowMs: config?.deduplicationWindowMs ?? 60000,
      tagPatterns: config?.tagPatterns ?? DEFAULT_TAG_PATTERNS,
      keywordPatterns: config?.keywordPatterns ?? DEFAULT_KEYWORD_PATTERNS,
      useDeduplicationService: config?.useDeduplicationService ?? deduplicationConfig.enabled,
    };
  }

  /**
   * Main routing decision
   *
   * Determines whether a message should be processed and extracts
   * routing metadata (tags, keywords, etc.)
   */
  async route(event: RoutableEvent): Promise<RoutingDecision> {
    const { data, identifier, platform, dataType } = event;
    const message = this.extractMessage(data);
    const messageBody = message.body;
    const fromMe = message.fromMe;
    const isGroup = platform === 'g.us';

    // Base result
    const baseResult: Partial<RoutingDecision> = {
      messageBody,
      fromMe,
      isGroup,
      detectedTags: [],
      keywords: [],
    };

    // Layer 0: Event type filtering
    // Only process message events
    const validEventTypes = ['message', 'message_create'];
    if (!validEventTypes.includes(dataType)) {
      return {
        ...baseResult,
        shouldProcess: false,
        skipReason: 'invalid_event',
        detectedTags: [],
        keywords: [],
      } as RoutingDecision;
    }

    // Layer 1: Feedback loop prevention
    // Skip messages sent by the bot itself (prevents echo loops)
    if (fromMe) {
      return {
        ...baseResult,
        shouldProcess: false,
        skipReason: 'own_message',
        detectedTags: [],
        keywords: [],
      } as RoutingDecision;
    }

    // Layer 2: Deduplication
    // Use enhanced deduplication service if enabled, otherwise fall back to in-memory Map
    let usedDeduplicationService = false;

    if (this.config.useDeduplicationService) {
      // Try to use enhanced deduplication service
      try {
        const dedupResult = await deduplicationService.checkDuplicate(dataType, data, identifier);

        if (dedupResult.isDuplicate) {
          return {
            ...baseResult,
            shouldProcess: false,
            skipReason: 'duplicate',
            detectedTags: [],
            keywords: [],
          } as RoutingDecision;
        }

        usedDeduplicationService = true;
      } catch (error) {
        // Log error and fall back to in-memory deduplication
        console.error('[MessageRouter] Deduplication service error, falling back to in-memory:', error);
      }
    }

    // In-memory deduplication (fallback or when service is disabled)
    if (!usedDeduplicationService) {
      const messageKey = `${identifier}:${messageBody.slice(0, 50)}`;
      const now = Date.now();
      const lastSeen = this.recentMessages.get(messageKey);

      if (lastSeen && now - lastSeen < this.config.deduplicationWindowMs) {
        return {
          ...baseResult,
          shouldProcess: false,
          skipReason: 'duplicate',
          detectedTags: [],
          keywords: [],
        } as RoutingDecision;
      }

      // Record this message
      this.recentMessages.set(messageKey, now);
      this.cleanOldEntries(now);
    }

    // Detect tags in message content
    const detectedTags = this.detectTags(messageBody);

    // Detect keywords in message content
    const keywords = this.detectKeywords(messageBody);

    return {
      shouldProcess: true,
      detectedTags,
      keywords,
      isGroup,
      messageBody,
      fromMe,
    };
  }

  /**
   * Detect tags in message content
   */
  detectTags(content: string): string[] {
    const detected: string[] = [];
    for (const [tag, pattern] of this.config.tagPatterns) {
      if (pattern.test(content)) {
        detected.push(tag);
      }
    }
    return detected;
  }

  /**
   * Detect keywords in message content
   */
  detectKeywords(content: string): string[] {
    const detected: string[] = [];
    for (const [keyword, pattern] of this.config.keywordPatterns) {
      if (pattern.test(content)) {
        detected.push(keyword);
      }
    }
    return detected;
  }

  /**
   * Add a tag pattern
   */
  addTagPattern(tag: string, pattern: RegExp): void {
    this.config.tagPatterns.set(tag, pattern);
  }

  /**
   * Register a tag pattern (alias for addTagPattern)
   */
  registerTagPattern(tag: string, pattern: RegExp): void {
    this.addTagPattern(tag, pattern);
  }

  /**
   * Remove a tag pattern
   */
  removeTagPattern(tag: string): boolean {
    return this.config.tagPatterns.delete(tag);
  }

  /**
   * Add a keyword pattern
   */
  addKeywordPattern(keyword: string, pattern: RegExp): void {
    this.config.keywordPatterns.set(keyword, pattern);
  }

  /**
   * Remove a keyword pattern
   */
  removeKeywordPattern(keyword: string): boolean {
    return this.config.keywordPatterns.delete(keyword);
  }

  /**
   * Get current configuration
   */
  getConfig(): MessageRouterConfig {
    return { ...this.config };
  }

  /**
   * Extract message data from event payload
   */
  private extractMessage(data: Record<string, unknown>): { body: string; fromMe: boolean } {
    // Try different locations where message data might be
    const message = (data.message || data.msg || data) as Record<string, unknown>;

    return {
      body: String(message.body || ''),
      fromMe: Boolean(message.fromMe),
    };
  }

  /**
   * Clean old deduplication entries
   */
  private cleanOldEntries(now: number): void {
    const maxAge = this.config.deduplicationWindowMs * 2;
    for (const [key, time] of this.recentMessages) {
      if (now - time > maxAge) {
        this.recentMessages.delete(key);
      }
    }
  }

  /**
   * Clear all deduplication entries (for testing)
   */
  async clearDeduplicationCache(): Promise<void> {
    this.recentMessages.clear();

    if (this.config.useDeduplicationService) {
      try {
        await deduplicationService.clearCache();
      } catch (error) {
        console.error('[MessageRouter] Error clearing deduplication service cache:', error);
      }
    }
  }

  /**
   * Get deduplication cache size (for testing/monitoring)
   */
  async getDeduplicationCacheSize(): Promise<number> {
    if (this.config.useDeduplicationService) {
      try {
        return await deduplicationService.getCacheSize();
      } catch (error) {
        console.error('[MessageRouter] Error getting deduplication service cache size:', error);
        return this.recentMessages.size;
      }
    }

    return this.recentMessages.size;
  }
}

// Singleton instance
export const messageRouter = new MessageRouterService();

// Export class for testing
export { MessageRouterService };
