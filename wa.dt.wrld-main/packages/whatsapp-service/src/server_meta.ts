/**
 * WhatsApp Service — Server Metadata
 *
 * Static declarations of routes, feature flags, and dependencies.
 * Imported by cli.ts (for --help) and available for runtime reference.
 *
 * Zero side effects — no dotenv, no DB connections, no config loading.
 * When adding routes/flags/deps to index.ts, update here in the SAME COMMIT.
 */

export const SERVER_NAME = 'azizi-wa';
export const SERVER_VERSION = '0.8.0';
export const SERVER_DESCRIPTION =
  'Event-driven WhatsApp bot with tag-based routing, RAG memory, LLM conversations, SPAO voice integration, and HITL dashboard';
export const DEFAULT_PORT = 3001;

/** Operational defaults (informational — actual values read from shared/config.ts) */
export const DEFAULTS = {
  LLM_MODEL: 'openai/gpt-4o-mini',        // via OpenRouter
  EMBEDDING_MODEL: 'sentence-transformers/all-minilm-l6-v2',
  BRAND_NAME: 'Azizi Africa',
  QUEUE_CONCURRENCY: 5,
  DEDUP_WINDOW_SECONDS: 300,
} as const;

// ---------------------------------------------------------------------------
// Feature flags — keep in sync with shared/config.ts
// ---------------------------------------------------------------------------

export interface FeatureFlag {
  name: string;
  env: string;
  description: string;
  defaultValue: string;
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  { name: 'EVENT_QUEUE', env: 'ENABLE_EVENT_QUEUE', description: 'BullMQ async event processing', defaultValue: 'false' },
  { name: 'QDRANT', env: 'ENABLE_QDRANT', description: 'Qdrant RAG memory + semantic search', defaultValue: 'false' },
  { name: 'LLM', env: 'ENABLE_LLM', description: 'LLM intent detection + dynamic menus', defaultValue: 'false' },
  { name: 'DEDUPLICATION', env: 'ENABLE_DEDUPLICATION', description: 'Message deduplication', defaultValue: 'true' },
  { name: 'ALERTS', env: 'ENABLE_ALERTS', description: 'Session disconnect + queue backup alerts', defaultValue: 'false' },
  { name: 'ERPNEXT_SYNC', env: 'ENABLE_ERPNEXT_SYNC', description: 'ERPNext contact/campaign sync', defaultValue: 'false' },
  { name: 'SPAO', env: 'ENABLE_SPAO', description: 'SPAO voice AI integration', defaultValue: 'false' },
  { name: 'SOCKET', env: 'ENABLE_SOCKET', description: 'Socket.io real-time to HITL dashboard', defaultValue: 'false' },
  { name: 'KEYCLOAK_AUTH', env: 'ENABLE_KEYCLOAK_AUTH', description: 'Keycloak OIDC admin auth', defaultValue: 'false' },
];

// ---------------------------------------------------------------------------
// Routes — keep in sync with routes/ and controllers/
// ---------------------------------------------------------------------------

export interface RouteEntry {
  method: string;
  path: string;
  description: string;
  auth: string;
  tag: string;
}

