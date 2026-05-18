/**
 * API Types for Swagger/OpenAPI Documentation
 *
 * These interfaces are used by tsoa to generate OpenAPI specs.
 * All types include JSDoc descriptions for Swagger documentation.
 */

import { TagConfiguration, SetTagConfigRequest } from './routing';
import { WhatsAppPlatform } from '../utils/phoneNumber';

// =============================================================================
// Base Response Types
// =============================================================================

/**
 * Base response interface for all API responses
 */
export interface BaseResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if the operation failed */
  error?: string;
}

// =============================================================================
// Health API Types
// =============================================================================

/**
 * Response from GET /service/health
 */
export interface HealthResponse {
  /** Service health status */
  status: 'healthy' | 'unhealthy';
  /** Service name */
  service: string;
  /** Service operating mode */
  mode: string;
  /** ISO timestamp of the response */
  timestamp: string;
}

/**
 * Response from GET /service/ping
 */
export interface PingResponse {
  /** Whether the ping was successful */
  success: boolean;
  /** Response message */
  message: string;
}

/**
 * Response from GET /service/health/ready
 */
export interface ReadinessResponse {
  /** Service name */
  service: string;
  /** ISO timestamp of the check */
  timestamp: string;
  /** Whether wwebjs-api is reachable */
  wwebjs: boolean;
  /** Whether n8n is reachable (null if not configured) */
  n8n: boolean | null;
}

/**
 * Session status information
 */
export interface SessionStatus {
  /** WhatsApp session ID */
  sessionId: string;
  /** Current session status */
  status: string;
  /** Whether the session is authenticated and connected */
  authenticated: boolean;
}

/**
 * Response from GET /service/health/sessions
 */
export interface SessionsResponse extends BaseResponse {
  /** ISO timestamp of the check */
  timestamp: string;
  /** List of session statuses */
  sessions?: SessionStatus[];
  /** Total number of sessions */
  total?: number;
  /** Number of connected sessions */
  connected?: number;
}

// =============================================================================
// User API Types
// =============================================================================

/**
 * User data structure
 */
export interface User {
  /** Phone number or group ID (e.g., "254722833440") */
  identifier: string;
  /** WhatsApp platform suffix (e.g., "c.us", "g.us", "lid") */
  platform: WhatsAppPlatform;
  /** Display name */
  name?: string;
  /** WhatsApp push name */
  pushname?: string;
  /** User tags for routing */
  tags: string[];
  /** Tags that have received welcome messages */
  welcomedTags: string[];
  /** ISO timestamp of first contact */
  firstContactAt: string;
  /** ISO timestamp of last contact */
  lastContactAt: string;
  /** Total number of messages */
  messageCount: number;
}

/**
 * Request body for POST /service/users/register
 */
export interface RegisterUserRequest {
  /** Phone number or group ID (e.g., "254722833440") */
  identifier: string;
  /** WhatsApp platform suffix (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Display name */
  name?: string;
  /** WhatsApp push name */
  pushname?: string;
  /** Tags to assign to the user */
  tags?: string[];
  /** Session ID for sending welcome messages */
  sessionId?: string;
}

/**
 * Welcome message send result
 */
