/**
 * Session Management Type Definitions
 *
 * Type definitions for multi-session WhatsApp bot architecture.
 * These types are independent of n8n integration and focus on core session management.
 */

import type { Client } from 'whatsapp-web.js';

/**
 * Session status enum
 */
export type SessionStatus =
  | 'initializing'  // Session is being created
  | 'qr_ready'      // QR code generated, waiting for scan
  | 'authenticated' // Authenticated but not fully ready
  | 'ready'         // Fully operational
  | 'disconnected'  // Connection lost
  | 'failed'        // Permanent failure
  | 'terminated';   // Manually terminated

/**
 * Session configuration
 * Defines how a session should behave
 */
export interface SessionConfig {
  /** Unique session identifier */
  sessionId: string;

  /** Session display name (optional) */
  name?: string;

  /** Session description (optional) */
  description?: string;

  /** Webhook URL for this session (optional, falls back to base webhook) */
  webhookUrl?: string;

  /** Webhook events to disable for this session */
  disabledCallbacks?: string[];

  /** Whether to mark incoming messages as read automatically */
  markMessagesAsRead?: boolean;

  /** Whether to enable auto-reconnection on disconnect */
  autoReconnect?: boolean;

  /** Maximum retry attempts for recovery */
  maxRetries?: number;

  /** Retry delay in milliseconds (base delay for exponential backoff) */
  retryDelay?: number;

  /** Custom metadata (key-value pairs for application use) */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt?: Date;

  /** Last active timestamp */
  lastActive?: Date;
}

/**
 * Session metadata stored in Redis
 */
export interface SessionMetadata {
  /** Unique session identifier */
  sessionId: string;

  /** Session display name */
  name: string;

  /** Session description */
  description: string;

  /** Current session status */
  status: SessionStatus;

  /** Webhook URL for this session */
  webhookUrl: string;

  /** Created timestamp (ISO string) */
  createdAt: string;

  /** Last active timestamp (ISO string) */
  lastActive: string;

  /** Total messages received */
  messagesReceived: number;

  /** Total messages sent */
  messagesSent: number;

  /** Total error count */
  errorCount: number;

  /** Current retry count (for recovery) */
  retryCount: number;

  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Session statistics
 */
export interface SessionStats {
  /** Unique session identifier */
  sessionId: string;

  /** Total messages received */
  messagesReceived: number;

  /** Total messages sent */
  messagesSent: number;

  /** Total errors encountered */
  errors: number;

  /** Session uptime in milliseconds */
  uptime: number;

  /** Created timestamp */
  createdAt: Date;

  /** Last active timestamp */
  lastActive: Date;
}

/**
 * Session information (extended with runtime details)
 */
export interface SessionInfo extends SessionMetadata {
  /** Memory usage for this session (bytes) */
  memoryUsage?: number;

  /** Whether the session has an active client connection */
  hasActiveClient: boolean;

  /** Current QR code (if status is qr_ready) */
  qrCode?: string;

  /** Session uptime in milliseconds */
  uptime?: number;
}

/**
 * WhatsApp session instance
 * Wraps a whatsapp-web.js Client with session-specific context
 */
export interface IWhatsAppSession {
  /** Unique session identifier */
  readonly sessionId: string;

  /** Session configuration */
  readonly config: SessionConfig;

  /** WhatsApp client instance */
  client: Client | null;

  /** Current session status */
  status: SessionStatus;

  /** Current QR code (if available) */
  qrCode: string | null;

  /** Session statistics */
  stats: SessionStats;

  /** Initialize the session (create client, set up handlers) */
  initialize(): Promise<void>;

  /** Terminate the session (destroy client, clean up) */
  terminate(): Promise<void>;

  /** Restart the session (terminate + initialize) */
  restart(): Promise<void>;

  /** Get current session status */
  getStatus(): SessionStatus;

  /** Get session information */
  getInfo(): SessionInfo;

  /** Update session statistics */
  updateStats(updates: Partial<SessionStats>): void;

  /** Check if session is ready */
  isReady(): boolean;