export const ROUTES: RouteEntry[] = [
  // Health
  { method: 'GET', path: '/service/health', description: 'Service health check', auth: 'none', tag: 'health' },
  { method: 'GET', path: '/service/ping', description: 'Ping-pong test', auth: 'none', tag: 'health' },
  { method: 'GET', path: '/service/health/ready', description: 'Readiness probe', auth: 'none', tag: 'health' },
  // Events
  { method: 'POST', path: '/service/events/:sessionId', description: 'Event receiver from wwebjs-api', auth: 'api_key', tag: 'events' },
  // Webhooks
  { method: 'POST', path: '/service/webhook', description: 'n8n webhook dispatch', auth: 'api_key', tag: 'webhooks' },
  { method: 'POST', path: '/service/webhook/register/:id', description: 'Register n8n trigger', auth: 'api_key', tag: 'webhooks' },
  { method: 'GET', path: '/service/webhook/list/:id', description: 'List webhooks', auth: 'api_key', tag: 'webhooks' },
  { method: 'POST', path: '/service/webhooks/erpnext/*', description: 'ERPNext webhook receiver (HMAC)', auth: 'hmac', tag: 'webhooks' },
  { method: 'POST', path: '/service/webhooks/spao', description: 'SPAO voice event receiver', auth: 'api_key', tag: 'webhooks' },
  // Users
  { method: 'POST', path: '/service/users/register', description: 'Register/update user', auth: 'api_key', tag: 'users' },
  { method: 'GET', path: '/service/users/list', description: 'List users', auth: 'api_key', tag: 'users' },
  { method: 'GET', path: '/service/users?identifier=X', description: 'Get user by identifier', auth: 'api_key', tag: 'users' },
  { method: 'POST', path: '/service/users/tags', description: 'Add tags to user', auth: 'api_key', tag: 'users' },
  { method: 'DELETE', path: '/service/users/tags', description: 'Remove tags from user', auth: 'api_key', tag: 'users' },
  // Tags & Routing
  { method: 'GET', path: '/service/tags/configs', description: 'List tag configurations', auth: 'api_key', tag: 'tags' },
  { method: 'GET', path: '/service/tags/:tag/config', description: 'Get tag config', auth: 'api_key', tag: 'tags' },
  { method: 'POST', path: '/service/tags/:tag/config', description: 'Set tag config', auth: 'api_key', tag: 'tags' },
  { method: 'DELETE', path: '/service/tags/:tag/config', description: 'Delete tag config', auth: 'api_key', tag: 'tags' },
  // Media
  { method: 'POST', path: '/service/media/proxy', description: 'Proxy external media', auth: 'api_key', tag: 'media' },
  { method: 'GET', path: '/service/media/cache/:id', description: 'Serve cached media', auth: 'none', tag: 'media' },
  // Progress
  { method: 'GET', path: '/service/progress/modules', description: 'Module structure for tag', auth: 'api_key', tag: 'progress' },
  { method: 'GET', path: '/service/progress/learners', description: 'List learners for tag', auth: 'api_key', tag: 'progress' },
  { method: 'GET', path: '/service/progress?identifier&tag', description: 'Get learner progress', auth: 'api_key', tag: 'progress' },
  { method: 'POST', path: '/service/progress?identifier', description: 'Update learner progress', auth: 'api_key', tag: 'progress' },
  // Welcome Messages
  { method: 'GET', path: '/service/welcome-messages', description: 'List all welcome messages', auth: 'api_key', tag: 'welcome' },
  { method: 'POST', path: '/service/welcome-messages/:tag', description: 'Set welcome message', auth: 'api_key', tag: 'welcome' },
  { method: 'DELETE', path: '/service/welcome-messages/:tag', description: 'Remove welcome message', auth: 'api_key', tag: 'welcome' },
  // API docs
  { method: 'GET', path: '/api-docs/service', description: 'Interactive API docs (Swagger UI)', auth: 'none', tag: 'docs' },
  // Metrics
  { method: 'GET', path: '/service/metrics/deduplication', description: 'Deduplication statistics', auth: 'api_key', tag: 'metrics' },
  // Queue (gated)
  { method: 'GET', path: '/service/queue/stats', description: 'Queue statistics', auth: 'api_key', tag: 'queue' },
  { method: 'GET', path: '/service/queue/failed', description: 'Failed jobs', auth: 'api_key', tag: 'queue' },
  // Auth (gated)
  { method: 'GET', path: '/service/auth/login', description: 'Initiate Keycloak login', auth: 'none', tag: 'auth' },
  { method: 'GET', path: '/service/auth/callback', description: 'OIDC callback', auth: 'none', tag: 'auth' },
  { method: 'POST', path: '/service/auth/logout', description: 'Logout', auth: 'session', tag: 'auth' },
  { method: 'GET', path: '/service/auth/me', description: 'Current user info', auth: 'session', tag: 'auth' },
  // Usage
  { method: 'GET', path: '/service/usage', description: 'Usage tracking API', auth: 'api_key', tag: 'usage' },
];

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface Dependency {
  name: string;
  env: string;
  required: boolean;
}

