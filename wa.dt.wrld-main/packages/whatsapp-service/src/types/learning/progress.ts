/**
 * Learning Progress Types
 *
 * Tracks user progress through learning content per tag.
 * Multi-tenant: each user can have progress in multiple tag contexts.
 */

/** Progress status for a module */
export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

/** Response quality rating for feedback signals */
export type ResponseQuality = 'helpful' | 'partial' | 'unhelpful' | 'incorrect';

/** Knowledge level inferred from interactions */
export type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A single attempt at a module section or quiz
 *
 * Tracks timing and outcome for difficulty calibration.
 */
export interface ModuleAttempt {
  /** Section or quiz identifier */
  sectionId: string;
  /** When the attempt started */
  startedAt: string;
  /** When the attempt completed (null if abandoned) */
  completedAt: string | null;
  /** Duration in seconds */
  durationSeconds: number;
  /** Whether the attempt was successful */
  success: boolean;
  /** Score if applicable (0-100) */
  score?: number;
  /** Number of hints used */
  hintsUsed?: number;
  /** Whether user asked for help during attempt */
  askedForHelp?: boolean;
}

/**
 * A question asked during a learning module
 *
 * Tracks question quality and follow-up patterns for engagement analysis.
 * Note: This is different from KbQuestion in knowledgebase/questions.ts
 * which tracks questions for knowledge base content verification.
 */
export interface LearningQuestion {
  /** Question identifier */
  id: string;
  /** The question text */
  question: string;
  /** When the question was asked */
  askedAt: string;
  /** Module context where question was asked */
  moduleId?: string | number;
  /** Section context */
  sectionId?: string;
  /** Quality rating of the response provided */
  responseQuality?: ResponseQuality;
  /** Number of follow-up questions in this thread */
  followUpCount: number;
  /** Whether this question was asked before */
  wasRepeated: boolean;
  /** Tags/topics related to this question */
  relatedTopics?: string[];
}

/**
 * Progress for a single module
 *
 * Tracks completion status and sections completed.
 */
export interface ModuleProgress {
  /** Module identifier (value from schema.moduleField) */
  moduleId: string | number;
  /** Module display name */
  moduleName?: string;
  /** Completion status */
  status: ModuleStatus;
  /** List of completed section titles */
  completedSections: string[];
  /** Total sections in module (for percentage calc) */
  totalSections?: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Last accessed timestamp (ISO) */
  lastAccessedAt?: string;
  /** Completion timestamp (ISO) */
  completedAt?: string;
  /** Additional metadata (flexible) */
  metadata?: Record<string, unknown>;

  // === Feedback Signal Fields ===
  /** History of attempts for this module */
  attempts?: ModuleAttempt[];
  /** Calculated difficulty score based on attempts (0-1, higher = harder for user) */
  difficultyScore?: number;
  /** Engagement score based on time spent and interactions (0-1) */
  engagementScore?: number;
  /** Confidence in mastery assessment (0-1, based on attempt consistency) */
  masteryConfidence?: number;
  /** Average time per section in seconds */
  avgTimePerSection?: number;
  /** Feedback questions asked within this module (for analytics) */
  feedbackQuestions?: LearningQuestion[];
}

/**
 * Per-tag learning data for a user
 *
 * Stores all learning progress for a user within a specific tag/program.
 */
export interface UserLearningData {
  /** Tag this data belongs to */
  tag: string;
  /** Reference to content collection */
  sourceCollection: {
    url: string;
    collectionName: string;
  };
  /** Progress per module (keyed by moduleId as string) */
  moduleProgress: Record<string, ModuleProgress>;
  /** Current active module */
  currentModuleId?: string | number;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Total interactions with this content */
  totalInteractions: number;
  /** Topics/sections the user has discussed */
  engagedTopics: string[];
  /** Inferred knowledge level */
  inferredLevel?: KnowledgeLevel;
  /** Last activity timestamp (ISO) */
  lastActivityAt: string;
  /** Additional context (flexible) */
  context?: Record<string, unknown>;
  /** Created timestamp (ISO) */
  createdAt: string;
  /** Updated timestamp (ISO) */
  updatedAt: string;

  // === Aggregated Feedback Signals ===
  /** Average difficulty across all modules (0-1) */
  avgDifficulty?: number;
  /** Overall engagement score (0-1) */
  overallEngagement?: number;
  /** Total questions asked across all modules */
  totalQuestionsAsked?: number;
  /** Repeat question rate (0-1, higher = more confusion) */
  repeatQuestionRate?: number;
  /** Average session duration in seconds */
  avgSessionDuration?: number;
  /** Learning velocity (sections per hour) */
  learningVelocity?: number;
}
