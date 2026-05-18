/**
 * Configuration for WhatsApp n8n Service (Thin Wrapper)
 *
 * This is a minimal config file - most configuration is handled by whatsapp-api.
 * We only need basic service settings here.
 */

// Load environment variables before accessing them
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  apiKey: process.env.API_KEY || '',
  whatsappApiUrl: process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3000',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/whatsapp-service',
  adminUser: process.env.WHATSAPP_SERVICE_ADMIN_USER || 'admin',
  adminPassword: process.env.WHATSAPP_SERVICE_ADMIN_PASSWORD || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  /** Optional n8n URL for health checks (empty = skip n8n check) */
  n8nUrl: process.env.N8N_URL || '',
  /** Timeout in ms for upstream health checks (default: 5000) */
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
};

/**
 * Keycloak OIDC Authentication Configuration
 *
 * Uses BFF (Backend-for-Frontend) pattern:
 * - Service holds sessions and tokens
 * - Frontend never sees raw tokens
 * - Session cookie is httpOnly, secure, SameSite=Lax
 */
export const authConfig = {
  /** Enable Keycloak authentication (replaces basic auth when true) */
  enabled: process.env.ENABLE_KEYCLOAK_AUTH === 'true',

  /** Keycloak issuer URL (e.g., https://auth.dater.world/realms/dater) */
  issuerUrl: process.env.KEYCLOAK_ISSUER_URL || '',

  /** Client ID registered in Keycloak */
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'whatsapp-service',

  /** Client secret for confidential client */
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',

  /** Base URL of this service (for constructing callback URLs) */
  baseUrl: process.env.SERVICE_BASE_URL || 'http://localhost:3001',

  /** Session secret for signing cookies (must be 32+ chars in production) */
  sessionSecret: process.env.SESSION_SECRET || 'development-session-secret-change-in-production',

  /** Session TTL in seconds (default: 24 hours) */
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10),

  /** Token refresh threshold in seconds (refresh if expires within this time) */
  tokenRefreshThreshold: parseInt(process.env.TOKEN_REFRESH_THRESHOLD || '300', 10),

  /** OIDC scopes to request */
  scopes: (process.env.KEYCLOAK_SCOPES || 'openid profile email roles').split(' '),
};

// Auth config validation is done after isProduction is defined (see end of file)

/**
 * Media Proxy Configuration
 *
 * Settings for the media proxy service that caches external media
 * for use with whatsapp-api MessageMediaFromURL.
 */
export const mediaProxyConfig = {
  /** Directory to store cached media files */
  cacheDir: process.env.MEDIA_CACHE_DIR || '/tmp/whatsapp-media-cache',
  /** Time-to-live for cached media in seconds (default: 5 minutes) */
  cacheTtlSeconds: parseInt(process.env.MEDIA_CACHE_TTL_SECONDS || '300', 10),
  /** Maximum file size to cache in bytes (default: 16MB) */
  maxFileSizeBytes: parseInt(process.env.MAX_MEDIA_SIZE_BYTES || '16777216', 10),
  /** Cleanup interval in milliseconds (default: 1 minute) */
  cleanupIntervalMs: parseInt(process.env.MEDIA_CACHE_CLEANUP_INTERVAL_MS || '60000', 10),
  /** Base URL for serving cached media (auto-detected if not set) */
  baseUrl: process.env.MEDIA_PROXY_BASE_URL || '',
};

/**
 * Event Queue Configuration (BullMQ + Redis)
 *
 * Enables async event processing with queueing for improved reliability.
 * Set ENABLE_EVENT_QUEUE=true to enable.
 */
export const queueConfig = {
  /** Enable event queueing (default: false for backwards compatibility) */
  enabled: process.env.ENABLE_EVENT_QUEUE === 'true',
  /** Redis connection URL */
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  /** Queue name for WhatsApp events */
  eventQueueName: process.env.EVENT_QUEUE_NAME || 'whatsapp-events',
  /** Job retention time in ms (default: 24 hours) */
  jobRetentionMs: parseInt(process.env.JOB_RETENTION_MS || '86400000', 10),
  /** Maximum retry attempts for failed jobs */
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  /** Backoff delay in ms between retries */
  backoffDelay: parseInt(process.env.BACKOFF_DELAY_MS || '5000', 10),
  /** Concurrency: number of jobs to process in parallel */
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
};

/**
 * Event Deduplication Configuration
 *
 * Prevents duplicate message processing by tracking event IDs with configurable TTL.
 * Supports Redis-backed storage for distributed deployments.
 */
export const deduplicationConfig = {
  /** Enable deduplication service (default: true if queue is enabled) */
  enabled: process.env.ENABLE_DEDUPLICATION !== 'false',
  /** Deduplication window in seconds - events are considered duplicates within this window (default: 300 = 5 minutes) */
  windowSeconds: parseInt(process.env.DEDUPLICATION_WINDOW_SECONDS || '300', 10),
  /** Use Redis for deduplication storage (default: true if queue enabled, false otherwise) */
  useRedis: process.env.DEDUPLICATION_USE_REDIS === 'true'
    || (process.env.DEDUPLICATION_USE_REDIS !== 'false' && process.env.ENABLE_EVENT_QUEUE === 'true'),
  /** Redis key prefix for deduplication entries */
  keyPrefix: process.env.DEDUPLICATION_KEY_PREFIX || 'dedup:event:',
};

