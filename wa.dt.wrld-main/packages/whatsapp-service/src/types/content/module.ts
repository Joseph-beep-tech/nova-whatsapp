/**
 * Module Structure Types
 *
 * Represents the structure of learning content modules.
 * Schema-agnostic - field names determined by LmsSchemaMapping.
 */

/**
 * A module in the LMS content
 *
 * Represents a learning unit (module, course, chapter, etc.)
 * with its sections/topics.
 */
export interface ModuleStructure {
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
 * Section/topic within a module
 *
 * Represents a subsection of a module.
 */
export interface SectionInfo {
  /** Section/topic title */
  sectionTitle: string;
  /** Number of content chunks in this section */
  chunkCount: number;
  /** Display order within module */
  order?: number;
}

/**
 * Content search result
 *
 * Result from semantic search over LMS content.
 */
export interface ContentSearchResult {
  /** Module identifier */
  moduleId: string | number;
  /** Section title */
  sectionTitle: string;
  /** Content text */
  content: string;
  /** Similarity score (0-1) */
  score: number;
  /** Full payload from Qdrant */
  payload: Record<string, unknown>;
}