export const DEPENDENCIES: Dependency[] = [
  { name: 'MongoDB', env: 'MONGODB_URI', required: true },
  { name: 'WhatsApp API', env: 'WHATSAPP_API_URL', required: true },
  { name: 'Redis', env: 'REDIS_URL', required: false },
  { name: 'Qdrant', env: 'QDRANT_URL', required: false },
  { name: 'OpenRouter LLM', env: 'OPENROUTER_API_KEY', required: false },
  { name: 'SPAO API', env: 'SPAO_API_URL', required: false },
  { name: 'ERPNext', env: 'ERPNEXT_URL', required: false },
];

// ---------------------------------------------------------------------------
// Mode presets
// ---------------------------------------------------------------------------

export const MODE_PRESETS: Record<string, Record<string, string>> = {
  dev: {
    ENABLE_LLM: 'true', ENABLE_QDRANT: 'false', ENABLE_EVENT_QUEUE: 'false',
    ENABLE_ALERTS: 'false', ENABLE_ERPNEXT_SYNC: 'false', ENABLE_SPAO: 'true',
    ENABLE_SOCKET: 'false', ENABLE_KEYCLOAK_AUTH: 'false',
  },
  test: {
    ENABLE_LLM: 'false', ENABLE_QDRANT: 'false', ENABLE_EVENT_QUEUE: 'false',
    ENABLE_ALERTS: 'false', ENABLE_ERPNEXT_SYNC: 'false', ENABLE_SPAO: 'false',
    ENABLE_SOCKET: 'false', ENABLE_KEYCLOAK_AUTH: 'false',
  },
  eval: {
    ENABLE_LLM: 'true', ENABLE_QDRANT: 'true', ENABLE_EVENT_QUEUE: 'false',
    ENABLE_ALERTS: 'false', ENABLE_ERPNEXT_SYNC: 'false', ENABLE_SPAO: 'true',
    ENABLE_SOCKET: 'false', ENABLE_KEYCLOAK_AUTH: 'false',
  },
  prod: {
    ENABLE_LLM: 'true', ENABLE_QDRANT: 'true', ENABLE_EVENT_QUEUE: 'true',
    ENABLE_ALERTS: 'true', ENABLE_ERPNEXT_SYNC: 'true', ENABLE_SPAO: 'true',
    ENABLE_SOCKET: 'true', ENABLE_KEYCLOAK_AUTH: 'true',
  },
};

// ---------------------------------------------------------------------------
// CLI subcommands -- powers the --help listing and agent discovery
// ---------------------------------------------------------------------------

export interface CommandEntry {
  name: string;
  description: string;
  is_default?: boolean;
}

export const COMMANDS: CommandEntry[] = [
  { name: 'serve', description: 'Start the WhatsApp service (default if no command given)', is_default: true },
  { name: 'info', description: 'Print server reference (routes, flags, deps, modes)' },
  { name: 'check', description: 'Check all dependency connections and exit' },
  { name: 'user:list', description: 'List all registered users' },
  { name: 'user:get', description: 'Get a user by identifier (phone number)' },
  { name: 'user:register', description: 'Register a new user with tags' },
  { name: 'tag:list', description: 'List all tag configurations' },
  { name: 'tag:get', description: 'Get a specific tag configuration' },
  { name: 'rag:search', description: 'Semantic search across RAG collections' },
  { name: 'intent:detect', description: 'Detect intent from a message using LLM' },
  { name: 'config:get', description: 'Get a config value by key' },
  { name: 'config:set', description: 'Set a config value' },
  { name: 'config:list', description: 'List config values by prefix' },
];
