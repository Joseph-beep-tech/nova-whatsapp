/**
 * Event Deduplication Service
 *
 * Provides Redis-backed event deduplication with metrics tracking.
 * Prevents duplicate message processing by tracking event IDs with configurable TTL.
 *
 * Handles:
 * - Message deduplication (prevent duplicate responses)
 * - Edit correlation (track message edits)
 * - Reaction tracking (correlate reactions with original messages)
 * - Delivery receipt deduplication
 */

import Redis from 'ioredis';
import { queueConfig } from '../shared/config';
import { eventNormalizer, NormalizedEvent } from '../utils/eventNormalizer';

/**
 * Deduplication check result
 */
export interface DeduplicationResult {
  /** Whether this event is a duplicate */
  isDuplicate: boolean;
  /** Normalized event details */
  event: NormalizedEvent;
  /** Reason for duplicate detection (if isDuplicate is true) */
  reason?: string;
  /** Related message ID (for edits, reactions, acks) */
  relatedMessageId?: string;
}

/**
 * Deduplication metrics by event type
 */
export interface EventTypeMetrics {
  /** Total events of this type */
  total: number;
  /** Duplicates detected of this type */
  duplicates: number;
  /** Duplicate rate as percentage */
  duplicateRate: number;
}

/**
 * Overall deduplication metrics
 */
export interface DeduplicationMetrics {
  /** Total events processed */
  totalEvents: number;
  /** Total duplicates detected */
  duplicatesDetected: number;
  /** Overall duplicate rate as percentage */
  duplicateRate: number;
  /** Breakdown by event type */
  byEventType: Record<string, EventTypeMetrics>;
  /** Service uptime in seconds */
  uptimeSeconds: number;
  /** Redis connection status */
  redisConnected: boolean;
}

/**
 * Configuration for deduplication service
 */
export interface DeduplicationConfig {
  /** Deduplication window in seconds (default: 300 = 5 minutes) */
  windowSeconds: number;
  /** Enable Redis backing (default: true if queue is enabled) */
  useRedis: boolean;
  /** Redis key prefix */
  keyPrefix: string;
}

/**
 * Event Deduplication Service
 *
 * Provides centralized deduplication logic with Redis backing and metrics.
 */
export class DeduplicationService {
  private redis: Redis | null = null;
  private config: DeduplicationConfig;
  private isInitialized = false;
  private startTime = Date.now();

  // In-memory fallback when Redis is disabled
  private memoryCache: Map<string, number> = new Map();

