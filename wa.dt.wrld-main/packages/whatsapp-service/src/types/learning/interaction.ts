/**
 * Learning Interaction Types
 *
 * Tracks user interactions with learning content.
 */

/** Type of learning interaction */
export type InteractionType = 'question' | 'discussion' | 'completion' | 'review';

/**
 * A single learning interaction
 *
 * Records when a user interacts with learning content.
 */
export interface LearningInteraction {
  /** Unique interaction ID */
  id: string;
  /** Timestamp (ISO) */
  timestamp: string;
  /** Module the interaction relates to */
  moduleId: string | number;
  /** Section/topic title */
  sectionTitle: string;
  /** Type of interaction */
  interactionType: InteractionType;
  /** User's message (if applicable) */
  userMessage?: string;
  /** Relevance score from semantic matching */
  relevanceScore?: number;
}

/**
 * Topic engagement metrics
 *
 * Aggregated engagement data for a topic.
 */
export interface TopicEngagement {
  /** Topic/section title */
  topic: string;
  /** Number of interactions */
  interactionCount: number;
  /** Last interaction timestamp (ISO) */
  lastInteractionAt: string;
  /** Average relevance score across interactions */
  averageRelevance: number;
}

/**
 * Learning context from conversation history
 *
 * Context data attached to messages in whatsapp-qdrant.
 */
export interface MessageLearningContext {
  /** Module number/ID the message relates to */
  moduleId?: string | number;
  /** Section title */
  sectionTitle?: string;
  /** Source collection name */
  sourceCollection?: string;
  /** Type of content interaction */
  contentType?: 'question' | 'answer' | 'discussion';
  /** Keywords extracted from topic */
  topicKeywords?: string[];
}