export interface WelcomeResult {
  /** Tag the welcome message was sent for */
  tag: string;
  /** Whether the welcome was sent successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Response from POST /service/users/register
 */
export interface RegisterUserResponse extends BaseResponse {
  /** The registered user */
  user?: User;
  /** Whether this is a new user */
  isNew?: boolean;
  /** Tags that were newly added */
  newTags?: string[];
  /** Results of welcome message sending */
  welcomeResult?: WelcomeResult[] | null;
}

/**
 * Response from GET /service/users/list
 */
export interface ListUsersResponse extends BaseResponse {
  /** List of users */
  users?: User[];
  /** Total number of users */
  total?: number;
  /** Tag filter applied (if any) */
  filteredByTag?: string;
}

/**
 * Response from GET /service/users/tags
 */
export interface ListUserTagsResponse extends BaseResponse {
  /** List of unique tags */
  tags?: string[];
  /** Total number of unique tags */
  total?: number;
}

/**
 * Response from GET /service/users?identifier=...
 */
export interface GetUserResponse extends BaseResponse {
  /** The requested user */
  user?: User;
}

/**
 * Request body for POST/DELETE /service/users/tags
 */
export interface ModifyTagsRequest {
  /** Phone number or group ID */
  identifier: string;
  /** WhatsApp platform suffix (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Tags to add or remove */
  tags: string[];
}

/**
 * Response from tag modification endpoints
 */
export interface ModifyTagsResponse extends BaseResponse {
  /** Updated user */
  user?: User;
  /** Tags that were added */
  addedTags?: string[];
  /** Tags that were removed */
  removedTags?: string[];
}

// =============================================================================
// Tag Configuration API Types
// =============================================================================

/**
 * Response from GET /service/tags/configs
 */
export interface ListTagConfigsResponse extends BaseResponse {
  /** List of tag configurations */
  configs?: TagConfiguration[];
  /** Total number of configurations */
  total?: number;
}

/**
 * Response from GET/POST /service/tags/:tag/config
 */
export interface TagConfigResponse extends BaseResponse {
  /** The tag configuration */
  config?: TagConfiguration;
}

/**
 * Response from DELETE /service/tags/:tag/config
 */
export interface DeleteTagConfigResponse extends BaseResponse {
  /** The deleted tag */
  tag?: string;
  /** Whether the config was deleted */
  deleted?: boolean;
}

// Re-export for convenience
export type { SetTagConfigRequest };

// =============================================================================
// Welcome Message API Types
// =============================================================================

/**
 * Content types for welcome messages (mirrors wwebjs-api sendMessage contentType)
 */
export type ApiMessageContentType =
  | 'string'
  | 'MessageMedia'
  | 'MessageMediaFromURL'
  | 'Location'
  | 'Poll'
  | 'Contact'
  | 'List'
  | 'Buttons';

/**
 * Welcome message item for API request/response
 * Mirrors wwebjs-api sendMessage schema
 */
export interface ApiWelcomeMessageItem {
  /** Type of content to send */
  contentType: ApiMessageContentType;
  /** Message content (format depends on contentType) */
  content: string | Record<string, unknown>;
  /** Optional message options */
  options?: {
    /** Caption for media */
    caption?: string;
    /** Message ID to quote */
    quotedMessageId?: string;
    /** Mentions in the message */
    mentions?: string[];
  };
}

/**
 * Welcome message configuration for API response
 */
export interface ApiWelcomeMessageConfig {
  /** The tag */
  tag: string;
  /** Sequence of messages to send */
  messages: ApiWelcomeMessageItem[];
  /** Whether the welcome is enabled */
  enabled: boolean;
}

/**
 * Response from GET /service/welcome-messages
 */
export interface ListWelcomeMessagesResponse extends BaseResponse {
  /** All configured welcome messages */
  welcomeMessages?: ApiWelcomeMessageConfig[];
}

/**
 * Request body for POST /service/welcome-messages/:tag
 */
export interface SetWelcomeMessageRequest {
  /** Sequence of messages to send */
  messages: ApiWelcomeMessageItem[];
  /** Whether the welcome is enabled */
  enabled?: boolean;
}

/**
 * Response from POST /service/welcome-messages/:tag
 */
export interface SetWelcomeMessageResponse extends BaseResponse {
  /** The tag */
  tag?: string;
  /** The configured messages */
  messages?: ApiWelcomeMessageItem[];
  /** Whether the welcome is enabled */
  enabled?: boolean;
}

/**
 * Response from DELETE /service/welcome-messages/:tag
 */
export interface DeleteWelcomeMessageResponse extends BaseResponse {
  /** The tag */
  tag?: string;
  /** Whether the welcome is enabled (always false after delete) */
  enabled?: boolean;
}

// =============================================================================
// Event API Types
// =============================================================================

/**
 * Request body for POST /service/events/:sessionId
 */
export interface EventRequest {
  /** Event type (e.g., "message_create", "qr", "authenticated") */
  dataType: string;
  /** Event data payload */
  data?: Record<string, unknown>;
  /** Session ID (can also be in URL) */
  sessionId?: string;
}

/**
 * Response from POST /service/events/:sessionId
 */
export interface EventResponse extends BaseResponse {
  /** Processing message */
  message?: string;
  /** Job ID if queued */
  jobId?: string;
  /** Processing mode */
  mode?: 'async' | 'sync_routed' | 'legacy';
  /** Processing duration in milliseconds */
  durationMs?: number;
}

// =============================================================================
// Webhook API Types
// =============================================================================

/**
 * Request body for POST /service/webhook
 */
export interface WebhookActionRequest {
  /** Action to perform */
  action: string;
  /** Action data */
  data?: Record<string, unknown>;
  /** Session ID */
  sessionId?: string;
}

/**
 * Response from webhook action endpoints
 */
export interface WebhookActionResponse extends BaseResponse {
  /** Action-specific response data */
  data?: unknown;
  /** Response message */
  message?: string;
}

/**
 * Request body for POST /service/webhook/register/:sessionId
 */
export interface RegisterWebhookRequest {
  /** Webhook URL to register */
  webhookUrl: string;
  /** Events to subscribe to */
  events?: string[];
}

/**
 * Response from POST /service/webhook/register/:sessionId
 */
export interface RegisterWebhookResponse extends BaseResponse {
  /** Success message */
  message?: string;
  /** Registration details */
  registration?: {
    /** Session ID */
    sessionId: string;
    /** Registered webhook URL */
    webhookUrl: string;
    /** Subscribed events */
    events: string[];
  };
}

/**
 * Request body for POST /service/webhook/unregister/:sessionId
 */
export interface UnregisterWebhookRequest {
  /** Webhook URL to unregister */
  webhookUrl: string;
}

/**
 * Webhook registration details
 */
export interface WebhookInfo {
  /** Webhook URL */
  url: string;
  /** Subscribed events */
  events: string[];
  /** ISO timestamp when registered */
  registeredAt: string;
}

/**
 * Response from GET /service/webhook/list/:sessionId
 */
export interface ListWebhooksResponse extends BaseResponse {
  /** Session ID */
  sessionId?: string;
  /** List of registered webhooks */
  webhooks?: WebhookInfo[];
}

// =============================================================================
// Media API Types
// =============================================================================

/**
 * Request body for POST /service/media/proxy
 */
export interface MediaProxyRequest {
  /** URL to fetch and cache */
  url: string;
  /** Optional filename override */
  filename?: string;
  /** Optional MIME type override */
  mimetype?: string;
}

/**
 * Response from POST /service/media/proxy
 */
export interface MediaProxyResponse extends BaseResponse {
  /** Internal URL to access the cached media */
  proxyUrl?: string;
  /** When the cache entry expires */
  expiresAt?: string;
  /** Cache entry ID */
  cacheId?: string;
}

/**
 * Media cache statistics
 */
export interface MediaCacheStats {
  /** Total number of cached entries */
  totalEntries: number;
  /** Total size of cached files in bytes */
  totalSize: number;
  /** Number of expired entries */
  expiredEntries: number;
}

/**
 * Response from GET /service/media/stats
 */
export interface MediaStatsResponse extends BaseResponse {
  /** Cache statistics */
  stats?: MediaCacheStats;
}

// =============================================================================
// Queue API Types
// =============================================================================

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of waiting jobs */
  waiting: number;
  /** Number of active jobs */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
}

