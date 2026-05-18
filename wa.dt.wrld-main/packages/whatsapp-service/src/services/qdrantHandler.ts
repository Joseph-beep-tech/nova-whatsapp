/**
 * Qdrant RAG Handler Service
 *
 * Provides RAG (Retrieval Augmented Generation) capabilities using Qdrant
 * for vector storage and OpenRouter for embeddings/LLM responses.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { qdrantConfig, config, spaoConfig } from '../shared/config';
import { QdrantRagTarget, RoutableEvent, TagConfiguration } from '../types/routing';
import {
  ConversationMessage,
  ConversationSession,
  RetrievedContext,
  ScoredMessage,
  QdrantPointPayload,
  RagInput,
  RagOutput,
  HybridSearchOptions,
  HybridSearchResult,
  MessageType,
  TtlCategory,
} from '../types/memory';
import { SpaoRagSearchResult, SpaoRagChunk } from '../types/spao';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import { WhatsAppPlatform, DEFAULT_PLATFORM, toChatId, fromChatId } from '../utils/phoneNumber';

// =============================================================================
// Hybrid Search Utilities
// =============================================================================

/** Common English stopwords to filter from keyword extraction */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'you', 'your', 'i', 'me', 'my', 'we', 'our', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'can', 'should', 'would', 'could', 'may',
  'might', 'must', 'shall', 'have', 'had', 'do', 'does', 'did', 'doing', 'been',
  'being', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'any', 'over', 'also',
]);

/**
 * Extract keywords from text for hybrid search
 */
function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  // Normalize: lowercase, remove punctuation, split
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));

  // Count word frequency
  const freq: Map<string, number> = new Map();
  for (const word of normalized) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency, return top keywords
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Normalize content for keyword matching
 */
function normalizeContent(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word))
    .join(' ');
}

/**
 * Classify message type for search optimization
 */
function classifyMessageType(content: string): MessageType {
  const lower = content.toLowerCase().trim();

  // Check for greetings
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hola'];
  if (greetings.some(g => lower.startsWith(g) || lower === g)) {
    return 'greeting';
  }

  // Check for commands (starts with action verbs)
  const commandPrefixes = ['please', 'send', 'show', 'get', 'list', 'find', 'search', 'help', 'give', 'tell'];
  if (commandPrefixes.some(c => lower.startsWith(c))) {
    return 'command';
  }

  // Check for questions
  const questionIndicators = ['?', 'what', 'why', 'how', 'when', 'where', 'who', 'which', 'can you', 'could you', 'would you', 'is it', 'are you', 'do you'];
  if (questionIndicators.some(q => lower.includes(q))) {
    return 'question';
  }

  return 'statement';
}

/**
 * Determine TTL category based on message characteristics
 */
function determineTtlCategory(content: string, messageType: MessageType): TtlCategory {
  // Greetings are ephemeral
  if (messageType === 'greeting') {
    return 'ephemeral';
  }

  // Short messages (< 50 chars) and commands tend to be session-level
  if (content.length < 50 || messageType === 'command') {
    return 'session';
  }

  // Questions and longer statements are worth persisting
  return 'persistent';
}

/**
 * Calculate importance score for message prioritization
 */