  /** Event emitter methods */
  on(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
  removeAllListeners(event?: string): this;
}

/**
 * Multi-session manager interface
 */
export interface IMultiSessionManager {
  /** Create a new session */
  createSession(sessionId: string, config?: Partial<SessionConfig>): Promise<IWhatsAppSession>;

  /** Get an existing session */
  getSession(sessionId: string): IWhatsAppSession | null;

  /** List all sessions */
  listSessions(): SessionInfo[];

  /** List active sessions only */
  listActiveSessions(): SessionInfo[];

  /** Terminate a session */
  terminateSession(sessionId: string): Promise<void>;

  /** Restart a session */
  restartSession(sessionId: string): Promise<void>;

  /** Restore all sessions from Redis */
  restoreAllSessions(): Promise<void>;

  /** Flush inactive sessions (older than maxInactiveDays) */
  flushInactiveSessions(maxInactiveDays: number): Promise<number>;

  /** Get session status */
  getSessionStatus(sessionId: string): SessionStatus | null;

  /** Get session metadata from Redis */
  getSessionMetadata(sessionId: string): Promise<SessionMetadata | null>;

  /** Update session metadata in Redis */
  updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): Promise<void>;

  /** Delete session metadata from Redis */
  deleteSessionMetadata(sessionId: string): Promise<void>;

  /** Check if session exists */
  sessionExists(sessionId: string): boolean;

  /** Get total session count */
  getSessionCount(): number;

  /** Get recovery statistics */
  getRecoveryStats(): {
    totalSessions: number;
    recovering: number;
    failed: number;
    healthy: number;
  };

  /** Get session recovery state */
  getSessionRecoveryState(sessionId: string): unknown;
}

/**
 * Session recovery interface
 */
export interface ISessionRecovery {
  /** Set up recovery handlers for a client */
  setupRecoveryHandlers(client: Client, sessionId: string): void;

  /** Handle browser page close event */
  handlePageClose(sessionId: string, retryCount: number): Promise<void>;

  /** Handle browser page error event */
  handlePageError(sessionId: string, error: Error, retryCount: number): Promise<void>;

  /** Attempt to restart a session */
  restartSession(sessionId: string, retryCount: number): Promise<void>;

  /** Calculate retry delay with exponential backoff */
  calculateRetryDelay(retryCount: number): number;

  /** Notify admins of recovery failure */
  notifyAdmins(sessionId: string, error: string): Promise<void>;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Field that failed validation */
  field?: string;
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  /** Unique session identifier (alphanumeric + hyphen/underscore only) */
  sessionId: string;

  /** Session display name */
  name?: string;

  /** Session description */
  description?: string;

  /** Webhook URL override */
  webhookUrl?: string;

  /** Disabled webhook events */
  disabledCallbacks?: string[];

  /** Auto-mark messages as read */
  markMessagesAsRead?: boolean;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session update request
 */
export interface UpdateSessionRequest {
  /** Session display name */
  name?: string;

  /** Session description */
  description?: string;

  /** Webhook URL override */
  webhookUrl?: string;

  /** Disabled webhook events */
  disabledCallbacks?: string[];

  /** Auto-mark messages as read */
  markMessagesAsRead?: boolean;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session list filter options
 */
export interface SessionListFilter {
  /** Filter by status */
  status?: SessionStatus;

  /** Filter by active state (lastActive within N minutes) */
  activeWithinMinutes?: number;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort by field */
  sortBy?: 'createdAt' | 'lastActive' | 'sessionId' | 'messagesReceived';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Session event types (for internal event emitter)
 */
export type SessionEventType =
  | 'session:created'
  | 'session:initialized'
  | 'session:ready'
  | 'session:qr_ready'
  | 'session:authenticated'
  | 'session:disconnected'
  | 'session:failed'
  | 'session:terminated'
  | 'session:recovery_started'
  | 'session:recovery_success'
  | 'session:recovery_failed'
  | 'session:stats_updated';

/**
 * Session event payload
 */
export interface SessionEvent {
  /** Event type */
  type: SessionEventType;

  /** Session identifier */
  sessionId: string;

  /** Event timestamp */
  timestamp: Date;

  /** Event data (varies by event type) */
  data?: unknown;
}