/**
 * Response from GET /service/queue/stats
 */
export interface QueueStatsResponse extends BaseResponse {
  /** Whether the queue is enabled */
  enabled: boolean;
  /** Queue statistics (if enabled) */
  stats?: QueueStats;
  /** Message if queue is disabled */
  message?: string;
}

/**
 * Failed job information
 */
export interface FailedJob {
  /** Job ID */
  id: string;
  /** Job name */
  name: string;
  /** Job data */
  data: Record<string, unknown>;
  /** Failure reason */
  failedReason: string;
  /** When the job failed */
  failedAt: string;
}

/**
 * Response from GET /service/queue/failed
 */
export interface QueueFailedResponse extends BaseResponse {
  /** Whether the queue is enabled */
  enabled: boolean;
  /** List of failed jobs */
  jobs?: FailedJob[];
}

// =============================================================================
// Progress/Learning API Types
// =============================================================================

/**
 * Module status for learning progress
 */
export type ApiModuleStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Knowledge level inferred from interactions
 */
export type ApiKnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Module progress information
 */
export interface ApiModuleProgress {
  /** Module identifier */
  moduleId: string | number;
  /** Module display name */
  moduleName?: string;
  /** Completion status */
  status: ApiModuleStatus;
  /** List of completed section titles */
  completedSections: string[];
  /** Total sections in module */
  totalSections?: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Last accessed timestamp (ISO) */
  lastAccessedAt?: string;
  /** Completion timestamp (ISO) */
  completedAt?: string;
}