function calculateImportance(content: string, messageType: MessageType): number {
  let score = 0.5; // Base score

  // Questions are important
  if (messageType === 'question') {
    score += 0.2;
  }

  // Longer content is generally more informative
  if (content.length > 100) {
    score += 0.1;
  }
  if (content.length > 300) {
    score += 0.1;
  }

  // Content with numbers (dates, amounts) may be more specific
  if (/\d+/.test(content)) {
    score += 0.05;
  }

  // Greetings are less important
  if (messageType === 'greeting') {
    score = 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Reciprocal Rank Fusion (RRF) for combining search results
 * @param k Constant (typically 60) to prevent high ranks from dominating
 */
function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  keywordResults: Array<{ id: string; score: number }>,
  vectorWeight: number = 0.7,
  k: number = 60
): Array<{ id: string; score: number; vectorScore?: number; keywordScore?: number }> {
  const scores: Map<string, { rrf: number; vector?: number; keyword?: number }> = new Map();

  // Process vector results
  vectorResults.forEach((result, rank) => {
    const rrfScore = vectorWeight / (k + rank + 1);
    const existing = scores.get(result.id) || { rrf: 0 };
    existing.rrf += rrfScore;
    existing.vector = result.score;
    scores.set(result.id, existing);
  });

  // Process keyword results
  const keywordWeight = 1 - vectorWeight;
  keywordResults.forEach((result, rank) => {
    const rrfScore = keywordWeight / (k + rank + 1);
    const existing = scores.get(result.id) || { rrf: 0 };
    existing.rrf += rrfScore;
    existing.keyword = result.score;
    scores.set(result.id, existing);
  });

  // Sort by combined RRF score
  return Array.from(scores.entries())
    .map(([id, data]) => ({
      id,
      score: data.rrf,
      vectorScore: data.vector,
      keywordScore: data.keyword,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Qdrant RAG Handler Service
 *
 * Manages conversation memory and generates contextual responses.
 */
class QdrantHandlerService {
  private qdrant: QdrantClient | null = null;
  private openai: OpenAI | null = null;
  private apiClient: WhatsAppApiClient | null = null;
  private isInitialized = false;
  private sessions: Map<string, ConversationSession> = new Map();

  /**
   * Check if Qdrant is enabled
   */
  isEnabled(): boolean {
    return qdrantConfig.enabled;
  }

  /**
   * Initialize the Qdrant handler
   */
  async initialize(): Promise<void> {
    if (!qdrantConfig.enabled) {
      console.log('[QdrantHandler] Qdrant disabled, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      console.log('[QdrantHandler] Already initialized');
      return;
    }

    try {
      // Initialize Qdrant client
      this.qdrant = new QdrantClient({
        url: qdrantConfig.url,
        apiKey: qdrantConfig.apiKey || undefined,
      });

      // Test connection
      await this.qdrant.getCollections();
      console.log('[QdrantHandler] Qdrant connected');

      // Initialize OpenAI client (OpenRouter compatible)
      if (qdrantConfig.openRouterApiKey) {
        this.openai = new OpenAI({
          apiKey: qdrantConfig.openRouterApiKey,
          baseURL: qdrantConfig.openRouterBaseUrl,
        });
        console.log('[QdrantHandler] OpenRouter configured');
      } else {
        console.warn('[QdrantHandler] OpenRouter API key not configured - RAG responses disabled');
      }

      this.isInitialized = true;
      console.log('[QdrantHandler] Initialized successfully');
    } catch (error) {
      console.error('[QdrantHandler] Initialization failed:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Set the WhatsApp API client for sending responses
   */
  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
  }

  /**
   * Get or create a collection for a tag
   */
  private async ensureCollection(collectionName: string): Promise<void> {
    if (!this.qdrant) {
      throw new Error('Qdrant not initialized');
    }

    const fullName = `${qdrantConfig.collectionPrefix}${collectionName}`;

    try {
      await this.qdrant.getCollection(fullName);
    } catch {
      // Collection doesn't exist, create it
      console.log(`[QdrantHandler] Creating collection: ${fullName}`);
      await this.qdrant.createCollection(fullName, {
        vectors: {
          size: qdrantConfig.vectorDimension,
          distance: 'Cosine',
        },
      });
    }
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: qdrantConfig.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Store a message in Qdrant with enhanced payload for hybrid search
   */
  async storeMessage(
    message: ConversationMessage,
    collectionName: string,
    options?: {
      threadId?: string;
      positionInThread?: number;
      isThreadStart?: boolean;
    }
  ): Promise<void> {
    if (!this.qdrant || !this.openai) {
      console.warn('[QdrantHandler] Cannot store message - not fully initialized');
      return;
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collectionName}`;

    try {
      await this.ensureCollection(collectionName);

      // Generate embedding
      const embedding = await this.generateEmbedding(message.content);

      // Extract hybrid search metadata
      const messageType = classifyMessageType(message.content);
      const ttlCategory = determineTtlCategory(message.content, messageType);
      const importance = calculateImportance(message.content, messageType);

      // Create enhanced point payload
      // QdrantPointPayload keeps chatId for backward compatibility with stored vectors
      const payload: QdrantPointPayload = {
        id: message.id,
        chatId: toChatId(message.identifier, message.platform),
        sessionId: message.sessionId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        tags: message.tags,

        // Hybrid search fields
        contentNormalized: normalizeContent(message.content),
        keywords: extractKeywords(message.content),
        contentLength: message.content.length,
        messageType,

        // Thread awareness
        threadId: options?.threadId,
        positionInThread: options?.positionInThread,
        isThreadStart: options?.isThreadStart,

        // Pruning metadata
        importance,
        ttlCategory,
        referencedInSummary: false,
      };

      // Upsert point
      await this.qdrant.upsert(fullCollectionName, {
        wait: true,
        points: [
          {
            id: message.id,
            vector: embedding,
            payload: payload as unknown as Record<string, unknown>,
          },
        ],
      });

      console.log(`[QdrantHandler] Stored message ${message.id} in ${fullCollectionName} (type: ${messageType}, importance: ${importance.toFixed(2)})`);
    } catch (error) {
      console.error('[QdrantHandler] Failed to store message:', getErrorMessage(error));
    }
  }

  /**
   * Retrieve similar messages from Qdrant
   */
  async retrieveSimilar(
    query: string,
    collectionName: string,
    identifier: string,
    limit: number = 5,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM
  ): Promise<ScoredMessage[]> {
    if (!this.qdrant || !this.openai) {
      return [];
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collectionName}`;
    const chatId = toChatId(identifier, platform);

    try {
      // Generate query embedding
      const embedding = await this.generateEmbedding(query);

      // Search Qdrant (uses chatId internally for backward compatibility)
      const results = await this.qdrant.search(fullCollectionName, {
        vector: embedding,
        limit,
        filter: {
          must: [
            {
              key: 'chatId',
              match: { value: chatId },
            },
          ],
        },
        with_payload: true,
      });

      return results.map((result) => {
        const payload = result.payload as unknown as QdrantPointPayload;
        const parsed = fromChatId(payload.chatId);
        return {
          message: {
            id: payload.id,
            identifier: parsed.identifier,
            platform: parsed.platform,
            sessionId: payload.sessionId,
            role: payload.role,
            content: payload.content,
            timestamp: payload.timestamp,
            tags: payload.tags,
          },
          score: result.score,
        };
      });
    } catch (error) {
      console.error('[QdrantHandler] Failed to retrieve similar:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Retrieve content from SPAO's RAG search API.
   * Used for curriculum/knowledge base content that lives in SPAO's Qdrant (1536-dim).
   * wa.dt.wrld sends a text query, SPAO handles embedding + search, returns text chunks.
   */
  async retrieveExternalContent(
    query: string,
    tagConfig?: TagConfiguration
  ): Promise<SpaoRagChunk[]> {
    const voiceApiUrl = tagConfig?.spao?.voiceApiUrl || spaoConfig.voiceApiUrl;
    const apiKey = spaoConfig.apiKey;

    if (!spaoConfig.enabled && !tagConfig?.spao?.enabled) {
      return [];
    }

    try {
      const response = await axios.post<SpaoRagSearchResult>(
        `${voiceApiUrl}/rag/search`,
        {
          query,
          collection_name: 'documents',
          n_results: 5,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
          },
          timeout: 8000,
        }
      );

      if (response.data.success && response.data.results) {
        console.log(`[QdrantHandler] SPAO RAG returned ${response.data.results.length} chunks for: "${query.slice(0, 50)}..."`);
        return response.data.results;
      }

      if (!response.data.success) {
        console.warn('[QdrantHandler] SPAO RAG search failed:', response.data.error);
      }

      return [];
    } catch (error) {
      console.warn('[QdrantHandler] SPAO RAG search unavailable:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Perform keyword search using Qdrant's text matching
   */
  private async keywordSearch(
    query: string,
    collectionName: string,
    qdrantChatId: string,
    limit: number = 10
  ): Promise<Array<{ id: string; score: number; payload: QdrantPointPayload }>> {
    if (!this.qdrant) {
      return [];
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collectionName}`;
    const keywords = extractKeywords(query, 5);

    if (keywords.length === 0) {
      return [];
    }

    try {
      // Use scroll with keyword filter to find matches
      const results = await this.qdrant.scroll(fullCollectionName, {
        filter: {
          must: [
            { key: 'chatId', match: { value: qdrantChatId } },
          ],
          should: keywords.map(keyword => ({
            key: 'keywords',
            match: { value: keyword },
          })),
        },
        limit,
        with_payload: true,
        with_vector: false,
      });

      // Score based on keyword overlap
      return results.points.map((point) => {
        const payload = point.payload as unknown as QdrantPointPayload;
        const messageKeywords = payload.keywords || [];

        // Calculate Jaccard similarity for scoring
        const intersection = keywords.filter(k => messageKeywords.includes(k)).length;
        const union = new Set([...keywords, ...messageKeywords]).size;
        const score = union > 0 ? intersection / union : 0;

        return {
          id: String(point.id),
          score,
          payload,
        };
      }).sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('[QdrantHandler] Keyword search failed:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Hybrid search combining vector and keyword search with RRF fusion
   */
  async hybridSearch(
    options: HybridSearchOptions,
    collectionName: string
  ): Promise<HybridSearchResult[]> {
    if (!this.qdrant || !this.openai) {
      return [];
    }

    const {
      query,
      identifier,
      platform = DEFAULT_PLATFORM,
      tag,
      strategy = 'hybrid',
      limit = 10,
      vectorWeight = 0.7,
      minScore = 0,
      threadId,
      messageType,
      after,
      before,
    } = options;

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collectionName}`;
    const qdrantChatId = toChatId(identifier, platform);

    try {
      // Build base filter (Qdrant stores chatId internally)
      const mustFilters: Array<{ key: string; match?: { value: string }; range?: { gt?: string; lt?: string } }> = [
        { key: 'chatId', match: { value: qdrantChatId } },
      ];

      if (tag) {
        mustFilters.push({ key: 'tags', match: { value: tag } });
      }
      if (threadId) {
        mustFilters.push({ key: 'threadId', match: { value: threadId } });
      }
      if (messageType) {
        mustFilters.push({ key: 'messageType', match: { value: messageType } });
      }
      if (after || before) {
        const range: { gt?: string; lt?: string } = {};
        if (after) range.gt = after;
        if (before) range.lt = before;
        mustFilters.push({ key: 'timestamp', range });
      }

      // Execute searches based on strategy
      let vectorResults: Array<{ id: string; score: number }> = [];
      let keywordResults: Array<{ id: string; score: number }> = [];
      const payloadsById: Map<string, QdrantPointPayload> = new Map();

      if (strategy === 'vector' || strategy === 'hybrid') {
        const embedding = await this.generateEmbedding(query);
        const results = await this.qdrant.search(fullCollectionName, {
          vector: embedding,
          limit: limit * 2, // Fetch more for RRF fusion
          filter: { must: mustFilters },
          with_payload: true,
        });

        vectorResults = results.map(r => {
          const payload = r.payload as unknown as QdrantPointPayload;
          payloadsById.set(String(r.id), payload);
          return { id: String(r.id), score: r.score };
        });
      }

      if (strategy === 'keyword' || strategy === 'hybrid') {
        const kwResults = await this.keywordSearch(query, collectionName, qdrantChatId, limit * 2);
        keywordResults = kwResults.map(r => {
          payloadsById.set(r.id, r.payload);
          return { id: r.id, score: r.score };
        });
      }

      // Combine results
      let fusedResults: Array<{ id: string; score: number; vectorScore?: number; keywordScore?: number }>;

      if (strategy === 'hybrid') {
        fusedResults = reciprocalRankFusion(vectorResults, keywordResults, vectorWeight);
      } else if (strategy === 'vector') {
        fusedResults = vectorResults.map(r => ({ ...r, vectorScore: r.score }));
      } else {
        fusedResults = keywordResults.map(r => ({ ...r, keywordScore: r.score }));
      }

      // Filter by minimum score and limit
      const filtered = fusedResults
        .filter(r => r.score >= minScore)
        .slice(0, limit);

      // Build response
      return filtered.map(result => {
        const payload = payloadsById.get(result.id)!;
        const parsed = fromChatId(payload.chatId);
        return {
          message: {
            id: payload.id,
            identifier: parsed.identifier,
            platform: parsed.platform,
            sessionId: payload.sessionId,
            role: payload.role,
            content: payload.content,
            timestamp: payload.timestamp,
            tags: payload.tags,
          },
          score: result.score,
          scores: {
            vector: result.vectorScore,
            keyword: result.keywordScore,
          },
          threadContext: payload.threadId ? {
            threadId: payload.threadId,
            position: payload.positionInThread || 0,
            threadSize: 0, // Would need additional query to get thread size
          } : undefined,
        };
      });
    } catch (error) {
      console.error('[QdrantHandler] Hybrid search failed:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get recent conversation history
   */
  async getConversationHistory(
    collectionName: string,
    identifier: string,
    limit: number = 10,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM
  ): Promise<ConversationMessage[]> {
    if (!this.qdrant) {
      return [];
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collectionName}`;
    const qdrantChatId = toChatId(identifier, platform);

    try {
      // Scroll through points filtered by chatId, ordered by timestamp
      const results = await this.qdrant.scroll(fullCollectionName, {
        filter: {
          must: [
            {
              key: 'chatId',
              match: { value: qdrantChatId },
            },
          ],
        },
        limit,
        with_payload: true,
        with_vector: false,
      });

      const messages = results.points.map((point) => {
        const payload = point.payload as unknown as QdrantPointPayload;
        const parsed = fromChatId(payload.chatId);
        return {
          id: payload.id,
          identifier: parsed.identifier,
          platform: parsed.platform,
          sessionId: payload.sessionId,
          role: payload.role,
          content: payload.content,
          timestamp: payload.timestamp,
          tags: payload.tags,
        };
      });

      // Sort by timestamp descending and take limit
      return messages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .reverse(); // Return in chronological order
    } catch (error) {
      console.error('[QdrantHandler] Failed to get history:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Generate LLM response with context
   */
  private async generateResponse(input: RagInput): Promise<RagOutput> {
    if (!this.openai) {
      return {
        response: '',
        success: false,
        error: 'OpenAI client not initialized',
      };
    }

    const startTime = Date.now();

    try {
      // Build messages for LLM
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: input.systemPrompt,
        },
      ];

      // Add context from similar messages
      if (input.context.similarMessages.length > 0) {
        const contextText = input.context.similarMessages
          .map((sm) => `[${sm.message.role}]: ${sm.message.content}`)
          .join('\n');
        messages.push({
          role: 'system',
          content: `Relevant context from previous conversations:\n${contextText}`,
        });
      }

      // Add recent conversation history
      for (const msg of input.context.conversationHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }

      // Add external content context (from SPAO RAG or other knowledge bases)
      if (input.context.externalContent && input.context.externalContent.length > 0) {
        const contentText = input.context.externalContent
          .map((chunk) => chunk.text)
          .join('\n\n---\n\n');
        messages.push({
          role: 'system',
          content: `Reference material from the knowledge base:\n${contentText}`,
        });
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: input.userMessage,
      });

      // Generate response — use config values if available, fall back to defaults
      const completion = await this.openai.chat.completions.create({
        model: input.llmModel || qdrantConfig.llmModel,
        messages,
        max_tokens: input.maxTokens || 1024,
        temperature: input.temperature ?? 0.7,
      });

      const response = completion.choices[0]?.message?.content || '';

      return {
        response,
        success: true,
        metadata: {
          model: qdrantConfig.llmModel,
          tokensUsed: completion.usage?.total_tokens,
          generationTimeMs: Date.now() - startTime,
          contextMessagesUsed: input.context.conversationHistory.length + input.context.similarMessages.length,
        },
      };
    } catch (error) {
      return {
        response: '',
        success: false,
        error: getErrorMessage(error),
        metadata: {
          model: qdrantConfig.llmModel,
          generationTimeMs: Date.now() - startTime,
          contextMessagesUsed: 0,
        },
      };
    }
  }

  /**
   * Handle a routed event (called by eventRouter)
   *
   * @param event - The routable event to process
   * @param config - Qdrant RAG target configuration
   * @param tagConfig - Optional full tag configuration (used for SPAO content retrieval)
   */
  async handleEvent(event: RoutableEvent, config: QdrantRagTarget, tagConfig?: TagConfiguration): Promise<unknown> {
    if (!this.isInitialized) {
      throw new Error('QdrantHandler not initialized');
    }

    // Extract message content from event
    const messageContent = this.extractMessageContent(event.data);
    if (!messageContent) {
      console.log('[QdrantHandler] No message content to process');
      return { skipped: true, reason: 'no_message_content' };
    }

    const collectionName = config.collectionName;
    const contextWindow = config.contextWindow || qdrantConfig.defaultContextWindow;
    const systemPrompt = config.systemPrompt || 'You are a helpful assistant.';

    // Store the incoming user message
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      identifier: event.identifier,
      platform: event.platform,
      sessionId: event.sessionId,
      role: 'user',
      content: messageContent,
      timestamp: event.receivedAt,
      tags: event.tags,
    };

    await this.storeMessage(userMessage, collectionName);

    // Retrieve context — local conversation memory + external content + voice summaries in parallel
    const tag = event.tags[0] || 'default';
    const [similarMessages, conversationHistory, externalContent, voiceSummaries] = await Promise.all([
      this.retrieveSimilar(messageContent, collectionName, event.identifier, 5, event.platform),
      this.getConversationHistory(collectionName, event.identifier, contextWindow, event.platform),
      this.retrieveExternalContent(messageContent, tagConfig),
      tagConfig?.spao?.enabled
        ? this.searchVoiceSummaries(messageContent, tag, event.identifier, 3)
        : Promise.resolve([]),
    ]);

    // Merge voice summaries into external content (they appear as additional context)
    const allExternalContent = [...externalContent];
    for (const vs of voiceSummaries) {
      if (vs.text) {
        allExternalContent.push({
          text: `[Voice session ${vs.type === 'mcp_tool_call' ? 'tool event' : 'summary'}]: ${vs.text}`,
          score: vs.score,
          source: 'voice_session',
        });
      }
    }

    const context: RetrievedContext = {
      similarMessages,
      conversationHistory,
      externalContent: allExternalContent.length > 0 ? allExternalContent : undefined,
    };

    // Generate response — pass config overrides for temperature/maxTokens
    const ragInput: RagInput = {
      userMessage: messageContent,
      identifier: event.identifier,
      platform: event.platform,
      sessionId: event.sessionId,
      tag: event.tags[0] || 'default',
      context,
      systemPrompt,
      llmModel: config.llmModel,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    const ragOutput = await this.generateResponse(ragInput);

    if (!ragOutput.success) {
      console.error('[QdrantHandler] Response generation failed:', ragOutput.error);
      return { success: false, error: ragOutput.error };
    }

    // Store assistant response
    const assistantMessage: ConversationMessage = {
      id: uuidv4(),
      identifier: event.identifier,
      platform: event.platform,
      sessionId: event.sessionId,
      role: 'assistant',
      content: ragOutput.response,
      timestamp: new Date().toISOString(),
      tags: event.tags,
    };

    await this.storeMessage(assistantMessage, collectionName);

    // Send response via WhatsApp (wwebjs-api requires chatId format)
    if (this.apiClient) {
      try {
        const chatIdForApi = toChatId(event.identifier, event.platform);
        await this.apiClient.sendMessage(event.sessionId, {
          chatId: chatIdForApi,
          contentType: 'string',
          content: ragOutput.response,
        });
        console.log(`[QdrantHandler] Response sent to ${event.identifier}`);
      } catch (error) {
        console.error('[QdrantHandler] Failed to send response:', getErrorMessage(error));
      }
    }

    // Forward to response webhook if configured
    if (config.responseWebhook) {
      try {
        const axios = require('axios');
        await axios.post(config.responseWebhook, {
          event,
          response: ragOutput.response,
          context: {
            similarCount: similarMessages.length,
            historyCount: conversationHistory.length,
          },
        });
      } catch (error) {
        console.error('[QdrantHandler] Failed to forward to response webhook:', getErrorMessage(error));
      }
    }

    return {
      success: true,
      response: ragOutput.response,
      metadata: ragOutput.metadata,
    };
  }

  /**
   * Extract message content from event data
   */
  private extractMessageContent(data: Record<string, unknown>): string | null {
    // Try common locations for message body
    const candidates = [
      data.body,
      data.message,
      data.content,
      data.text,
      (data.message as Record<string, unknown>)?.body,
      (data.msg as Record<string, unknown>)?.body,
      (data.data as Record<string, unknown>)?.body,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<{
    vectorCount: number;
    indexedVectors: number;
  } | null> {
    if (!this.qdrant) {
      return null;
    }

    const fullName = `${qdrantConfig.collectionPrefix}${collectionName}`;

    try {
      const info = await this.qdrant.getCollection(fullName);
      return {
        vectorCount: info.points_count || 0,
        indexedVectors: info.indexed_vectors_count || 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    if (!this.qdrant) {
      return false;
    }

    const fullName = `${qdrantConfig.collectionPrefix}${collectionName}`;

    try {
      await this.qdrant.deleteCollection(fullName);
      console.log(`[QdrantHandler] Collection deleted: ${fullName}`);
      return true;
    } catch (error) {
      console.error('[QdrantHandler] Failed to delete collection:', getErrorMessage(error));
      return false;
    }
  }

  // =============================================================================
  // Voice Summary Memory (Phase 4)
  // =============================================================================

  /**
   * Store a voice session summary or MCP tool event in the voice_summaries_{tag} collection.
   * Uses 384-dim embeddings (same as conversation memory).
   */
  async storeVoiceSummary(
    tag: string,
    phone: string,
    text: string,
    metadata: {
      type: 'transcript_summary' | 'mcp_tool_call';
      callSid?: string;
      sessionId?: string;
      topics?: string[];
      toolName?: string;
      timestamp?: string;
    }
  ): Promise<void> {
    if (!this.qdrant || !this.openai) {
      return;
    }

    const collectionName = `voice_summaries_${tag.toLowerCase()}`;

    try {
      await this.ensureCollection(collectionName);
      const embedding = await this.generateEmbedding(text);

      await this.qdrant.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: uuidv4(),
            vector: embedding,
            payload: {
              phone,
              text,
              type: metadata.type,
              callSid: metadata.callSid || '',
              sessionId: metadata.sessionId || '',
              topics: metadata.topics || [],
              toolName: metadata.toolName || '',
              timestamp: metadata.timestamp || new Date().toISOString(),
              tag,
            },
          },
        ],
      });

      console.log(`[QdrantHandler] Stored voice summary in ${collectionName} (type=${metadata.type})`);
    } catch (error) {
      console.error('[QdrantHandler] Failed to store voice summary:', getErrorMessage(error));
    }
  }

  /**
   * Search voice summaries for a user by phone number (semantic search).
   * Returns relevant voice session context for cross-channel queries.
   */
  async searchVoiceSummaries(
    query: string,
    tag: string,
    phone: string,
    limit = 3
  ): Promise<Array<{ text: string; score: number; type: string; timestamp: string }>> {
    if (!this.qdrant || !this.openai) {
      return [];
    }

    const collectionName = `voice_summaries_${tag.toLowerCase()}`;

    try {
      const embedding = await this.generateEmbedding(query);

      const results = await this.qdrant.search(collectionName, {
        vector: embedding,
        limit,
        filter: {
          must: [
            { key: 'phone', match: { value: phone } },
          ],
        },
        with_payload: true,
      });

      return results.map((result) => {
        const payload = result.payload as Record<string, unknown>;
        return {
          text: (payload.text as string) || '',
          score: result.score,
          type: (payload.type as string) || 'unknown',
          timestamp: (payload.timestamp as string) || '',
        };
      });
    } catch {
      // Collection may not exist yet — that's fine
      return [];
    }
  }

  // =============================================================================
  // Memory Insights Methods
  // =============================================================================

  /**
   * Get memory statistics for a specific chat and optionally filtered by tag
   */
  async getMemoryStats(
    identifier: string,
    tag?: string,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM
  ): Promise<{
    identifier: string;
    platform: WhatsAppPlatform;
    tags: string[];
    collections: Array<{
      collectionName: string;
      vectorCount: number;
      indexedVectors: number;
      storageSizeBytes?: number;
      lastUpdatedAt?: string;
    }>;
    totalMessages: number;
    totalStorageBytes: number;
  } | null> {
    if (!this.qdrant) {
      console.warn('[QdrantHandler] Cannot get memory stats - not initialized');
      return null;
    }

    const qdrantChatId = toChatId(identifier, platform);

    try {
      // Get all collections
      const collectionsResponse = await this.qdrant.getCollections();
      const prefix = qdrantConfig.collectionPrefix;
      const relevantCollections = collectionsResponse.collections
        .map(c => c.name)
        .filter(name => name.startsWith(prefix));

      if (relevantCollections.length === 0) {
        return {
          identifier,
          platform,
          tags: tag ? [tag] : [],
          collections: [],
          totalMessages: 0,
          totalStorageBytes: 0,
        };
      }

      const collectionStats: Array<{
        collectionName: string;
        vectorCount: number;
        indexedVectors: number;
        storageSizeBytes?: number;
        lastUpdatedAt?: string;
      }> = [];
      let totalMessages = 0;
      let totalStorageBytes = 0;

      // Gather stats from each collection
      for (const fullName of relevantCollections) {
        const collectionName = fullName.replace(prefix, '');

        try {
          // Get collection info
          const info = await this.qdrant.getCollection(fullName);

          // Count messages for this identifier (and tag if specified)
          const filter: {
            must: Array<{ key: string; match: { value: string } }>;
          } = {
            must: [{ key: 'chatId', match: { value: qdrantChatId } }],
          };

          if (tag) {
            filter.must.push({ key: 'tags', match: { value: tag } });
          }

          const scrollResult = await this.qdrant.scroll(fullName, {
            filter,
            limit: 1,
            with_payload: false,
            with_vector: false,
          });

          // Get total count for this chatId/tag
          const count = scrollResult.points.length > 0 ? await this.countPoints(fullName, filter) : 0;

          if (count > 0) {
            const stats = {
              collectionName,
              vectorCount: count,
              indexedVectors: info.indexed_vectors_count || 0,
              storageSizeBytes: this.estimateStorageSize(count, info),
              lastUpdatedAt: new Date().toISOString(),
            };

            collectionStats.push(stats);
            totalMessages += count;
            totalStorageBytes += stats.storageSizeBytes || 0;
          }
        } catch (error) {
          console.error(`[QdrantHandler] Failed to get stats for collection ${collectionName}:`, getErrorMessage(error));
        }
      }

      return {
        identifier,
        platform,
        tags: tag ? [tag] : [],
        collections: collectionStats,
        totalMessages,
        totalStorageBytes,
      };
    } catch (error) {
      console.error('[QdrantHandler] Failed to get memory stats:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Count points matching a filter in a collection
   */
  private async countPoints(
    collectionName: string,
    filter: { must: Array<{ key: string; match: { value: string } }> }
  ): Promise<number> {
    if (!this.qdrant) {
      return 0;
    }

    try {
      let count = 0;
      let offset: string | number | Record<string, unknown> | undefined = undefined;

      // Scroll through all matching points to count them
      while (true) {
        const result = await this.qdrant.scroll(collectionName, {
          filter,
          limit: 100,
          offset,
          with_payload: false,
          with_vector: false,
        });

        count += result.points.length;

        if (result.next_page_offset === null || result.next_page_offset === undefined) {
          break;
        }
        offset = result.next_page_offset;
      }

      return count;
    } catch (error) {
      console.error('[QdrantHandler] Failed to count points:', getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Estimate storage size for vectors
   */
  private estimateStorageSize(
    vectorCount: number,
    collectionInfo: { vectors_count?: number; config?: { params?: { vectors?: { size?: number } } } }
  ): number {
    // Each vector: dimension * 4 bytes (float32) + overhead for payload (~500 bytes average)
    const vectorDim = qdrantConfig.vectorDimension;
    const bytesPerVector = vectorDim * 4 + 500;
    return vectorCount * bytesPerVector;
  }

  /**
   * Search memories using hybrid search
   */
  async searchMemories(options: {
    query: string;
    identifier?: string;
    platform?: WhatsAppPlatform;
    tag?: string;
    collection?: string;
    strategy?: 'hybrid' | 'vector' | 'keyword';
    limit?: number;
    offset?: number;
  }): Promise<{
    results: Array<{
      id: string;
      identifier: string;
      platform: WhatsAppPlatform;
      sessionId: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: string;
      tags: string[];
      score: number;
      vectorScore?: number;
      keywordScore?: number;
      keywords?: string[];
      messageType?: string;
      importance?: number;
    }>;
    total: number;
    count: number;
    offset: number;
    limit: number;
  } | null> {
    if (!this.qdrant || !this.openai) {
      console.warn('[QdrantHandler] Cannot search memories - not fully initialized');
      return null;
    }

    const {
      query,
      identifier,
      platform = DEFAULT_PLATFORM,
      tag,
      collection = 'default',
      strategy = 'hybrid',
      limit = 10,
      offset = 0,
    } = options;

    // If identifier not provided, we can't filter, return empty
    if (!identifier) {
      return {
        results: [],
        total: 0,
        count: 0,
        offset,
        limit,
      };
    }

    try {
      // Use existing hybridSearch method
      const searchResults = await this.hybridSearch(
        {
          query,
          identifier,
          platform,
          tag,
          strategy,
          limit: limit + offset, // Get more to handle offset
        },
        collection
      );

      // Apply offset and limit
      const paginatedResults = searchResults.slice(offset, offset + limit);

      // Map to API response format - need to get additional fields from Qdrant payloads
      const results = await Promise.all(
        paginatedResults.map(async result => {
          // Get the full payload from Qdrant to access additional fields
          const fullCollectionName = `${qdrantConfig.collectionPrefix}${collection}`;
          let keywords: string[] | undefined;
          let messageType: string | undefined;
          let importance: number | undefined;

          try {
            const points = await this.qdrant!.retrieve(fullCollectionName, {
              ids: [result.message.id],
              with_payload: true,
            });

            if (points.length > 0) {
              const payload = points[0].payload as unknown as QdrantPointPayload;
              keywords = payload.keywords;
              messageType = payload.messageType;
              importance = payload.importance;
            }
          } catch (error) {
            // If retrieval fails, just use what we have
            console.warn(`[QdrantHandler] Could not retrieve full payload for ${result.message.id}`);
          }

          return {
            id: result.message.id,
            identifier: result.message.identifier,
            platform: result.message.platform,
            sessionId: result.message.sessionId,
            role: result.message.role,
            content: result.message.content,
            timestamp: result.message.timestamp,
            tags: result.message.tags,
            score: result.score,
            vectorScore: result.scores.vector,
            keywordScore: result.scores.keyword,
            keywords,
            messageType,
            importance,
          };
        })
      );

      return {
        results,
        total: searchResults.length,
        count: results.length,
        offset,
        limit,
      };
    } catch (error) {
      console.error('[QdrantHandler] Failed to search memories:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Export all memories for a specific chat from a collection
   */
  async exportMemories(
    identifier: string,
    collection: string = 'default',
    platform: WhatsAppPlatform = DEFAULT_PLATFORM
  ): Promise<{
    identifier: string;
    platform: WhatsAppPlatform;
    exportedAt: string;
    messages: Array<{
      id: string;
      identifier: string;
      platform: WhatsAppPlatform;
      sessionId: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: string;
      tags: string[];
      keywords?: string[];
      messageType?: string;
      importance?: number;
    }>;
    count: number;
    collections: string[];
  } | null> {
    if (!this.qdrant) {
      console.warn('[QdrantHandler] Cannot export memories - not initialized');
      return null;
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collection}`;
    const qdrantChatId = toChatId(identifier, platform);

    try {
      const messages: Array<{
        id: string;
        identifier: string;
        platform: WhatsAppPlatform;
        sessionId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: string;
        tags: string[];
        keywords?: string[];
        messageType?: string;
        importance?: number;
      }> = [];

      let offset: string | number | Record<string, unknown> | undefined = undefined;

      // Scroll through all points for this identifier
      while (true) {
        const result = await this.qdrant.scroll(fullCollectionName, {
          filter: {
            must: [{ key: 'chatId', match: { value: qdrantChatId } }],
          },
          limit: 100,
          offset,
          with_payload: true,
          with_vector: false,
        });

        for (const point of result.points) {
          const payload = point.payload as unknown as QdrantPointPayload;
          const parsed = fromChatId(payload.chatId);
          messages.push({
            id: payload.id,
            identifier: parsed.identifier,
            platform: parsed.platform,
            sessionId: payload.sessionId,
            role: payload.role,
            content: payload.content,
            timestamp: payload.timestamp,
            tags: payload.tags || [],
            keywords: payload.keywords,
            messageType: payload.messageType,
            importance: payload.importance,
          });
        }

        if (result.next_page_offset === null || result.next_page_offset === undefined) {
          break;
        }
        offset = result.next_page_offset;
      }

      // Sort by timestamp
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        identifier,
        platform,
        exportedAt: new Date().toISOString(),
        messages,
        count: messages.length,
        collections: [collection],
      };
    } catch (error) {
      console.error('[QdrantHandler] Failed to export memories:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Delete a specific memory by message ID from a collection
   */
  async deleteMemory(
    messageId: string,
    collection: string = 'default'
  ): Promise<{
    messageId: string;
    collection: string;
    deleted: boolean;
  }> {
    if (!this.qdrant) {
      console.warn('[QdrantHandler] Cannot delete memory - not initialized');
      return {
        messageId,
        collection,
        deleted: false,
      };
    }

    const fullCollectionName = `${qdrantConfig.collectionPrefix}${collection}`;

    try {
      // Delete the point by ID
      await this.qdrant.delete(fullCollectionName, {
        points: [messageId],
      });

      console.log(`[QdrantHandler] Deleted memory ${messageId} from ${collection}`);

      return {
        messageId,
        collection,
        deleted: true,
      };
    } catch (error) {
      console.error('[QdrantHandler] Failed to delete memory:', getErrorMessage(error));
      return {
        messageId,
        collection,
        deleted: false,
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[QdrantHandler] Shutting down...');
    this.isInitialized = false;
    this.qdrant = null;
    this.openai = null;
    console.log('[QdrantHandler] Shutdown complete');
  }
}

// Singleton instance
export const qdrantHandler = new QdrantHandlerService();

// Export utilities for testing and external use
export {
  extractKeywords,
  normalizeContent,
  classifyMessageType,
  determineTtlCategory,
  calculateImportance,
  reciprocalRankFusion,
  STOPWORDS,
};
