/**
 * Knowledgebase API Types
 *
 * Request and response types for KB API endpoints.
 * Follows the same patterns as learning/api.ts.
 */

import { UserKbData, KbModuleProgress } from './progress';
import { ContentType, FaqContent, ArticleContent, ContentSearchResult } from './content';
import { KbQuestion, VerificationResult } from './questions';

// =============================================================================
// Query Types
// =============================================================================

/**
 * Request to get KB engagement for a user
 */
export interface KbQueryRequest {
  /** User's WhatsApp chat ID */
  chatId: string;
  /** Business client tag */
  tag: string;
  /** Include full content structure */
  includeContent?: boolean;
  /** Include question history */
  includeHistory?: boolean;
}

/**
 * Response for KB engagement query
 */
export interface KbQueryResponse {
  success: boolean;
  user?: {
    chatId: string;
    displayName?: string;
    tags: string[];
  };
  /** User's KB engagement data */
  kbData?: UserKbData;
  /** FAQ entries (if includeContent) */
  faqs?: FaqContent[];
  /** Articles (if includeContent) */
  articles?: ArticleContent[];
  error?: string;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Request to search KB content
 */
export interface KbSearchRequest {
  /** Business client tag */
  tag: string;
  /** Search query text */
  query: string;
  /** Filter by content type */
  contentType?: ContentType | 'all';
  /** Filter by category */
  category?: string;
  /** Maximum results to return */
  limit?: number;
}

/**
 * Response for KB search
 */
export interface KbSearchResponse {
  success: boolean;
  results: ContentSearchResult[];
  totalMatches: number;
  error?: string;
}

// =============================================================================
// Interaction Types
// =============================================================================

/** Type of KB interaction */
export type KbInteractionType = 'read' | 'question' | 'verify';

/**
 * Request to track KB interaction
 */
export interface KbInteractionRequest {
  /** Business client tag */
  tag: string;
  /** Content type */
  contentType: ContentType;
  /** Content identifier */
  contentId: string | number;
  /** Type of interaction */
  interactionType: KbInteractionType;
  /** User's message (for question type) */
  userMessage?: string;
  /** User satisfaction rating */
  satisfaction?: 'helpful' | 'not_helpful' | 'needs_more';
}

/**
 * Response for interaction tracking
 */
export interface KbInteractionResponse {
  success: boolean;
  /** Updated module progress */
  moduleProgress?: KbModuleProgress;
  error?: string;
}

// =============================================================================
// Question Types
// =============================================================================

/**
 * Request to ask a KB question
 */
export interface KbAskRequest {
  /** Business client tag */
  tag: string;
  /** User's WhatsApp chat ID */
  chatId: string;
  /** User's question */
  question: string;
  /** Previous content ID for context */
  previousContentId?: string | number;
}

/**
 * Response for KB question
 */
export interface KbAskResponse {
  success: boolean;
  /** Generated answer */
  answer?: string;
  /** Matched FAQ/articles */
  matchedContent?: ContentSearchResult[];
  /** Whether verification is suggested */
  verificationSuggested?: boolean;
  error?: string;
}

// =============================================================================
// Verification Types
// =============================================================================

/**
 * Request to verify comprehension
 */
export interface KbVerificationRequest {
  /** Business client tag */
  tag: string;
  /** Content being verified */
  contentId: string | number;
  /** User's statement demonstrating understanding */
  userStatement: string;
}

/**
 * Response for verification
 */
export interface KbVerificationResponse {
  success: boolean;
  /** Verification result */
  result?: VerificationResult;
  /** Related content to explore next */
  relatedContent?: ContentSearchResult[];
  error?: string;
}

// =============================================================================
// Admin Types
// =============================================================================

/**
 * Summary of a user's KB engagement (for admin dashboards)
 */
export interface KbUserSummary {
  chatId: string;
  displayName?: string;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Verification rate (0-100) */
  verificationRate: number;
  /** Total questions asked */
  totalQuestions: number;
  /** Last activity timestamp (ISO) */
  lastActivityAt: string;
}

/**
 * Response listing KB users
 */
export interface KbUsersResponse {
  success: boolean;
  tag: string;
  users: KbUserSummary[];
  totalUsers: number;
  error?: string;
}