/**
 * User learning data for a specific tag
 */
export interface ApiUserLearningData {
  /** Tag this data belongs to */
  tag: string;
  /** Source collection reference */
  sourceCollection: {
    url: string;
    collectionName: string;
  };
  /** Progress per module (keyed by moduleId) */
  moduleProgress: Record<string, ApiModuleProgress>;
  /** Current active module */
  currentModuleId?: string | number;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Total interactions with this content */
  totalInteractions: number;
  /** Topics/sections the user has engaged with */
  engagedTopics: string[];
  /** Inferred knowledge level */
  inferredLevel?: ApiKnowledgeLevel;
  /** Last activity timestamp (ISO) */
  lastActivityAt: string;
  /** Created timestamp (ISO) */
  createdAt: string;
  /** Updated timestamp (ISO) */
  updatedAt: string;
}

/**
 * Module structure from content collection
 */
export interface ApiModuleStructure {
  /** Module identifier (from schema.moduleField) */
  moduleId: string | number;
  /** Module display name */
  moduleName: string;
  /** List of section/topic titles in this module */
  sections: string[];
  /** Total content chunks in this module */
  totalChunks: number;
  /** Display order */
  order?: number;
}

/**
 * Response from GET /service/progress/modules
 */
export interface ModuleStructureResponse extends BaseResponse {
  /** Tag this structure belongs to */
  tag?: string;
  /** Program name */
  programName?: string;
  /** Module structure */
  modules?: ApiModuleStructure[];
  /** Total number of modules */
  totalModules?: number;
}

/**
 * Learner summary for admin dashboard
 */
export interface ApiLearnerSummary {
  /** User's identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** Display name */
  displayName?: string;
  /** Overall progress percentage */
  overallProgress: number;
  /** Current module ID */
  currentModuleId?: string | number;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Total interactions */
  totalInteractions: number;
}

/**
 * Response from GET /service/progress/learners
 */
export interface LearnersResponse extends BaseResponse {
  /** Tag these learners belong to */
  tag?: string;
  /** List of learners */
  learners?: ApiLearnerSummary[];
  /** Total count */
  total?: number;
}

/**
 * Response from GET /service/progress?identifier=...
 */
export interface ProgressResponse extends BaseResponse {
  /** User info */
  user?: {
    identifier: string;
    platform: WhatsAppPlatform;
    displayName?: string;
    tags: string[];
  };
  /** Learning data for requested tag */
  learning?: ApiUserLearningData;
  /** Module structure from content collection (if requested) */
  moduleStructure?: ApiModuleStructure[];
}

/**
 * Request body for POST /service/progress
 */
export interface ProgressUpdateRequest {
  /** Phone number or group ID */
  identifier: string;
  /** WhatsApp platform suffix (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Tag/business client (required) */
  tag: string;
  /** Module to update */
  moduleId?: string | number;
  /** Section to mark as completed */
  sectionCompleted?: string;
  /** Mark entire module as completed */
  moduleCompleted?: boolean;
  /** Update current module */
  setCurrentModule?: string | number;
  /** Additional metadata to merge */
  metadata?: Record<string, unknown>;
  /** Additional context to merge */
  context?: Record<string, unknown>;
}

/**
 * Response from POST /service/progress/:chatId
 */
export interface ProgressUpdateResponse extends BaseResponse {
  /** Updated learning data */
  learning?: ApiUserLearningData;
  /** What was updated */
  updated?: {
    moduleId?: string | number;
    sectionCompleted?: string;
    moduleCompleted?: boolean;
    currentModule?: string | number;
  };
}

// =============================================================================
// Auth API Types (Keycloak OIDC BFF)
// =============================================================================

/**
 * User roles defined in Keycloak realm
 */
export type ApiUserRole =
  | 'creator_admin'
  | 'tenant_admin'
  | 'agent'
  | 'automation_engineer'
  | 'read_only';

/**
 * User information from Keycloak tokens
 */
