/**
 * Learning API Request/Response Types
 *
 * Types for the progress API endpoints.
 */

import { UserLearningData } from './progress';
import { LearningInteraction } from './interaction';
import { ModuleStructure } from '../content';

/**
 * Progress query request
 *
 * GET /service/progress/:chatId
 */
export interface ProgressQueryRequest {
  /** User's chat ID */
  chatId: string;
  /** Tag/business client (required) */
  tag: string;
  /** Include full module structure from content collection */
  includeModuleStructure?: boolean;
  /** Include recent interaction history */
  includeHistory?: boolean;
}

/**
 * Progress query response
 *
 * Response from GET /service/progress/:chatId
 */
export interface ProgressResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** User info */
  user?: {
    chatId: string;
    displayName?: string;
    tags: string[];
  };
  /** Learning data for requested tag */
  learning?: UserLearningData;
  /** Module structure from content collection (if requested) */
  moduleStructure?: ModuleStructure[];
  /** Recent interactions (if requested) */
  history?: LearningInteraction[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Progress update request
 *
 * POST /service/progress/:chatId
 */
export interface ProgressUpdateRequest {
  /** Tag/business client (required) */
  tag: string;
  /** Module to update */
  moduleId?: string | number;
  /** Section to mark as completed */
  sectionCompleted?: string;
  /** Mark entire module as completed */
  moduleCompleted?: boolean;
  /** Update current module */
  setCurrentModule?: string | number;
  /** Additional metadata to merge */
  metadata?: Record<string, unknown>;
  /** Additional context to merge */
  context?: Record<string, unknown>;
}

/**
 * Module structure response
 *
 * Response from GET /service/progress/modules
 */
export interface ModuleStructureResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** Tag this structure belongs to */
  tag?: string;
  /** Program name */
  programName?: string;
  /** Module structure */
  modules?: ModuleStructure[];
  /** Total number of modules */
  totalModules?: number;
  /** Error message (if failed) */
  error?: string;
}
