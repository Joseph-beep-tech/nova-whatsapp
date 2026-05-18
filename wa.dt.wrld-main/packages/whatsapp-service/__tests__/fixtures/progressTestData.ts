/**
 * Test fixtures for Learning Progress API
 *
 * Provides sample data for testing progress routes and services,
 * including edge cases like missing tags, unconfigured LMS, etc.
 */

import { TagConfiguration } from '../../src/types/routing';
import { UserLearningData, ModuleProgress } from '../../src/types/learning/progress';
import { LmsConfiguration } from '../../src/types/content/lms';
import { ModuleStructure } from '../../src/types/content/module';
import { UserResponse } from '../../src/utils/stateManager';

// =============================================================================
// User Test Data
// =============================================================================

/**
 * User enrolled in SOMO tag
 */
export const somoUser: UserResponse = {
  identifier: '254722833440',
  platform: 'c.us' as const,
  name: 'Test User',
  pushname: 'TestPushname',
  tags: ['SOMO'],
  welcomedTags: ['SOMO'],
  firstContactAt: '2026-01-01T00:00:00.000Z',
  lastContactAt: '2026-01-29T12:00:00.000Z',
  messageCount: 10,
};

/**
 * User with multiple tags
 */
export const multiTagUser: UserResponse = {
  identifier: '254711222333',
  platform: 'c.us' as const,
  name: 'Multi Tag User',
  pushname: 'MultiUser',
  tags: ['SOMO', 'VIP', 'BETA'],
  welcomedTags: ['SOMO'],
  firstContactAt: '2026-01-15T00:00:00.000Z',
  lastContactAt: '2026-01-29T14:00:00.000Z',
  messageCount: 25,
};

/**
 * User without SOMO tag
 */
export const nonSomoUser: UserResponse = {
  identifier: '254700000000',
  platform: 'c.us' as const,
  name: 'Other User',
  pushname: 'OtherPush',
  tags: ['OTHER_TAG'],
  welcomedTags: [],
  firstContactAt: '2026-01-20T00:00:00.000Z',
  lastContactAt: '2026-01-29T10:00:00.000Z',
  messageCount: 5,
};

/**
 * User with no tags
 */
export const noTagUser: UserResponse = {
  identifier: '254733444555',
  platform: 'c.us' as const,
  tags: [],
  welcomedTags: [],
  firstContactAt: '2026-01-25T00:00:00.000Z',
  lastContactAt: '2026-01-29T08:00:00.000Z',
  messageCount: 1,
};

// =============================================================================
// LMS Configuration Test Data
// =============================================================================

/**
 * Valid LMS configuration for SOMO
 */
export const somoLmsConfig: LmsConfiguration = {
  enabled: true,
  programName: 'SOMO Financial Literacy',
  contentCollection: {
    url: 'https://qd.dater.world',
    apiKey: 'test-api-key',
    collectionName: 'somo-lms',
  },
  schema: {
    moduleField: 'module_number',
    moduleNameField: 'module_name',
    sectionField: 'section_title',
    contentField: 'text',
    orderField: 'chunk_index',
  },
  autoDetect: true,
  detectionThreshold: 0.7,
};

/**
 * Valid tag configuration with LMS enabled
 */
export const somoTagConfig: TagConfiguration = {
  tag: 'SOMO',
  displayName: 'SOMO Program',
  enabled: true,
  lms: somoLmsConfig,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-29T00:00:00.000Z',
};

/**
 * Tag configuration with LMS disabled
 */
export const lmsDisabledTagConfig: TagConfiguration = {
  tag: 'NO_LMS',
  displayName: 'No LMS Tag',
  enabled: true,
  lms: {
    enabled: false,
    programName: 'Disabled',
    contentCollection: {
      url: '',
      collectionName: '',
    },
    schema: {
      moduleField: '',
      sectionField: '',
      contentField: '',
    },
  },
};

/**
 * Tag configuration without LMS field
 */
export const noLmsTagConfig: TagConfiguration = {
  tag: 'BASIC',
  displayName: 'Basic Tag',
  enabled: true,
  // No lms field
};

// =============================================================================
// Module Structure Test Data
// =============================================================================

/**
 * Sample module structure from Qdrant
 */