export interface ApiAuthUser {
  /** Keycloak user ID (sub claim) */
  sub: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** Given name */
  givenName?: string;
  /** Family name */
  familyName?: string;
  /** Username (preferred_username claim) */
  username?: string;
  /** Whether email is verified */
  emailVerified?: boolean;
}

/**
 * Response from GET /auth/me and GET /auth/status
 * Returns current user info if authenticated, or authenticated: false
 */
export interface AuthMeApiResponse {
  /** Whether user is authenticated */
  authenticated: boolean;
  /** User information (if authenticated) */
  user?: ApiAuthUser;
  /** User's roles (if authenticated) */
  roles?: ApiUserRole[];
  /** Organization ID for tenant scoping */
  organizationId?: string | null;
  /** Organization name */
  organizationName?: string;
}

/**
 * Response from POST /auth/logout
 */
export interface LogoutResponse extends BaseResponse {
  /** Success message */
  message?: string;
  /** URL to redirect to for full Keycloak logout (optional) */
  logoutUrl?: string;
}

/**
 * Error response for auth callback errors
 */
export interface AuthCallbackErrorResponse extends BaseResponse {
  /** Error code (e.g., 'STATE_MISMATCH') */
  code?: string;
  /** Detailed error description */
  details?: string;
}

// =============================================================================
// Memory API Types (RAG Memory Insights)
// =============================================================================

/**
 * Collection statistics for memory storage
 */
export interface CollectionStats {
  /** Collection name */
  collectionName: string;
  /** Number of vectors stored */
  vectorCount: number;
  /** Number of indexed vectors */
  indexedVectors: number;
  /** Storage size in bytes (if available) */
  storageSizeBytes?: number;
  /** Last updated timestamp (ISO) */
  lastUpdatedAt?: string;
}

/**
 * Response from GET /service/memory/stats?identifier=...
 */
export interface MemoryStatsResponse extends BaseResponse {
  /** User identifier */
  identifier?: string;
  /** WhatsApp platform */
  platform?: WhatsAppPlatform;
  /** User tags */
  tags?: string[];
  /** Stats per collection */
  collections?: CollectionStats[];
  /** Total messages across all collections */
  totalMessages?: number;
  /** Total storage size in bytes */
  totalStorageBytes?: number;
}

/**
 * Search strategy for memory search
 */
export type ApiSearchStrategy = 'vector' | 'keyword' | 'hybrid';

/**
 * Request body for POST /service/memory/search
 */
export interface MemorySearchRequest {
  /** Search query text */
  query: string;
  /** Identifier to search within */
  identifier?: string;
  /** WhatsApp platform (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Tag to filter by */
  tag?: string;
  /** Collection name to search in */
  collection?: string;
  /** Search strategy */
  strategy?: ApiSearchStrategy;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Only messages after this timestamp (ISO) */
  after?: string;
  /** Only messages before this timestamp (ISO) */
  before?: string;
}

/**
 * Memory search result item
 */
export interface MemorySearchResultItem {
  /** Message ID */
  id: string;
  /** User identifier */
  identifier: string;
  /** WhatsApp platform */
  platform: WhatsAppPlatform;
  /** Session ID */
  sessionId: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** Tags */
  tags: string[];
  /** Combined relevance score (0-1) */
  score: number;
  /** Score breakdown */
  scores: {
    /** Vector similarity score */
    vector?: number;
    /** Keyword match score */
    keyword?: number;
  };
  /** Collection this message is from */
  collection?: string;
}

/**
 * Response from POST /service/memory/search
 */
export interface MemorySearchResponse extends BaseResponse {
  /** Search results */
  results?: MemorySearchResultItem[];
  /** Total number of results (before pagination) */
  total?: number;
  /** Number of results returned */
  count?: number;
  /** Offset used */
  offset?: number;
  /** Limit used */
  limit?: number;
  /** Search query */
  query?: string;
  /** Strategy used */
  strategy?: ApiSearchStrategy;
}

/**
 * Memory export item (full message data)
 */
