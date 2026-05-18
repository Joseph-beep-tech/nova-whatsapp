/**
 * LMS Configuration Types
 *
 * Configuration for Learning Management System integrations.
 * Supports multiple business clients with different content structures.
 */

/**
 * Schema mapping for LMS content
 *
 * Different business clients may use different field names in their
 * Qdrant collections. This mapping allows flexible configuration.
 */
export interface LmsSchemaMapping {
  /** Field name for module identifier (e.g., 'module_number', 'course_id') */
  moduleField: string;
  /** Field name for module name/title */
  moduleNameField?: string;
  /** Field name for section/topic (e.g., 'section_title', 'lesson_name') */
  sectionField: string;
  /** Field name for content (e.g., 'text', 'content', 'body') */
  contentField: string;
  /** Field name for order/sequence (e.g., 'chunk_index', 'order') */
  orderField?: string;
  /** Nested topic field if topics are separate from sections */
  topicField?: string;
}

/**
 * External Qdrant collection configuration
 *
 * Each business client can have their content in different Qdrant instances.
 */
export interface LmsCollectionConfig {
  /** Qdrant server URL (external) */
  url: string;
  /** API key for Qdrant (if required) */
  apiKey?: string;
  /** Collection name */
  collectionName: string;
  /** Vector field name (if named vectors used) */
  vectorName?: string;
}

/**
 * LMS configuration for a tag/business client
 *
 * This configuration is stored as part of TagConfiguration and
 * determines how the system interacts with the client's content.
 */
export interface LmsConfiguration {
  /** Whether LMS features are enabled for this tag */
  enabled: boolean;
  /** Display name for the learning program */
  programName?: string;
  /** External content collection configuration */
  contentCollection: LmsCollectionConfig;
  /** Schema mapping for content structure */
  schema: LmsSchemaMapping;
  /** Auto-detect learning topics from conversations */
  autoDetect?: boolean;
  /** Similarity threshold for topic detection (0-1) */
  detectionThreshold?: number;
}
