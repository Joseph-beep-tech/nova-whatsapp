/**
 * Knowledgebase Types
 *
 * Re-exports all KB types for convenient importing.
 *
 * @example
 * import { RagContent, ContentSearchResult, UserKbData } from '../types/knowledgebase';
 */

// Base content types (reusable for all RAG content)
export {
  ContentType,
  RagContent,
  ContentSearchResult,
  ContentSection,
  // Content-type extensions
  FaqContent,
  ArticleContent,
  // Factory helpers
  createFaq,
  createArticle,
} from './content';

// Progress types (extend learning types)
export {
  KbModuleStatus,
  KbModuleProgress,
  UserKbData,
  // Re-exported from learning
  KnowledgeLevel,
  type ModuleProgress,
  type ModuleStatus,
  type UserLearningData,
} from './progress';

// Question & verification types
export {
  KbSatisfaction,
  KbQuestion,
  VerificationResult,
} from './questions';

// Configuration types
export {
  KbSchemaMapping,
  KbCollectionConfig,
  KbConfiguration,
} from './config';

// API types
export {
  KbQueryRequest,
  KbQueryResponse,
  KbSearchRequest,
  KbSearchResponse,
  KbInteractionType,
  KbInteractionRequest,
  KbInteractionResponse,
  KbAskRequest,
  KbAskResponse,
  KbVerificationRequest,
  KbVerificationResponse,
  KbUserSummary,
  KbUsersResponse,
} from './api';
