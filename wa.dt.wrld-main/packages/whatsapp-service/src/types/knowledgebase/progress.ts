/**
 * Knowledgebase Progress Types
 *
 * Extends learning progress types with KB-specific verification flow.
 * Inherits from learning/progress.ts to maintain consistent terminology.
 */

import { ModuleProgress, ModuleStatus, UserLearningData, KnowledgeLevel } from '../learning/progress';
import { KbQuestion } from './questions';
import { ContentType } from './content';

// =============================================================================
// Status Types
// =============================================================================

/**
 * Extended module status for KB content
 *
 * Adds 'questioned' and 'verified' states to the learning flow:
 * not_started -> in_progress -> questioned -> verified -> completed
 */
export type KbModuleStatus = ModuleStatus | 'questioned' | 'verified';

// =============================================================================
// Progress Types
// =============================================================================

/**
 * KB module progress (extends ModuleProgress)
 *
 * Adds verification-specific fields to track the read -> question -> answer flow.
 */
export interface KbModuleProgress extends Omit<ModuleProgress, 'status'> {
  /** Extended status with verification states */
  status: KbModuleStatus;

  // KB-specific extensions
  /** Content type (faq, article, or module) */
  contentType: ContentType;
  /** Number of times this content was accessed */
  accessCount: number;
  /** Follow-up questions asked about this content */
  questions: KbQuestion[];
  /** When understanding was verified (ISO timestamp) */
  verifiedAt?: string;
}

/**
 * Per-tag KB data (extends UserLearningData)
 *
 * Adds KB-specific tracking for questions and verification rate.
 */
export interface UserKbData extends Omit<UserLearningData, 'moduleProgress'> {
  /** Progress per module (keyed by moduleId as string) */
  moduleProgress: Record<string, KbModuleProgress>;

  // KB-specific extensions
  /** All questions asked across modules */
  questionHistory: KbQuestion[];
  /** Percentage of content with verified understanding (0-100) */
  verificationRate: number;
}

// =============================================================================
// Re-export base types for convenience
// =============================================================================

export { KnowledgeLevel };
export type { ModuleProgress, ModuleStatus, UserLearningData };
