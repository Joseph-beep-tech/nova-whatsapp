/**
 * Event Queue Service (BullMQ)
 *
 * Provides async event processing with Redis-backed queueing.
 * Decouples event receiving from processing for improved reliability.
 */

import { Queue, Worker, Job, QueueEvents, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { queueConfig, deduplicationConfig } from '../shared/config';
import { deduplicationService } from './deduplicationService';

/** Queued event payload */
export interface QueuedEvent {
  /** WhatsApp session ID */
  sessionId: string;
  /** Event type (e.g., 'message_create', 'qr', 'status_change') */
  dataType: string;
  /** Event data payload */
  data: Record<string, unknown>;
  /** ISO timestamp when event was received */
  receivedAt: string;
  /** Chat ID extracted from event (if available) */
  chatId?: string;
  /** User tags (looked up at queue time) */
  tags?: string[];
  /** Priority (1 = highest, higher numbers = lower priority) */
  priority?: number;
}

/** Result of event processing */
export interface ProcessingResult {
  success: boolean;
  jobId: string;
  routedTo?: string[];
  error?: string;
  message?: string;
}

/** Queue statistics */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/** Event handler function type */
export type EventHandler = (event: QueuedEvent) => Promise<ProcessingResult>;

/**
 * Event Queue Service
 *
 * Manages the BullMQ queue for async event processing.
 */
class EventQueueService {
  private queue: Queue<QueuedEvent> | null = null;
  private worker: Worker<QueuedEvent, ProcessingResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private connection: Redis | null = null;
  private eventHandler: EventHandler | null = null;
  private isInitialized = false;

  /**
   * Check if queue is enabled
   */
  isEnabled(): boolean {
    return queueConfig.enabled;
  }

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    if (!queueConfig.enabled) {
      console.log('[EventQueue] Queue disabled, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      console.log('[EventQueue] Already initialized');
      return;
    }

    try {
      // Create Redis connection
      this.connection = new Redis(queueConfig.redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      });

      this.connection.on('error', (err: Error) => {
        console.error('[EventQueue] Redis connection error:', err.message);
      });

      this.connection.on('connect', () => {
        console.log('[EventQueue] Redis connected');
      });

      // Create queue
      // Cast needed: ioredis and bullmq's bundled ioredis have incompatible types
      this.queue = new Queue<QueuedEvent>(queueConfig.eventQueueName, {
        connection: this.connection as unknown as ConnectionOptions,
        defaultJobOptions: {
          attempts: queueConfig.maxRetries,
          backoff: {
            type: 'exponential',
            delay: queueConfig.backoffDelay,
          },
          removeOnComplete: {
            age: queueConfig.jobRetentionMs / 1000, // Convert to seconds
          },
          removeOnFail: {
            age: queueConfig.jobRetentionMs / 1000 * 7, // Keep failed jobs longer
          },
        },
      });

      // Create queue events for monitoring
      this.queueEvents = new QueueEvents(queueConfig.eventQueueName, {
        connection: this.connection.duplicate() as unknown as ConnectionOptions,
      });

      this.queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
        console.log(`[EventQueue] Job ${jobId} completed`);
      });

      this.queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        console.error(`[EventQueue] Job ${jobId} failed:`, failedReason);
      });

      this.isInitialized = true;
      console.log('[EventQueue] Initialized successfully');
    } catch (error) {
      console.error('[EventQueue] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set the event handler that processes queued events
   */
  setEventHandler(handler: EventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Start the worker to process queued events
   */
  startWorker(): void {
    if (!queueConfig.enabled || !this.connection || !this.eventHandler) {
      console.log('[EventQueue] Cannot start worker - queue disabled or not initialized');
      return;
    }

    if (this.worker) {
      console.log('[EventQueue] Worker already running');
      return;
    }

    this.worker = new Worker<QueuedEvent, ProcessingResult>(
      queueConfig.eventQueueName,
      async (job: Job<QueuedEvent>) => {
        console.log(`[EventQueue] Processing job ${job.id}:`, job.data.dataType);

        if (!this.eventHandler) {
          throw new Error('No event handler configured');
        }

        // Check for duplicate events (especially edits and reactions)
        if (deduplicationConfig.enabled && job.data.chatId) {
          try {
            const dedupResult = await deduplicationService.checkDuplicate(
              job.data.dataType,
              job.data.data,
              job.data.chatId
            );

            if (dedupResult.isDuplicate) {
              console.log(
                `[EventQueue] Skipping duplicate ${dedupResult.event.eventType} event:`,
                dedupResult.event.eventId,
                dedupResult.reason || ''
              );

              return {
                success: true,
                jobId: job.id || 'unknown',
                message: `Duplicate event skipped: ${dedupResult.reason}`,
                routedTo: ['deduplication-filter'],
              };
            }

            // Log related message IDs for edits/reactions/acks
            if (dedupResult.relatedMessageId) {
              console.log(
                `[EventQueue] ${dedupResult.event.eventType} relates to message:`,
                dedupResult.relatedMessageId
              );
            }
          } catch (error) {
            // Don't fail the job if deduplication check fails
            // Log the error and continue with normal processing
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(
              `[EventQueue] Deduplication check failed for job ${job.id}:`,
              errorMessage
            );
          }
        }

        return await this.eventHandler(job.data);
      },
      {
        connection: this.connection.duplicate() as unknown as ConnectionOptions,
        concurrency: queueConfig.concurrency,
      }
    );

    this.worker.on('completed', (job: Job<QueuedEvent, ProcessingResult>, result: ProcessingResult) => {
      console.log(`[EventQueue] Job ${job.id} completed:`, result.routedTo?.join(', ') || 'no routes');
    });

    this.worker.on('failed', (job: Job<QueuedEvent, ProcessingResult> | undefined, err: Error) => {
      console.error(`[EventQueue] Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err: Error) => {
      console.error('[EventQueue] Worker error:', err.message);
    });

    console.log('[EventQueue] Worker started');
  }

  /**
   * Add an event to the queue
   */
  async enqueue(event: QueuedEvent): Promise<string> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.queue.add(event.dataType, event, {
      priority: event.priority || 10, // Default priority
    });

    console.log(`[EventQueue] Enqueued job ${job.id}:`, event.dataType);
    return job.id || 'unknown';
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get recent failed jobs for debugging
   */
  async getFailedJobs(count = 10): Promise<Array<{ id: string; data: QueuedEvent; error: string }>> {
    if (!this.queue) {
      return [];
    }

    const jobs = await this.queue.getFailed(0, count - 1);
    return jobs.map((job: Job<QueuedEvent>) => ({
      id: job.id || 'unknown',
      data: job.data,
      error: job.failedReason || 'Unknown error',
    }));
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      console.log('[EventQueue] Queue paused');
    }
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      console.log('[EventQueue] Queue resumed');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[EventQueue] Shutting down...');

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }

    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this.isInitialized = false;
    console.log('[EventQueue] Shutdown complete');
  }
}

// Singleton instance
export const eventQueue = new EventQueueService();
