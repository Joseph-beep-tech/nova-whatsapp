/**
 * LLM Types
 *
 * Type definitions for the LLM conversational system.
 * Used by llmService for intent detection, menu generation, and responses.
 */

/** User intents detectable by the LLM */
export type UserIntent =
  | 'tag_interest'    // User is asking about or wants to join a specific tag
  | 'help'            // User wants guidance on what they can do
  | 'greeting'        // Simple greeting (hi, hello, etc.)
  | 'question'        // General question (not tag-specific)
  | 'unknown';        // Could not classify

/** Result of LLM intent detection */
export interface IntentDetectionResult {
  /** Detected intent */
  intent: UserIntent;
  /** Tag the user is interested in (if intent is tag_interest) */
  tag?: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Brief reasoning from the LLM */
  reasoning?: string;
}

/** Input for generating a welcome message */
export interface WelcomeGenerationInput {
  /** Available tags with their display names */
  availableTags: Array<{ tag: string; displayName?: string }>;
}

/** Input for generating dynamic help */
export interface HelpGenerationInput {
  /** User's current tags */
  userTags: string[];
  /** Available commands */
  commands: Array<{ keyword: string; description: string }>;
  /** Tag display names */
  tagDisplayNames: Record<string, string>;
}

/** LLM completion result */
export interface LlmCompletionResult {
  /** Generated text */
  text: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Token usage */
  tokensUsed?: number;
  /** Generation time in ms */
  durationMs: number;
}
