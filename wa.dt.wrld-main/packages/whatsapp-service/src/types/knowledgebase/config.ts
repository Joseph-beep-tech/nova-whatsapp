/**
 * Knowledgebase Configuration Types
 *
 * Configuration for KB integrations per tag/business client.
 * Follows the same pattern as LmsConfiguration for consistency.
 */

// =============================================================================
// Schema Mapping Types
// =============================================================================

/**
 * Schema mapping for KB content in Qdrant
 *
 * Different business clients may use different field names in their
 * Qdrant collections. This mapping allows flexible configuration.
 */
export interface KbSchemaMapping {
  /** Field name for unique identifier (e.g., 'faq_id', 'article_id') */
  idField: string;
  /** Field name for content type discriminator (e.g., 'type', 'content_type') */
  typeField?: string;
  /** Field name for question/title (e.g., 'question', 'title') */
  questionField: string;
  /** Field name for answer/content body (e.g., 'answer', 'content') */
  answerField: string;
  /** Field name for category (e.g., 'category', 'topic') */
  categoryField?: string;
  /** Field name for keywords (e.g., 'keywords', 'tags') */
  keywordsField?: string;
  /** Field name for related content IDs (e.g., 'related', 'see_also') */
  relatedField?: string;
  /** Field name for order/sequence (e.g., 'order', 'position') */
  orderField?: string;
}

// =============================================================================
// Collection Configuration
// =============================================================================

/**
 * External Qdrant collection configuration for KB
 *
 * Same structure as LmsCollectionConfig for consistency.
 */
export interface KbCollectionConfig {
  /** Qdrant server URL (external) */
  url: string;
  /** API key for Qdrant (if required) */
  apiKey?: string;
  /** Collection name */
  collectionName: string;
  /** Vector field name (if named vectors used) */
  vectorName?: string;
}

// =============================================================================
// KB Configuration
// =============================================================================

/**
 * KB configuration for a tag/business client
 *
 * This configuration is stored as part of TagConfiguration and
 * determines how the system interacts with the client's KB content.
 */
export interface KbConfiguration {
  /** Whether KB features are enabled for this tag */
  enabled: boolean;
  /** Display name for the knowledgebase */
  displayName?: string;
  /** External content collection configuration */
  contentCollection: KbCollectionConfig;
  /** Schema mapping for content structure */
  schema: KbSchemaMapping;
  /** Auto-detect KB topics from conversations */
  autoDetect?: boolean;
  /** Similarity threshold for topic detection (0-1) */
  detectionThreshold?: number;
  /** Enable comprehension verification flow */
  enableVerification?: boolean;
  /** Custom verification prompt template */
  verificationPrompt?: string;
}
