/**
 * Knowledgebase Question & Verification Types
 *
 * Tracks user questions about KB content and verification of understanding.
 * Supports the "read -> question -> answer" verification flow.
 */

/** User satisfaction rating for a KB interaction */
export type KbSatisfaction = 'helpful' | 'not_helpful' | 'needs_more';

/**
 * A question asked by user about KB content
 *
 * Tracks follow-up questions for verification flow.
 */
export interface KbQuestion {
  /** Unique question ID */
  id: string;
  /** Timestamp (ISO) */
  timestamp: string;
  /** User's question text */
  question: string;
  /** Whether the question was answered */
  answered: boolean;
  /** Related content IDs matched via semantic search */
  matchedContentIds?: (string | number)[];
  /** User satisfaction (if collected) */
  satisfaction?: KbSatisfaction;
}

/**
 * Result of comprehension verification
 *
 * When user demonstrates understanding of KB content.
 */
export interface VerificationResult {
  /** Whether user's response shows understanding */
  demonstratesUnderstanding: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Clarification provided if understanding was incomplete */
  clarification?: string;
  /** Timestamp of verification */
  verifiedAt: string;
  /** The user statement that was evaluated */
  userStatement: string;
}
