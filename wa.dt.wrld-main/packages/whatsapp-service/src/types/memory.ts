/**
 * Memory Types
 *
 * Type definitions for conversation memory and Qdrant RAG integration.
 * Supports semantic search and context retrieval for conversations.
 */

import { WhatsAppPlatform } from '../utils/phoneNumber';
import { SpaoRagChunk } from './spao';

// =============================================================================
// Conversation Message Types
// =============================================================================

/** Role of message sender */
export type MessageRole = 'user' | 'assistant' | 'system';

/** A single message in a conversation */
export interface ConversationMessage {
  /** Unique message ID */
  id: string;
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** WhatsApp session ID */
  sessionId: string;
  /** Role of sender */
  role: MessageRole;
  /** Message content (text) */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** Tags associated with this message context */
  tags: string[];
  /** Optional metadata */
  metadata?: {
    /** Original WhatsApp message ID */
    whatsappMessageId?: string;
    /** Message type (text, image, etc.) */
    messageType?: string;
    /** Whether this was a reply */
    isReply?: boolean;
    /** ID of message being replied to */
    replyToId?: string;
  };
}

/** Message with embedding vector (for Qdrant storage) */
export interface EmbeddedMessage extends ConversationMessage {
  /** Embedding vector */
  embedding: number[];
}

// =============================================================================
// Conversation Session Types
// =============================================================================

/** A conversation session (grouping of related messages) */
export interface ConversationSession {
  /** Unique session identifier */
  sessionId: string;
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** Primary tag for this session */
  tag: string;
  /** ISO timestamp when session started */
  startedAt: string;
  /** ISO timestamp of last message */
  lastMessageAt: string;
  /** Number of messages in session */
  messageCount: number;
  /** Whether session is still active */
  isActive: boolean;
  /** Session metadata */
  metadata?: {
    /** System prompt used for this session */
    systemPrompt?: string;
    /** Context window size */
    contextWindow?: number;
  };
}

// =============================================================================
// Context Retrieval Types
// =============================================================================

/** A message with its relevance score from vector search */
export interface ScoredMessage {
  /** The message */
  message: ConversationMessage;
  /** Relevance score (0-1, higher is more relevant) */
  score: number;
}

/** Retrieved context for RAG */
export interface RetrievedContext {
  /** Semantically similar messages from vector search */
  similarMessages: ScoredMessage[];
  /** Recent conversation history (chronological) */
  conversationHistory: ConversationMessage[];
  /** Current session info */
  session?: ConversationSession;
  /** External content from SPAO RAG or other knowledge bases */
  externalContent?: SpaoRagChunk[];
}

/** Request to retrieve context */
export interface ContextRetrievalRequest {
  /** User identifier to retrieve context for */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** Tag to filter by */
  tag: string;
  /** Query text for semantic search */
  query: string;
  /** Number of similar messages to retrieve */
  similarCount?: number;
  /** Number of recent messages to include */
  historyCount?: number;
}

// =============================================================================
// RAG Processing Types
// =============================================================================

/** Input for RAG response generation */
export interface RagInput {
  /** User's message */
  userMessage: string;
  /** User identifier */
  identifier: string;
  /** WhatsApp platform suffix */
  platform: WhatsAppPlatform;
  /** WhatsApp session ID */
  sessionId: string;
  /** Tag for routing */
  tag: string;
  /** Retrieved context */
  context: RetrievedContext;
  /** System prompt */
  systemPrompt: string;
  /** Override LLM model */
  llmModel?: string;
  /** Override temperature (0-1) */
  temperature?: number;
  /** Override max tokens */
  maxTokens?: number;
}

/** Output from RAG response generation */
export interface RagOutput {
  /** Generated response text */
  response: string;
  /** Whether response was successfully generated */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Metadata about generation */
  metadata?: {
    /** Model used */
    model: string;
    /** Tokens used */
    tokensUsed?: number;
    /** Generation time in ms */
    generationTimeMs: number;
    /** Number of context messages used */
    contextMessagesUsed: number;
  };
}

// =============================================================================
// Qdrant Collection Types
// =============================================================================

/** Message type classification for search optimization */
export type MessageType = 'question' | 'statement' | 'command' | 'greeting';

/** TTL category for pruning strategy */
export type TtlCategory = 'ephemeral' | 'session' | 'persistent';

/** Qdrant point payload (stored alongside vector) */
export interface QdrantPointPayload {
  /** Message ID */
  id: string;
  /** Chat ID */
  chatId: string;
  /** Session ID */
  sessionId: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** Tags */
  tags: string[];
  /** Conversation session ID (for grouping) */
  conversationSessionId?: string;

  // === Hybrid Search Fields ===
  /** Normalized content (lowercase, stopwords removed) for keyword matching */
  contentNormalized?: string;
  /** Extracted keywords for search optimization */
  keywords?: string[];
  /** Content length in characters (for BM25 normalization) */
  contentLength?: number;
  /** Classified message type */
  messageType?: MessageType;

  // === Thread Awareness ===
  /** Thread ID for conversation grouping */
  threadId?: string;
  /** Position within the thread (0-indexed) */
  positionInThread?: number;
  /** Whether this is the first message in a thread */
  isThreadStart?: boolean;

  // === Pruning Metadata ===
  /** Importance score (0-1) for retrieval prioritization */
  importance?: number;
  /** TTL category for retention policy */
  ttlCategory?: TtlCategory;
  /** Whether this message was referenced in a summary (protected from pruning) */
  referencedInSummary?: boolean;
}