  // Metrics counters
  private metrics = {
    total: 0,
    duplicates: 0,
    byType: new Map<string, { total: number; duplicates: number }>(),
  };

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = {
      windowSeconds: config?.windowSeconds ?? 300, // 5 minutes default
      useRedis: config?.useRedis ?? queueConfig.enabled,
      keyPrefix: config?.keyPrefix ?? 'dedup:event:',
    };
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.config.useRedis;
  }

  /**
   * Initialize the deduplication service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[DeduplicationService] Already initialized');
      return;
    }

    if (!this.config.useRedis) {
      console.log('[DeduplicationService] Redis disabled, using in-memory cache');
      this.isInitialized = true;
      return;
    }

    try {
      // Create Redis connection
      this.redis = new Redis(queueConfig.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.redis.on('error', (err: Error) => {
        console.error('[DeduplicationService] Redis connection error:', err.message);
      });

      this.redis.on('connect', () => {
        console.log('[DeduplicationService] Redis connected');
      });

      this.isInitialized = true;
      console.log('[DeduplicationService] Initialized successfully');
    } catch (error) {
      console.error('[DeduplicationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if an event is a duplicate
   *
   * @param dataType - Event type (e.g., 'message_create', 'message_edit')
   * @param data - Event data payload
   * @param identifier - User identifier (phone number or group ID)
   * @returns Deduplication result
   */
  async checkDuplicate(
    dataType: string,
    data: Record<string, unknown>,
    identifier: string
  ): Promise<DeduplicationResult> {
    // Normalize the event
    const normalized = eventNormalizer.normalize(dataType, data, identifier);

    // Update metrics
    this.incrementMetric(normalized.eventType, 'total');

    // Check for duplicate
    const isDuplicate = await this.isDuplicateEvent(normalized.eventId);

    if (isDuplicate) {
      this.incrementMetric(normalized.eventType, 'duplicates');
      return {
        isDuplicate: true,
        event: normalized,
        reason: 'Event ID already seen within deduplication window',
        relatedMessageId: normalized.relatedMessageId,
      };
    }

    // Record this event
    await this.recordEvent(normalized.eventId);

    return {
      isDuplicate: false,
      event: normalized,
      relatedMessageId: normalized.relatedMessageId,
    };
  }

  /**
   * Check if event ID exists in cache
   */
  private async isDuplicateEvent(eventId: string): Promise<boolean> {
    if (this.redis) {
      // Redis-backed check
      const key = this.getRedisKey(eventId);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } else {
      // In-memory fallback
      const timestamp = this.memoryCache.get(eventId);
      if (!timestamp) {
        return false;
      }

      // Check if still within window
      const now = Date.now();
      const windowMs = this.config.windowSeconds * 1000;
      if (now - timestamp > windowMs) {
        // Expired, remove it
        this.memoryCache.delete(eventId);
        return false;
      }

      return true;
    }
  }

  /**
   * Record an event in the deduplication cache
   */
  private async recordEvent(eventId: string): Promise<void> {
    if (this.redis) {
      // Store in Redis with TTL
      const key = this.getRedisKey(eventId);
      await this.redis.setex(key, this.config.windowSeconds, Date.now().toString());
    } else {
      // Store in memory
      this.memoryCache.set(eventId, Date.now());
      // Clean old entries periodically
      this.cleanOldMemoryEntries();
    }
  }

  /**
   * Get Redis key for an event ID
   */
  private getRedisKey(eventId: string): string {
    return `${this.config.keyPrefix}${eventId}`;
  }

  /**
   * Increment metrics counter
   */
  private incrementMetric(eventType: string, metric: 'total' | 'duplicates'): void {
    // Update overall metrics
    if (metric === 'total') {
      this.metrics.total++;
    } else {
      this.metrics.duplicates++;
    }

    // Update per-type metrics
    if (!this.metrics.byType.has(eventType)) {
      this.metrics.byType.set(eventType, { total: 0, duplicates: 0 });
    }

    const typeMetrics = this.metrics.byType.get(eventType)!;
    if (metric === 'total') {
      typeMetrics.total++;
    } else {
      typeMetrics.duplicates++;
    }
  }

  /**
   * Clean old entries from in-memory cache
   */
  private cleanOldMemoryEntries(): void {
    if (this.redis) {
      return; // Redis handles TTL automatically
    }

    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;

    for (const [key, timestamp] of this.memoryCache.entries()) {
      if (now - timestamp > windowMs * 2) {
        // Keep entries up to 2x window for safety
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get deduplication metrics
   */
  async getMetrics(): Promise<DeduplicationMetrics> {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const redisConnected = this.redis?.status === 'ready';

    // Calculate overall duplicate rate
    const duplicateRate = this.metrics.total > 0
      ? (this.metrics.duplicates / this.metrics.total) * 100
      : 0;

    // Calculate per-type metrics
    const byEventType: Record<string, EventTypeMetrics> = {};
    for (const [type, counts] of this.metrics.byType.entries()) {
      const typeRate = counts.total > 0
        ? (counts.duplicates / counts.total) * 100
        : 0;

      byEventType[type] = {
        total: counts.total,
        duplicates: counts.duplicates,
        duplicateRate: Math.round(typeRate * 100) / 100, // Round to 2 decimal places
      };
    }

    return {
      totalEvents: this.metrics.total,
      duplicatesDetected: this.metrics.duplicates,
      duplicateRate: Math.round(duplicateRate * 100) / 100,
      byEventType,
      uptimeSeconds,
      redisConnected,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Update deduplication window
   */
  setDeduplicationWindow(windowSeconds: number): void {
    this.config.windowSeconds = windowSeconds;
    console.log(`[DeduplicationService] Deduplication window updated to ${windowSeconds}s`);
  }

  /**
   * Clear all deduplication data (for testing)
   */
  async clearCache(): Promise<void> {
    if (this.redis) {
      // Delete all keys matching our prefix
      const pattern = `${this.config.keyPrefix}*`;
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = this.redis!.pipeline();
          keys.forEach((key) => pipeline.del(key));
          await pipeline.exec();
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });
    } else {
      this.memoryCache.clear();
    }

    console.log('[DeduplicationService] Cache cleared');
  }

  /**
   * Reset metrics counters (for testing)
   */
  resetMetrics(): void {
    this.metrics.total = 0;
    this.metrics.duplicates = 0;
    this.metrics.byType.clear();
    this.startTime = Date.now();
    console.log('[DeduplicationService] Metrics reset');
  }

  /**
   * Get cache size (for monitoring)
   */
  async getCacheSize(): Promise<number> {
    if (this.redis) {
      const pattern = `${this.config.keyPrefix}*`;
      let count = 0;
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on('data', (keys: string[]) => {
        count += keys.length;
      });

      return new Promise<number>((resolve, reject) => {
        stream.on('end', () => resolve(count));
        stream.on('error', (err: Error) => reject(err));
      });
    } else {
      return this.memoryCache.size;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[DeduplicationService] Shutting down...');

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    this.memoryCache.clear();
    this.isInitialized = false;
    console.log('[DeduplicationService] Shutdown complete');
  }
}

// Singleton instance
export const deduplicationService = new DeduplicationService();