export const sampleModuleStructure: ModuleStructure[] = [
  {
    moduleId: 1,
    moduleName: 'Introduction to Financial Literacy',
    sections: ['What is Financial Literacy', 'Why It Matters', 'Getting Started'],
    totalChunks: 15,
    order: 1,
  },
  {
    moduleId: 2,
    moduleName: 'Budgeting Basics',
    sections: ['Creating a Budget', 'Tracking Expenses', 'Budget Review'],
    totalChunks: 20,
    order: 2,
  },
  {
    moduleId: 3,
    moduleName: 'Saving Strategies',
    sections: ['Emergency Fund', 'Goal-Based Savings', 'Investment Options'],
    totalChunks: 18,
    order: 3,
  },
];

/**
 * Empty module structure
 */
export const emptyModuleStructure: ModuleStructure[] = [];

// =============================================================================
// Learning Progress Test Data
// =============================================================================

/**
 * Sample module progress
 */
export const moduleProgress: Record<string, ModuleProgress> = {
  '1': {
    moduleId: 1,
    moduleName: 'Introduction to Financial Literacy',
    status: 'completed',
    completedSections: ['What is Financial Literacy', 'Why It Matters', 'Getting Started'],
    totalSections: 3,
    progressPercent: 100,
    lastAccessedAt: '2026-01-25T10:00:00.000Z',
    completedAt: '2026-01-25T12:00:00.000Z',
  },
  '2': {
    moduleId: 2,
    moduleName: 'Budgeting Basics',
    status: 'in_progress',
    completedSections: ['Creating a Budget'],
    totalSections: 3,
    progressPercent: 33,
    lastAccessedAt: '2026-01-29T14:00:00.000Z',
  },
};

/**
 * Complete user learning data
 */
export const somoLearningData: UserLearningData = {
  tag: 'SOMO',
  sourceCollection: {
    url: 'https://qd.dater.world',
    collectionName: 'somo-lms',
  },
  moduleProgress,
  currentModuleId: 2,
  overallProgress: 45,
  totalInteractions: 25,
  engagedTopics: ['What is Financial Literacy', 'Creating a Budget', 'Tracking Expenses'],
  inferredLevel: 'beginner',
  lastActivityAt: '2026-01-29T14:00:00.000Z',
  context: {
    lastQuestion: 'How do I track my expenses?',
  },
  createdAt: '2026-01-20T00:00:00.000Z',
  updatedAt: '2026-01-29T14:00:00.000Z',
};

/**
 * Empty/initial learning data
 */
export const emptyLearningData: UserLearningData = {
  tag: 'SOMO',
  sourceCollection: {
    url: 'https://qd.dater.world',
    collectionName: 'somo-lms',
  },
  moduleProgress: {},
  overallProgress: 0,
  totalInteractions: 0,
  engagedTopics: [],
  lastActivityAt: '2026-01-29T00:00:00.000Z',
  createdAt: '2026-01-29T00:00:00.000Z',
  updatedAt: '2026-01-29T00:00:00.000Z',
};

// =============================================================================
// API Request/Response Test Data
// =============================================================================

/**
 * Valid progress query request
 */
export const validProgressRequest = {
  identifier: '254722833440',
  tag: 'SOMO',
  includeModuleStructure: true,
  includeHistory: false,
};

/**
 * Progress update request - section completed
 */
export const sectionCompletedRequest = {
  tag: 'SOMO',
  moduleId: 2,
  sectionCompleted: 'Tracking Expenses',
};

/**
 * Progress update request - module completed
 */
export const moduleCompletedRequest = {
  tag: 'SOMO',
  moduleId: 2,
  moduleCompleted: true,
};

/**
 * Progress update request - set current module
 */
export const setCurrentModuleRequest = {
  tag: 'SOMO',
  setCurrentModule: 3,
};

/**
 * Progress update request with metadata
 */
export const updateWithMetadataRequest = {
  tag: 'SOMO',
  moduleId: 2,
  metadata: {
    quizScore: 85,
    attemptCount: 1,
  },
  context: {
    lastQuestion: 'What are fixed expenses?',
  },
};

// =============================================================================
// Edge Case Test Data
// =============================================================================

/**
 * Request with missing tag
 */
export const missingTagRequest = {
  identifier: '254722833440',
  // No tag field
};

/**
 * Request with invalid identifier format
 */
export const invalidIdentifierRequest = {
  identifier: 'invalid-format',
  tag: 'SOMO',
};

/**
 * Empty update request body
 */
export const emptyUpdateRequest = {};

/**
 * Update request with only tag
 */
export const tagOnlyUpdateRequest = {
  tag: 'SOMO',
};