/** Qdrant search result */
export interface QdrantSearchResult {
  /** Point ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Point payload */
  payload: QdrantPointPayload;
}

// =============================================================================
// Embedding Types
// =============================================================================

/** Request to generate embeddings */
export interface EmbeddingRequest {
  /** Text(s) to embed */
  texts: string[];
  /** Model to use */
  model?: string;
}

/** Response from embedding generation */
export interface EmbeddingResponse {
  /** Generated embeddings */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Number of tokens processed */
  totalTokens?: number;
}

// =============================================================================
// Memory Service Types
// =============================================================================

/** Options for storing a message */
export interface StoreMessageOptions {
  /** Message to store */
  message: ConversationMessage;
  /** Collection to store in (derived from tag if not provided) */
  collection?: string;
  /** Generate and store embedding */
  generateEmbedding?: boolean;
}

/** Options for retrieving messages */
export interface RetrieveMessagesOptions {
  /** User identifier to retrieve for */
  identifier: string;
  /** WhatsApp platform */
  platform?: WhatsAppPlatform;
  /** Tag to filter by */
  tag?: string;
  /** Maximum number of messages */
  limit?: number;
  /** Only messages after this timestamp */
  after?: string;
  /** Only messages before this timestamp */
  before?: string;
}

/** Memory service statistics */
export interface MemoryStats {
  /** Total messages stored */
  totalMessages: number;
  /** Total unique users */
  uniqueUsers: number;
  /** Active sessions */
  activeSessions: number;
  /** Messages per tag */
  messagesByTag: Record<string, number>;
  /** Storage size (if available) */
  storageSizeBytes?: number;
}

// =============================================================================
// Conversation Summary Types
// =============================================================================

/** A single entry in a conversation summary */
export interface SummaryEntry {
  /** When this summary entry was created */
  timestamp: string;
  /** The summary text */
  text: string;
  /** Number of messages this entry summarizes */
  messageCount: number;
  /** IDs of source messages (for reference tracking) */
  sourceMessageIds: string[];
  /** Key topics mentioned in this segment */
  topics: string[];
}

/** Rolling summary for a conversation */
export interface ConversationSummary {
  /** Unique summary ID */
  id: string;
  /** User identifier this summary belongs to */
  identifier: string;
  /** WhatsApp platform */
  platform: WhatsAppPlatform;
  /** Session ID */
  sessionId: string;
  /** Tag context */
  tag: string;
  /** Date of the conversation (YYYY-MM-DD) */
  date: string;
  /** Summary entries (append-only, ordered by time) */
  entries: SummaryEntry[];
  /** Total messages summarized */
  totalMessagesSummarized: number;
  /** When this summary was created */
  createdAt: string;
  /** When this summary was last updated */
  updatedAt: string;
}

/** Options for generating a summary */
export interface SummaryGenerationOptions {
  /** Minimum messages before triggering summary */
  minMessages?: number;
  /** Maximum tokens for the summary */
  maxTokens?: number;
  /** Whether to extract topics */
  extractTopics?: boolean;
}

// =============================================================================
// Hybrid Search Types
// =============================================================================

/** Search strategy for hybrid search */
export type SearchStrategy = 'vector' | 'keyword' | 'hybrid';

/** Options for hybrid search */
export interface HybridSearchOptions {
  /** Search query text */
  query: string;
  /** User identifier to search within */
  identifier: string;
  /** WhatsApp platform */
  platform?: WhatsAppPlatform;
  /** Tag to filter by */
  tag?: string;
  /** Search strategy to use */
  strategy?: SearchStrategy;
  /** Number of results to return */
  limit?: number;
  /** Weight for vector search (0-1), keyword weight = 1 - vectorWeight */
  vectorWeight?: number;
  /** Minimum score threshold (0-1) */
  minScore?: number;
  /** Filter by thread ID */
  threadId?: string;
  /** Filter by message type */
  messageType?: MessageType;
  /** Only include messages after this timestamp */
  after?: string;
  /** Only include messages before this timestamp */
  before?: string;
}

/** Result from hybrid search */
export interface HybridSearchResult {
  /** The message */
  message: ConversationMessage;
  /** Combined relevance score (0-1) */
  score: number;
  /** Individual scores breakdown */
  scores: {
    /** Vector similarity score */
    vector?: number;
    /** Keyword match score */
    keyword?: number;
  };
  /** Thread context if available */
  threadContext?: {
    threadId: string;
    position: number;
    threadSize: number;
  };
}

// =============================================================================
// Thread Detection Types
// =============================================================================

/** A detected conversation thread */
export interface ConversationThread {
  /** Unique thread ID */
  threadId: string;
  /** User identifier */
  identifier: string;
  /** WhatsApp platform */
  platform: WhatsAppPlatform;
  /** Session ID */
  sessionId: string;
  /** When the thread started */
  startedAt: string;
  /** When the thread ended (null if ongoing) */
  endedAt: string | null;
  /** Number of messages in the thread */
  messageCount: number;
  /** Main topics in this thread */
  topics: string[];
  /** Whether this thread is still active */
  isActive: boolean;
}

/** Configuration for thread detection */
export interface ThreadDetectionConfig {
  /** Maximum gap between messages before starting new thread (ms) */
  maxGapMs?: number;
  /** Minimum topic similarity to continue thread (0-1) */
  minTopicSimilarity?: number;
  /** Whether to use semantic similarity for thread detection */
  useSemanticDetection?: boolean;
}
