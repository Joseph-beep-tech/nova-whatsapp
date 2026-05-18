/**
 * Thread Detector Service
 *
 * Detects conversation thread boundaries based on:
 * - Time gaps between messages
 * - Topic shifts (using keyword overlap)
 *
 * Threads help group related messages for better context retrieval.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ConversationMessage,
  ConversationThread,
  ThreadDetectionConfig,
} from '../types/memory';
import { extractKeywords } from './qdrantHandler';
import { WhatsAppPlatform, DEFAULT_PLATFORM } from '../utils/phoneNumber';

// =============================================================================
// Configuration Defaults
// =============================================================================

const DEFAULT_CONFIG: Required<ThreadDetectionConfig> = {
  maxGapMs: 30 * 60 * 1000, // 30 minutes
  minTopicSimilarity: 0.2, // 20% keyword overlap to continue thread
  useSemanticDetection: false, // Start with simple heuristics
};

// =============================================================================
// Thread State Management
// =============================================================================

interface ActiveThread {
  threadId: string;
  identifier: string;
  platform: WhatsAppPlatform;
  sessionId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  keywords: Set<string>;
  topics: string[];
}

/**
 * In-memory cache of active threads per identifier
 * Key: identifier
 */
const activeThreads: Map<string, ActiveThread> = new Map();

// =============================================================================
// Thread Detection Functions
// =============================================================================

/**
 * Calculate keyword overlap between two sets
 * Returns Jaccard similarity (0-1)
 */