/**
 * Qdrant Configuration (Vector DB for RAG)
 *
 * Enables semantic conversation memory and RAG capabilities.
 * Set ENABLE_QDRANT=true to enable.
 */
export const qdrantConfig = {
  /** Enable Qdrant integration (default: false) */
  enabled: process.env.ENABLE_QDRANT === 'true',
  /** Qdrant server URL */
  url: process.env.QDRANT_URL || 'http://qdrant:6333',
  /** Qdrant API key (optional, for cloud deployments) */
  apiKey: process.env.QDRANT_API_KEY || '',
  /** Prefix for collection names */
  collectionPrefix: process.env.QDRANT_COLLECTION_PREFIX || 'whatsapp_',
  /** Embedding model to use */
  embeddingModel: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-minilm-l6-v2',
  /** LLM model for response generation */
  llmModel: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
  /** OpenRouter API key */
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  /** OpenRouter base URL */
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  /** Default context window size (number of messages to retrieve) */
  defaultContextWindow: parseInt(process.env.DEFAULT_CONTEXT_WINDOW || '10', 10),
  /** Embedding vector dimension (384 for all-MiniLM-L6-v2) */
  vectorDimension: parseInt(process.env.VECTOR_DIMENSION || '384', 10),
};

/**
 * LLM Configuration (Conversational AI)
 *
 * Enables LLM-powered features: intent detection, dynamic menus, help generation.
 * Uses OpenRouter with configurable model (default: Grok via x-ai/grok-2).
 * Set ENABLE_LLM=true to enable.
 *
 * Shares OPENROUTER_API_KEY and OPENROUTER_BASE_URL with Qdrant config.
 */
export const llmConfig = {
  /** Enable LLM features (default: false) */
  enabled: process.env.ENABLE_LLM === 'true',
  /** LLM model for conversational features (falls back to Qdrant's LLM_MODEL) */
  model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
  /** OpenRouter API key (shared with Qdrant) */
  apiKey: process.env.OPENROUTER_API_KEY || '',
  /** OpenRouter base URL (shared with Qdrant) */
  baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  /** Temperature for conversational responses (0-1) */
  temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
  /** Max tokens for responses */
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '512', 10),
  /** Timeout for intent detection calls in ms */
  intentDetectionTimeoutMs: parseInt(process.env.INTENT_DETECTION_TIMEOUT_MS || '5000', 10),
  /** Organization/brand name for welcome messages */
  brandName: process.env.BRAND_NAME || 'Azizi Africa',
};

/**
 * Alert Service Configuration
 *
 * Enables operator alerts for session disconnects, failed messages,
 * queue backups, and escalation requests.
 * Set ENABLE_ALERTS=true to enable.
 */
export const alertConfig = {
  /** Enable alert service (default: false) */
  enabled: process.env.ENABLE_ALERTS === 'true',
  /** Maximum number of alerts to retain (0 = unlimited) */
  maxRetention: parseInt(process.env.ALERT_MAX_RETENTION || '1000', 10),
  /** Auto-acknowledge alerts after N minutes (0 = never) */
  autoAcknowledgeAfterMinutes: parseInt(process.env.ALERT_AUTO_ACK_MINUTES || '0', 10),
  /** Queue backup alert threshold (number of jobs) */
  queueBackupThreshold: parseInt(process.env.ALERT_QUEUE_THRESHOLD || '100', 10),
  /** Webhook delivery configuration */
  webhook: {
    /** Enable webhook delivery (default: false) */
    enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
    /** Webhook URL to send alerts to (e.g., Slack webhook) */
    webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
    /** Alert severity levels to send (comma-separated, empty = all) */
    severityFilter: process.env.ALERT_WEBHOOK_SEVERITY_FILTER
      ? (process.env.ALERT_WEBHOOK_SEVERITY_FILTER.split(',') as ('info' | 'warning' | 'critical')[])
      : [],
    /** Alert types to send (comma-separated, empty = all) */
    typeFilter: process.env.ALERT_WEBHOOK_TYPE_FILTER
      ? (process.env.ALERT_WEBHOOK_TYPE_FILTER.split(',') as ('session_disconnect' | 'failed_message' | 'queue_backup' | 'escalation_needed')[])
      : [],
    /** Request timeout in ms (default: 10000) */
    timeout: parseInt(process.env.ALERT_WEBHOOK_TIMEOUT || '10000', 10),
    /** Custom headers for webhook requests (JSON string from env) */
    headers: process.env.ALERT_WEBHOOK_HEADERS
      ? JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) as Record<string, string>
      : {} as Record<string, string>,
  },
};

