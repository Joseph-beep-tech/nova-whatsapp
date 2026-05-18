/**
 * Knowledgebase Content Types
 *
 * Base types for all RAG content (modules, FAQs, articles).
 * Designed for reusability across different content types.
 */

// =============================================================================
// Base Content Types (reusable across all RAG content)
// =============================================================================

/** Content type discriminator */
export type ContentType = 'module' | 'faq' | 'article';

/**
 * Base RAG content structure
 *
 * All content (modules, FAQs, articles) shares these fields.
 * Extend this for content-type-specific fields.
 */
export interface RagContent {
  /** Unique content identifier */
  contentId: string | number;
  /** Content type discriminator */
  contentType: ContentType;
  /** Title (question for FAQ, title for article/module) */
  title: string;
  /** Main content body */
  content: string;
  /** Category/topic for grouping */
  category?: string;
  /** Display order */
  order?: number;
  /** Related content IDs */
  related?: (string | number)[];
  /** Searchable keywords */
  keywords?: string[];
  /** Last updated (ISO timestamp) */
  lastUpdated?: string;
  /** Flexible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Unified search result for any RAG content
 *
 * Works for modules, FAQs, and articles.
 */
export interface ContentSearchResult {
  /** Content identifier */
  contentId: string | number;
  /** Content type */
  contentType: ContentType;
  /** Title */
  title: string;
  /** Content snippet or full content */
  content: string;
  /** Similarity score (0-1) */
  score: number;
  /** Category */
  category?: string;
  /** Section title (for modules) */
  sectionTitle?: string;
  /** Raw payload from vector store */
  payload?: Record<string, unknown>;
}

// =============================================================================
// Content-Type Extensions (only where truly different)
// =============================================================================

/**
 * FAQ extends base with question/answer semantics
 */
export interface FaqContent extends RagContent {
  contentType: 'faq';
  /** Alias: title is the question */
  question: string;
  /** Alias: content is the answer */
  answer: string;
}

/**
 * Article extends base with sections and reading time
 */
export interface ArticleContent extends RagContent {
  contentType: 'article';
  /** Summary/excerpt */
  summary?: string;
  /** Sections for progress tracking */
  sections?: ContentSection[];
  /** Reading time estimate (minutes) */
  readingTimeMinutes?: number;
}

/**
 * Section within content (articles, modules)
 */
export interface ContentSection {
  /** Section identifier */
  sectionId: string;
  /** Section title */
  title: string;
  /** Section content */
  content?: string;
  /** Order within parent */
  order: number;
}

// =============================================================================
// Factory helpers
// =============================================================================

/** Create FAQ from base fields */
export function createFaq(
  id: string | number,
  question: string,
  answer: string,
  category?: string
): FaqContent {
  return {
    contentId: id,
    contentType: 'faq',
    title: question,
    question,
    content: answer,
    answer,
    category,
  };
}

/** Create article from base fields */
export function createArticle(
  id: string | number,
  title: string,
  content: string,
  category?: string
): ArticleContent {
  return {
    contentId: id,
    contentType: 'article',
    title,
    content,
    category,
  };
}