export interface MemoryExportItem {
  /** Message ID */
  id: string;
  /** User identifier */
  identifier: string;
  /** WhatsApp platform */
  platform: WhatsAppPlatform;
  /** Session ID */
  sessionId: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** Tags */
  tags: string[];
  /** Collection name */
  collection: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from GET /service/memory/export?identifier=...
 */
export interface MemoryExportResponse extends BaseResponse {
  /** User identifier */
  identifier?: string;
  /** WhatsApp platform */
  platform?: WhatsAppPlatform;
  /** Export timestamp (ISO) */
  exportedAt?: string;
  /** Exported messages */
  messages?: MemoryExportItem[];
  /** Total number of messages exported */
  count?: number;
  /** Collections included in export */
  collections?: string[];
}

/**
 * Response from DELETE /service/memory/:messageId
 */
export interface DeleteMemoryResponse extends BaseResponse {
  /** Message ID that was deleted */
  messageId?: string;
  /** Collection the message was deleted from */
  collection?: string;
  /** Whether the message was deleted */
  deleted?: boolean;
}

// Chat/Conversation API Types
// =============================================================================

/**
 * Individual message in conversation history
 */
export interface ConversationMessage {
  /** Message ID */
  id: string;
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform */
  platform: WhatsAppPlatform;
  /** Message body text */
  body: string;
  /** Whether this message was sent by the user (true) or bot (false) */
  fromUser: boolean;
  /** ISO timestamp when message was sent */
  timestamp: string;
  /** Whether this message has media */
  hasMedia?: boolean;
  /** Media type if present */
  mediaType?: string;
}

/**
 * Conversation context data structure
 */
export interface ConversationContext {
  /** Last N messages from conversation history */
  messages: ConversationMessage[];
  /** RAG-generated summary of conversation context */
  ragSummary?: string;
  /** User tags for routing */
  userTags: string[];
  /** When this conversation was claimed by an agent */
  claimedAt?: string;
  /** Agent ID who claimed this conversation */
  claimedBy?: string;
}

/**
 * Request body for POST /service/chats/claim
 */
export interface ClaimChatRequest {
  /** Phone number or group ID */
  identifier: string;
  /** WhatsApp platform suffix (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Agent ID claiming the conversation */
  agentId: string;
  /** Optional note about why conversation was claimed */
  reason?: string;
}

/**
 * Response from POST /service/chats/claim
 */
export interface ClaimChatResponse extends BaseResponse {
  /** Chat assignment details */
  chat?: {
    /** User identifier */
    identifier: string;
    /** WhatsApp platform */
    platform: WhatsAppPlatform;
    /** Agent ID who claimed the conversation */
    assignedTo: string;
    /** When the conversation was claimed */
    claimedAt: string;
    /** Optional claim reason */
    reason?: string;
  };
}

/**
 * Response from POST /service/chats/:chatId/release
 */
export interface ReleaseChatResponse extends BaseResponse {
  /** Release confirmation message */
  message?: string;
  /** Whether the conversation was successfully released */
  released?: boolean;
}

/**
 * Response from GET /service/chats/:chatId/context
 */
export interface GetContextResponse extends BaseResponse {
  /** Conversation context data */
  context?: ConversationContext;
}

// --- Conversation State Types ---

/** Handoff status values */
export type ApiHandoffStatus = 'automated' | 'requested' | 'active' | 'resolved';

/** Conversation state data for API responses */
export interface ApiConversationState {
  identifier: string;
  platform: WhatsAppPlatform;
  sessionId: string;
  handoffStatus: ApiHandoffStatus;
  assignedAgent?: string;
  lastAgentActivity?: string;
  automationPaused: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from GET /service/conversation-state/:sessionId?identifier=...
 */
export interface GetConversationStateResponse extends BaseResponse {
  /** Conversation state data */
  state?: ApiConversationState | null;
}

/**
 * Request body for POST /service/conversation-state/:sessionId
 */
export interface SetConversationStateRequest {
  /** Phone number or group ID */
  identifier: string;
  /** WhatsApp platform suffix (default: "c.us") */
  platform?: WhatsAppPlatform;
  /** Handoff status */
  handoffStatus?: ApiHandoffStatus;
  /** Assigned agent ID */
  assignedAgent?: string;
  /** Whether automation is paused */
  automationPaused?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from POST /service/conversation-state/:sessionId
 */
export interface SetConversationStateResponse extends BaseResponse {
  /** Updated conversation state */
  state?: ApiConversationState;
}