/**
 * ERPNext Sync Configuration
 *
 * Enables async sync of Contacts, Communications, and Campaign configs
 * to/from ERPNext via Frappe REST API.
 * Set ENABLE_ERPNEXT_SYNC=true to enable.
 */
export const erpnextConfig = {
  /** Enable ERPNext sync (default: false) */
  enabled: process.env.ENABLE_ERPNEXT_SYNC === 'true',
  /** ERPNext base URL (e.g., https://voice-erp.aziziafrica.com) */
  baseUrl: (process.env.ERPNEXT_URL || '').replace(/\/$/, ''),
  /** Frappe API key for this service */
  apiKey: process.env.ERPNEXT_API_KEY || '',
  /** Frappe API secret for this service */
  apiSecret: process.env.ERPNEXT_API_SECRET || '',
  /** Shared secret for validating inbound Frappe webhooks */
  webhookSecret: process.env.ERPNEXT_WEBHOOK_SECRET || '',
  /** Campaign cache refresh interval in ms (default: 5 minutes) */
  refreshIntervalMs: parseInt(process.env.ERPNEXT_REFRESH_INTERVAL_MS || '300000', 10),
  /** Communication batch flush interval in ms (default: 10 seconds) */
  batchFlushIntervalMs: parseInt(process.env.ERPNEXT_BATCH_FLUSH_MS || '10000', 10),
};

/**
 * SPAO Integration Configuration
 *
 * Enables integration with the SPAO Voice AI platform.
 * wa.dt.wrld acts as a remote control for SPAO voice interactions.
 * Set ENABLE_SPAO=true to enable.
 */
export const spaoConfig = {
  /** Enable SPAO integration (default: false) */
  enabled: process.env.ENABLE_SPAO === 'true',
  /** SPAO control plane API URL */
  apiUrl: (process.env.SPAO_API_URL || 'http://spao-api:5000').replace(/\/$/, ''),
  /** SPAO voice AI (FastAPI) URL — for RAG search */
  voiceApiUrl: (process.env.SPAO_VOICE_API_URL || 'http://spao-voice:8054').replace(/\/$/, ''),
  /** SPAO MCP server URL */
  mcpUrl: (process.env.SPAO_MCP_URL || 'http://azizi-mcp:8080').replace(/\/$/, ''),
  /** API key for authenticating with SPAO */
  apiKey: process.env.SPAO_API_KEY || '',
  /** Twilio number for outbound voice calls */
  voiceFromNumber: process.env.SPAO_VOICE_FROM_NUMBER || '',
  /** SPAO voice webhook URL (TwiML) for outbound calls */
  voiceTwimlUrl: process.env.SPAO_VOICE_TWIML_URL || '',
  /** Enable outbound call initiation from WhatsApp */
  enableOutboundCalls: process.env.SPAO_ENABLE_OUTBOUND_CALLS === 'true',
  /** Enable post-call session summaries via WhatsApp */
  enableSessionSummaries: process.env.SPAO_ENABLE_SESSION_SUMMARIES !== 'false',
  /** Enable post-call review questions */
  enablePostCallReview: process.env.SPAO_ENABLE_POST_CALL_REVIEW === 'true',
  /** Webhook secret for validating inbound SPAO events */
  webhookSecret: process.env.SPAO_WEBHOOK_SECRET || '',
  /** WhatsApp session ID for sending messages (default: 'mysession') */
  whatsappSessionId: process.env.WHATSAPP_SESSION_ID || 'mysession',
};

/**
 * Socket.io Real-time Configuration
 *
 * Enables WebSocket-based real-time event streaming to the HITL dashboard.
 * Set ENABLE_SOCKET=true to enable.
 */
export const socketConfig = {
  /** Enable Socket.io server (default: false — set ENABLE_SOCKET=true to enable) */
  enabled: process.env.ENABLE_SOCKET === 'true',
  /** Socket.io path (default: /socket.io) */
  path: process.env.SOCKET_PATH || '/socket.io',
};

// Validation
if (!config.apiKey) {
  throw new Error('API_KEY environment variable is required');
}

/**
 * CORS Configuration
 *
 * Allowed origins for cross-origin requests.
 * Set CORS_ORIGINS to a comma-separated list of allowed origins.
 * Defaults to localhost:3001 (service) and localhost:3002 (dashboard).
 */
export const corsConfig = {
  origins: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  credentials: true,
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

// Validate auth config when enabled (must be after isProduction is defined)
if (authConfig.enabled) {
  if (!authConfig.issuerUrl) {
    throw new Error('KEYCLOAK_ISSUER_URL is required when ENABLE_KEYCLOAK_AUTH=true');
  }
  if (!authConfig.clientSecret) {
    throw new Error('KEYCLOAK_CLIENT_SECRET is required when ENABLE_KEYCLOAK_AUTH=true');
  }
  if (isProduction && authConfig.sessionSecret === 'development-session-secret-change-in-production') {
    throw new Error('SESSION_SECRET must be set to a secure value in production');
  }
}
