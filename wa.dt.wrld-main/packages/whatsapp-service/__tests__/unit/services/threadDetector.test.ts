/**
 * Thread Detector Service Tests
 *
 * Tests for conversation thread detection including:
 * - Thread boundary detection
 * - Time gap detection
 * - Topic similarity calculation
 * - Thread lifecycle management
 */

// Set env vars before any imports
process.env.API_KEY = process.env.API_KEY || 'test-api-key';

import {
  detectThreadBoundary,
  getActiveThread,
  closeThread,
  forceNewThread,
  getThreadStats,
  cleanupStaleThreads,
  calculateKeywordSimilarity,
  isTimeGapExceeded,
  THREAD_DETECTION_DEFAULTS,
} from '../../../src/services/threadDetector';
import { ConversationMessage } from '../../../src/types/memory';

describe('Thread Detector Service', () => {
  // Reset thread state between tests
  beforeEach(() => {
    // Close any active threads from previous tests
    const stats = getThreadStats();
    if (stats.activeThreadCount > 0) {
      cleanupStaleThreads(0); // Clean all threads
    }
  });

  describe('calculateKeywordSimilarity', () => {
    it('should return 1.0 for identical sets', () => {
      const set1 = new Set(['apple', 'banana', 'cherry']);
      const set2 = new Set(['apple', 'banana', 'cherry']);

      expect(calculateKeywordSimilarity(set1, set2)).toBe(1.0);
    });

    it('should return 0 for completely different sets', () => {
      const set1 = new Set(['apple', 'banana']);
      const set2 = new Set(['cherry', 'date']);

      expect(calculateKeywordSimilarity(set1, set2)).toBe(0);
    });

    it('should return partial similarity for overlapping sets', () => {
      const set1 = new Set(['apple', 'banana', 'cherry']);
      const set2 = new Set(['banana', 'cherry', 'date']);

      // Intersection: banana, cherry (2)
      // Union: apple, banana, cherry, date (4)
      // Jaccard: 2/4 = 0.5
      expect(calculateKeywordSimilarity(set1, set2)).toBe(0.5);
    });

    it('should return 0 for empty sets', () => {
      expect(calculateKeywordSimilarity(new Set(), new Set(['a']))).toBe(0);
      expect(calculateKeywordSimilarity(new Set(['a']), new Set())).toBe(0);
      expect(calculateKeywordSimilarity(new Set(), new Set())).toBe(0);
    });
  });

  describe('isTimeGapExceeded', () => {
    it('should return true when gap exceeds threshold', () => {
      const lastTime = '2024-01-15T10:00:00Z';
      const newTime = '2024-01-15T11:00:00Z'; // 1 hour later
      const maxGapMs = 30 * 60 * 1000; // 30 minutes

      expect(isTimeGapExceeded(lastTime, newTime, maxGapMs)).toBe(true);
    });

    it('should return false when gap is within threshold', () => {
      const lastTime = '2024-01-15T10:00:00Z';
      const newTime = '2024-01-15T10:15:00Z'; // 15 minutes later
      const maxGapMs = 30 * 60 * 1000; // 30 minutes

      expect(isTimeGapExceeded(lastTime, newTime, maxGapMs)).toBe(false);
    });

    it('should return false for exactly threshold gap', () => {
      const lastTime = '2024-01-15T10:00:00Z';
      const newTime = '2024-01-15T10:30:00Z'; // Exactly 30 minutes later
      const maxGapMs = 30 * 60 * 1000; // 30 minutes

      expect(isTimeGapExceeded(lastTime, newTime, maxGapMs)).toBe(false);
    });
  });

  describe('detectThreadBoundary', () => {
    it('should create new thread for first message', () => {
      const message: ConversationMessage = {
        id: 'msg-1',
        identifier: 'chat-new',
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Hello, I need help with something',
        timestamp: '2024-01-15T10:00:00Z',
        tags: ['support'],
      };

      const result = detectThreadBoundary(message);

      expect(result.isNewThread).toBe(true);
      expect(result.isThreadStart).toBe(true);
      expect(result.positionInThread).toBe(0);
      expect(result.threadId).toBeDefined();
    });

    it('should continue thread for related messages within time window', () => {
      const identifier = 'chat-continue';

      // First message
      const msg1: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'I want to learn about Python programming basics',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      const result1 = detectThreadBoundary(msg1);
      expect(result1.isNewThread).toBe(true);

      // Second message - overlapping keywords (python, programming, basics), within time window
      const msg2: ConversationMessage = {
        id: 'msg-2',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Show me Python programming examples for basics',
        timestamp: '2024-01-15T10:05:00Z',
        tags: [],
      };

      const result2 = detectThreadBoundary(msg2);

      expect(result2.isNewThread).toBe(false);
      expect(result2.threadId).toBe(result1.threadId);
      expect(result2.positionInThread).toBe(1);
    });

    it('should start new thread after time gap', () => {
      const identifier = 'chat-timegap';

      // First message
      const msg1: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Discussing topic A',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      const result1 = detectThreadBoundary(msg1);

      // Second message - same keywords but after time gap
      const msg2: ConversationMessage = {
        id: 'msg-2',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Still discussing topic A',
        timestamp: '2024-01-15T12:00:00Z', // 2 hours later
        tags: [],
      };

      const result2 = detectThreadBoundary(msg2);

      expect(result2.isNewThread).toBe(true);
      expect(result2.threadId).not.toBe(result1.threadId);
    });

    it('should respect custom config for time gap', () => {
      const identifier = 'chat-config';

      const msg1: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'First message about coding',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      detectThreadBoundary(msg1);

      // 10 minutes later
      const msg2: ConversationMessage = {
        id: 'msg-2',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Second message about coding',
        timestamp: '2024-01-15T10:10:00Z',
        tags: [],
      };

      // With 5 minute max gap, should start new thread
      const result = detectThreadBoundary(msg2, { maxGapMs: 5 * 60 * 1000 });

      expect(result.isNewThread).toBe(true);
    });
  });

  describe('getActiveThread', () => {
    it('should return null when no active thread', () => {
      const thread = getActiveThread('nonexistent-chat');

      expect(thread).toBeNull();
    });

    it('should return active thread info', () => {
      const identifier = 'chat-active';

      const message: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Starting a new conversation',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      detectThreadBoundary(message);

      const thread = getActiveThread(identifier);

      expect(thread).not.toBeNull();
      expect(thread!.identifier).toBe(identifier);
      expect(thread!.isActive).toBe(true);
      expect(thread!.messageCount).toBe(1);
    });
  });

  describe('closeThread', () => {
    it('should return null for nonexistent thread', () => {
      const result = closeThread('nonexistent-chat');

      expect(result).toBeNull();
    });

    it('should close active thread and return it', () => {
      const identifier = 'chat-close';

      const message: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      const { threadId } = detectThreadBoundary(message);
      const closedThread = closeThread(identifier);

      expect(closedThread).not.toBeNull();
      expect(closedThread!.threadId).toBe(threadId);
      expect(closedThread!.isActive).toBe(false);
      expect(closedThread!.endedAt).not.toBeNull();

      // Should no longer have active thread
      expect(getActiveThread(identifier)).toBeNull();
    });
  });

  describe('forceNewThread', () => {
    it('should create new thread for chat', () => {
      const identifier = 'chat-force';
      const sessionId = 'session-1';
      const timestamp = '2024-01-15T10:00:00Z';

      const threadId = forceNewThread(identifier, sessionId, timestamp);

      expect(threadId).toBeDefined();

      const thread = getActiveThread(identifier);
      expect(thread).not.toBeNull();
      expect(thread!.threadId).toBe(threadId);
    });

    it('should close existing thread before creating new one', () => {
      const identifier = 'chat-force-replace';

      // Create first thread
      const message: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'First thread',
        timestamp: '2024-01-15T10:00:00Z',
        tags: [],
      };

      const { threadId: firstThreadId } = detectThreadBoundary(message);

      // Force new thread
      const newThreadId = forceNewThread(identifier, 'session-1', '2024-01-15T10:05:00Z');

      expect(newThreadId).not.toBe(firstThreadId);

      const thread = getActiveThread(identifier);
      expect(thread!.threadId).toBe(newThreadId);
    });
  });

  describe('getThreadStats', () => {
    it('should return zero stats when no threads', () => {
      const stats = getThreadStats();

      expect(stats.activeThreadCount).toBe(0);
      expect(stats.oldestThreadAge).toBeNull();
      expect(stats.avgMessagesPerThread).toBe(0);
    });

    it('should track multiple active threads', () => {
      // Create threads for multiple chats
      for (let i = 0; i < 3; i++) {
        const message: ConversationMessage = {
          id: `msg-${i}`,
          identifier: `chat-stats-${i}`,
          platform: 'c.us' as const,
          sessionId: 'session-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          tags: [],
        };
        detectThreadBoundary(message);
      }

      const stats = getThreadStats();

      expect(stats.activeThreadCount).toBe(3);
      expect(stats.avgMessagesPerThread).toBe(1);
    });
  });

  describe('cleanupStaleThreads', () => {
    it('should clean up old threads', () => {
      const identifier = 'chat-cleanup';

      // Create thread with old timestamp
      const message: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Old message',
        timestamp: '2024-01-01T10:00:00Z', // Very old
        tags: [],
      };

      detectThreadBoundary(message);

      // Cleanup with 1 hour max age
      const cleaned = cleanupStaleThreads(60 * 60 * 1000);

      expect(cleaned).toBe(1);
      expect(getActiveThread(identifier)).toBeNull();
    });

    it('should not clean up recent threads', () => {
      const identifier = 'chat-no-cleanup';

      const message: ConversationMessage = {
        id: 'msg-1',
        identifier,
        platform: 'c.us' as const,
        sessionId: 'session-1',
        role: 'user',
        content: 'Recent message',
        timestamp: new Date().toISOString(),
        tags: [],
      };

      detectThreadBoundary(message);

      // Cleanup with 1 hour max age
      const cleaned = cleanupStaleThreads(60 * 60 * 1000);

      expect(cleaned).toBe(0);
      expect(getActiveThread(identifier)).not.toBeNull();
    });
  });

  describe('THREAD_DETECTION_DEFAULTS', () => {
    it('should have reasonable default values', () => {
      expect(THREAD_DETECTION_DEFAULTS.maxGapMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(THREAD_DETECTION_DEFAULTS.minTopicSimilarity).toBe(0.2);
      expect(THREAD_DETECTION_DEFAULTS.useSemanticDetection).toBe(false);
    });
  });
});
