/**
 * Alert Types
 *
 * Type definitions for operator alert system.
 * Supports real-time alerts for session disconnects, failed messages,
 * queue backups, and escalation requests.
 */

// =============================================================================
// Alert Severity and Type Enums
// =============================================================================

/** Alert severity levels */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Alert type identifiers */
export type AlertType =
  | 'session_disconnect'
  | 'failed_message'
  | 'queue_backup'
  | 'escalation_needed';

// =============================================================================
// Alert Entity Types
// =============================================================================

/**
 * Alert metadata - additional context specific to alert type
 */
export interface AlertMetadata {
  /** WhatsApp session ID (for session_disconnect) */
  sessionId?: string;
  /** Chat ID (for failed_message, escalation_needed) */
  chatId?: string;
  /** Error message (for failed_message) */
  errorMessage?: string;
  /** Queue name (for queue_backup) */
  queueName?: string;
  /** Queue depth (for queue_backup) */
  queueDepth?: number;
  /** Threshold exceeded (for queue_backup) */
  threshold?: number;
  /** User tags (for escalation_needed) */
  tags?: string[];
  /** Additional arbitrary metadata */
  [key: string]: unknown;
}

/**
 * Alert entity
 *
 * Stored in MongoDB Alert collection
 */
export interface Alert {
  /** MongoDB ObjectId as string */
  _id?: string;
  /** Alert type */
  type: AlertType;
  /** Alert severity level */
  severity: AlertSeverity;
  /** Human-readable alert message */
  message: string;
  /** Additional context specific to alert type */
  metadata: AlertMetadata;
  /** Whether the alert has been acknowledged by an operator */
  acknowledged: boolean;
  /** Timestamp when acknowledged (ISO string) */
  acknowledgedAt?: string;
  /** User who acknowledged the alert */
  acknowledgedBy?: string;
  /** ISO timestamp when alert was created */
  createdAt: string;
  /** ISO timestamp when alert was last updated */
  updatedAt?: string;
}

// =============================================================================
// Webhook Delivery Types
// =============================================================================

/**
 * Webhook delivery configuration for external alert delivery (e.g., Slack)
 */
export interface AlertWebhookConfig {
  /** Whether webhook delivery is enabled */
  enabled: boolean;
  /** Webhook URL to send alerts to */
  webhookUrl: string;
  /** Alert severity levels to send (empty = all) */
  severityFilter?: AlertSeverity[];
  /** Alert types to send (empty = all) */
  typeFilter?: AlertType[];
  /** Optional custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

/**
 * Webhook payload sent to external systems
 */
export interface AlertWebhookPayload {
  /** Alert data */
  alert: Alert;
  /** ISO timestamp when webhook was sent */
  sentAt: string;
  /** Source service identifier */
  source: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Base response interface for alert API responses
 */
export interface AlertBaseResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Request body for POST /service/alerts (create alert)
 */
export interface CreateAlertRequest {
  /** Alert type */
  type: AlertType;
  /** Alert severity level */
  severity: AlertSeverity;
  /** Human-readable alert message */
  message: string;
  /** Additional context specific to alert type */
  metadata?: AlertMetadata;
}

/**
 * Response from POST /service/alerts
 */
export interface CreateAlertResponse extends AlertBaseResponse {
  /** The created alert */
  alert?: Alert;
}

/**
 * Query parameters for GET /service/alerts (list alerts)
 */
export interface ListAlertsQuery {
  /** Filter by severity level */
  severity?: AlertSeverity;
  /** Filter by alert type */
  type?: AlertType;
  /** Filter by acknowledged status */
  acknowledged?: boolean;
  /** Number of alerts to return (default: 50) */
  limit?: number;
  /** Number of alerts to skip (for pagination) */
  offset?: number;
  /** Sort order: 'asc' or 'desc' (default: 'desc' - newest first) */
  sort?: 'asc' | 'desc';
}

/**
 * Response from GET /service/alerts
 */
export interface ListAlertsResponse extends AlertBaseResponse {
  /** List of alerts */
  alerts?: Alert[];
  /** Total number of alerts matching the query */
  total?: number;
  /** Number of alerts returned */
  count?: number;
  /** Query parameters applied */
  query?: ListAlertsQuery;
}

/**
 * Response from GET /service/alerts/:id
 */
export interface GetAlertResponse extends AlertBaseResponse {
  /** The requested alert */
  alert?: Alert;
}

/**
 * Request body for PATCH /service/alerts/:id/acknowledge
 */
export interface AcknowledgeAlertRequest {
  /** User acknowledging the alert */
  acknowledgedBy?: string;
}

/**
 * Response from PATCH /service/alerts/:id/acknowledge
 */
export interface AcknowledgeAlertResponse extends AlertBaseResponse {
  /** The updated alert */
  alert?: Alert;
}

/**
 * Response from DELETE /service/alerts/:id
 */
export interface DeleteAlertResponse extends AlertBaseResponse {
  /** ID of the deleted alert */
  deletedId?: string;
}

/**
 * Response from GET /service/alerts/stats
 */
export interface AlertStatsResponse extends AlertBaseResponse {
  /** Total number of alerts */
  total?: number;
  /** Number of unacknowledged alerts */
  unacknowledged?: number;
  /** Number of acknowledged alerts */
  acknowledged?: number;
  /** Breakdown by severity level */
  bySeverity?: {
    info: number;
    warning: number;
    critical: number;
  };
  /** Breakdown by alert type */
  byType?: {
    session_disconnect: number;
    failed_message: number;
    queue_backup: number;
    escalation_needed: number;
  };
}

// =============================================================================
// Service Configuration Types
// =============================================================================

/**
 * Alert service configuration
 */
export interface AlertServiceConfig {
  /** Whether the alert service is enabled */
  enabled: boolean;
  /** Webhook delivery configuration */
  webhook?: AlertWebhookConfig;
  /** Maximum number of alerts to retain (0 = unlimited) */
  maxRetention?: number;
  /** Auto-acknowledge alerts after N minutes (0 = never) */
  autoAcknowledgeAfterMinutes?: number;
  /** Queue backup alert threshold (number of jobs) */
  queueBackupThreshold?: number;
}