function calculateKeywordSimilarity(
  keywords1: Set<string>,
  keywords2: Set<string>
): number {
  if (keywords1.size === 0 || keywords2.size === 0) {
    return 0;
  }

  const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

/**
 * Check if enough time has passed to start a new thread
 */
function isTimeGapExceeded(
  lastMessageTime: string,
  newMessageTime: string,
  maxGapMs: number
): boolean {
  const lastTime = new Date(lastMessageTime).getTime();
  const newTime = new Date(newMessageTime).getTime();
  return newTime - lastTime > maxGapMs;
}

/**
 * Detect if a new message starts a new thread or continues existing one
 */
export function detectThreadBoundary(
  message: ConversationMessage,
  config: ThreadDetectionConfig = {}
): {
  threadId: string;
  isNewThread: boolean;
  positionInThread: number;
  isThreadStart: boolean;
} {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const identifier = message.identifier;

  // Get active thread for this identifier
  const activeThread = activeThreads.get(identifier);
  const messageKeywords = new Set(extractKeywords(message.content));

  // Determine if we should start a new thread
  let shouldStartNewThread = false;

  if (!activeThread) {
    // No active thread - start new one
    shouldStartNewThread = true;
  } else {
    // Check time gap
    if (isTimeGapExceeded(activeThread.lastMessageAt, message.timestamp, mergedConfig.maxGapMs)) {
      shouldStartNewThread = true;
    }

    // Check topic similarity (only if semantic detection enabled or time gap check passed)
    if (!shouldStartNewThread && mergedConfig.minTopicSimilarity > 0) {
      const similarity = calculateKeywordSimilarity(activeThread.keywords, messageKeywords);
      if (similarity < mergedConfig.minTopicSimilarity) {
        // Topic shifted significantly
        shouldStartNewThread = true;
      }
    }
  }

  if (shouldStartNewThread) {
    // Create new thread
    const newThread: ActiveThread = {
      threadId: uuidv4(),
      identifier: message.identifier,
      platform: message.platform,
      sessionId: message.sessionId,
      startedAt: message.timestamp,
      lastMessageAt: message.timestamp,
      messageCount: 1,
      keywords: messageKeywords,
      topics: Array.from(messageKeywords).slice(0, 5),
    };

    activeThreads.set(identifier, newThread);

    return {
      threadId: newThread.threadId,
      isNewThread: true,
      positionInThread: 0,
      isThreadStart: true,
    };
  }

  // Continue existing thread
  const thread = activeThread!;
  thread.lastMessageAt = message.timestamp;
  thread.messageCount += 1;

  // Merge keywords (keep last N unique)
  messageKeywords.forEach(k => thread.keywords.add(k));
  if (thread.keywords.size > 50) {
    // Trim to most recent keywords
    const keywordArray = Array.from(thread.keywords);
    thread.keywords = new Set(keywordArray.slice(-50));
  }

  return {
    threadId: thread.threadId,
    isNewThread: false,
    positionInThread: thread.messageCount - 1,
    isThreadStart: false,
  };
}

/**
 * Get the current active thread for an identifier (if any)
 */
export function getActiveThread(identifier: string): ConversationThread | null {
  const thread = activeThreads.get(identifier);
  if (!thread) {
    return null;
  }

  return {
    threadId: thread.threadId,
    identifier: thread.identifier,
    platform: thread.platform,
    sessionId: thread.sessionId,
    startedAt: thread.startedAt,
    endedAt: null, // Active threads don't have an end time
    messageCount: thread.messageCount,
    topics: thread.topics,
    isActive: true,
  };
}

/**
 * Close the active thread for an identifier
 * Returns the closed thread, or null if no active thread
 */
export function closeThread(identifier: string): ConversationThread | null {
  const thread = activeThreads.get(identifier);
  if (!thread) {
    return null;
  }

  activeThreads.delete(identifier);

  return {
    threadId: thread.threadId,
    identifier: thread.identifier,
    platform: thread.platform,
    sessionId: thread.sessionId,
    startedAt: thread.startedAt,
    endedAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    topics: thread.topics,
    isActive: false,
  };
}

/**
 * Force start a new thread for an identifier
 * Closes any existing thread and returns the new thread ID
 */
export function forceNewThread(
  identifier: string,
  sessionId: string,
  timestamp: string,
  platform: WhatsAppPlatform = DEFAULT_PLATFORM
): string {
  // Close existing thread
  closeThread(identifier);

  // Create new thread
  const newThread: ActiveThread = {
    threadId: uuidv4(),
    identifier,
    platform,
    sessionId,
    startedAt: timestamp,
    lastMessageAt: timestamp,
    messageCount: 0,
    keywords: new Set(),
    topics: [],
  };

  activeThreads.set(identifier, newThread);

  return newThread.threadId;
}

/**
 * Get statistics about active threads
 */
export function getThreadStats(): {
  activeThreadCount: number;
  oldestThreadAge: number | null;
  avgMessagesPerThread: number;
} {
  const threads = Array.from(activeThreads.values());

  if (threads.length === 0) {
    return {
      activeThreadCount: 0,
      oldestThreadAge: null,
      avgMessagesPerThread: 0,
    };
  }

  const now = Date.now();
  let oldestAge = 0;
  let totalMessages = 0;

  for (const thread of threads) {
    const age = now - new Date(thread.startedAt).getTime();
    if (age > oldestAge) {
      oldestAge = age;
    }
    totalMessages += thread.messageCount;
  }

  return {
    activeThreadCount: threads.length,
    oldestThreadAge: oldestAge,
    avgMessagesPerThread: totalMessages / threads.length,
  };
}

/**
 * Clean up old threads that haven't had activity
 * Returns number of threads closed
 */
export function cleanupStaleThreads(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let closedCount = 0;

  for (const [identifier, thread] of activeThreads) {
    const age = now - new Date(thread.lastMessageAt).getTime();
    if (age > maxAgeMs) {
      activeThreads.delete(identifier);
      closedCount++;
    }
  }

  if (closedCount > 0) {
    console.log(`[ThreadDetector] Cleaned up ${closedCount} stale threads`);
  }

  return closedCount;
}

// =============================================================================
// Exports
// =============================================================================

export {
  calculateKeywordSimilarity,
  isTimeGapExceeded,
  DEFAULT_CONFIG as THREAD_DETECTION_DEFAULTS,
};
