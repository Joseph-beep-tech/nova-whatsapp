/**
 * Routing Types
 *
 * Type definitions for tag-based message routing configuration.
 * Supports multiple routing targets: n8n webhooks, Qdrant RAG, local handlers.
 */

import { WelcomeMessageItem } from '../services/welcomeService';
import { LmsConfiguration } from './content';
import { KbConfiguration } from './knowledgebase';
import { WhatsAppPlatform } from '../utils/phoneNumber';

// =============================================================================
// Routing Target Types
// =============================================================================

/** Available routing target types */
export type RoutingTargetType = 'n8n_webhook' | 'qdrant_rag' | 'local_handler' | 'passthrough';

/** Base interface for all routing targets */
export interface RoutingTargetBase {
  /** Target type identifier */
  type: RoutingTargetType;
  /** Whether this target is enabled */
  enabled: boolean;
  /** Priority (1 = highest, higher numbers = lower priority) */
  priority?: number;
  /** Optional name for logging/debugging */
  name?: string;
}

/** n8n webhook routing target */
export interface N8nWebhookTarget extends RoutingTargetBase {
  type: 'n8n_webhook';
  /** Webhook URL to forward events to */
  webhookUrl: string;
  /** Optional custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/** Qdrant RAG routing target */
export interface QdrantRagTarget extends RoutingTargetBase {
  type: 'qdrant_rag';
  /** Qdrant collection name for this tag */
  collectionName: string;
  /** Override default Qdrant URL */
  qdrantUrl?: string;
  /** Override default embedding model */
  embeddingModel?: string;
  /** Number of messages to retrieve for context (default: 10) */
  contextWindow?: number;
  /** System prompt for LLM response generation */
  systemPrompt?: string;
  /** Optional webhook to forward after RAG processing */
  responseWebhook?: string;
  /** LLM model to use for response generation */
  llmModel?: string;
  /** Temperature for LLM (0-1) */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
}

/** Local handler routing target (for custom business logic) */
export interface LocalHandlerTarget extends RoutingTargetBase {
  type: 'local_handler';
  /** Handler function name (must be registered in eventRouter) */
  handlerName: string;
  /** Optional configuration passed to handler */
  config?: Record<string, unknown>;
}

/** Passthrough target (logs event but doesn't route) */
export interface PassthroughTarget extends RoutingTargetBase {
  type: 'passthrough';
  /** Optional log level */
  logLevel?: 'debug' | 'info' | 'warn';
}

/** Union type of all routing targets */
export type RoutingTarget = N8nWebhookTarget | QdrantRagTarget | LocalHandlerTarget | PassthroughTarget;

// =============================================================================
// Routing Configuration
// =============================================================================

/** Routing configuration for a tag */
export interface RoutingConfig {
  /** Primary routing target */
  target: RoutingTarget;
  /** Fallback target if primary fails */
  fallback?: RoutingTarget;
  /** Event types this routing applies to (empty = all events) */
  eventTypes?: string[];
  /** Rate limit: max events per minute (0 = unlimited) */
  rateLimitPerMinute?: number;
}

/** Memory/context configuration for a tag */
export interface MemoryConfig {
  /** Enable conversation memory */
  enabled: boolean;
  /** Maximum messages to store per user-session */
  maxMessages?: number;
  /** Session timeout in minutes (starts new session after inactivity) */
  sessionTimeoutMinutes?: number;
  /** Persist conversation history to Qdrant */
  persistToQdrant?: boolean;
}

/** Welcome message configuration (extends existing) */
export interface WelcomeConfig {
  /** Sequence of messages to send */
  messages: WelcomeMessageItem[];
  /** Whether welcome is enabled */
  enabled: boolean;
}

// =============================================================================
// SPAO Voice Integration
// =============================================================================

/** SPAO Voice AI integration configuration (per-tag) */
export interface SpaoVoiceConfig {
  /** Enable SPAO voice integration for this tag */
  enabled: boolean;
  /** SPAO control plane API URL (overrides global) */
  apiUrl?: string;
  /** SPAO voice AI URL for RAG search (overrides global) */
  voiceApiUrl?: string;
  /** SPAO MCP server URL (overrides global) */
  mcpUrl?: string;
  /** Twilio number for outbound voice calls */
  voiceFromNumber?: string;
  /** SPAO voice webhook URL (TwiML) for outbound calls */
  voiceTwimlUrl?: string;
  /** Enable outbound call initiation */
  enableOutboundCalls?: boolean;
  /** Enable post-call session summaries */
  enableSessionSummaries?: boolean;
  /** Enable post-call comprehension questions */
  enablePostCallReview?: boolean;
}

// =============================================================================
// Tag Configuration
// =============================================================================

/**
 * Complete tag configuration
 *
 * Stored in MongoDB Config collection with key: tag_config_{TAG}
 */
export interface TagConfiguration {
  /** Tag identifier (e.g., 'SOMO', 'VIP') */
  tag: string;
  /** Human-readable display name */
  displayName?: string;
  /** Whether this tag configuration is active */
  enabled: boolean;
  /** Welcome message configuration */
  welcomeMessage?: WelcomeConfig;
  /** Routing configuration */
  routing?: RoutingConfig;
  /** Memory/context configuration */
  memory?: MemoryConfig;
  /** LMS/Learning Management configuration */
  lms?: LmsConfiguration;
  /** Knowledgebase configuration */
  kb?: KbConfiguration;
  /** SPAO Voice AI integration */
  spao?: SpaoVoiceConfig;
  /** Created timestamp */
  createdAt?: string;
  /** Last updated timestamp */
  updatedAt?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/** Request to create/update tag configuration */
export interface SetTagConfigRequest {
  displayName?: string;
  enabled?: boolean;
  welcomeMessage?: WelcomeConfig;
  routing?: RoutingConfig;
  memory?: MemoryConfig;
  lms?: LmsConfiguration;
  kb?: KbConfiguration;
  spao?: SpaoVoiceConfig;
}

/** Response for tag configuration operations */
export interface TagConfigResponse {
  success: boolean;
  config?: TagConfiguration;
  error?: string;
}

/** Response for listing tag configurations */
export interface ListTagConfigsResponse {
  success: boolean;
  configs: TagConfiguration[];
  total: number;
}

// =============================================================================
// Event Routing Types
// =============================================================================

/** Event to be routed */
export interface RoutableEvent {
  /** WhatsApp session ID */
  sessionId: string;
  /** Event type (e.g., 'message_create') */
  dataType: string;
  /** Event data payload */
  data: Record<string, unknown>;
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** User tags */
  tags: string[];
  /** ISO timestamp when received */
  receivedAt: string;
}

/** Result of routing an event to a single target */
export interface RoutingResult {
  /** Target that was used */
  target: RoutingTarget;
  /** Whether routing succeeded */
  success: boolean;
  /** Response from target (if any) */
  response?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Duration in ms */
  durationMs: number;
}

/** Result of routing an event through all applicable routes */
export interface EventRoutingResult {
  /** Event that was routed */
  event: RoutableEvent;
  /** Results from each routing target */
  results: RoutingResult[];
  /** Whether at least one route succeeded */
  success: boolean;
  /** Total duration in ms */
  totalDurationMs: number;
  /** Optional message (e.g., for skipped events) */
  message?: string;
}

// =============================================================================
// Config Key Helpers
// =============================================================================

/** Config key prefix for tag configurations */
export const TAG_CONFIG_PREFIX = 'tag_config_';

/** Get config key for a tag */
export function getTagConfigKey(tag: string): string {
  return `${TAG_CONFIG_PREFIX}${tag.toUpperCase()}`;
}

/** Extract tag from config key */
export function getTagFromConfigKey(key: string): string | null {
  if (key.startsWith(TAG_CONFIG_PREFIX)) {
    return key.slice(TAG_CONFIG_PREFIX.length);
  }
  return null;
}

// =============================================================================
// Type Guards
// =============================================================================

/** Check if target is n8n webhook */
export function isN8nWebhookTarget(target: RoutingTarget): target is N8nWebhookTarget {
  return target.type === 'n8n_webhook';
}

/** Check if target is Qdrant RAG */
export function isQdrantRagTarget(target: RoutingTarget): target is QdrantRagTarget {
  return target.type === 'qdrant_rag';
}

/** Check if target is local handler */
export function isLocalHandlerTarget(target: RoutingTarget): target is LocalHandlerTarget {
  return target.type === 'local_handler';
}

/** Check if target is passthrough */
export function isPassthroughTarget(target: RoutingTarget): target is PassthroughTarget {
  return target.type === 'passthrough';
}
