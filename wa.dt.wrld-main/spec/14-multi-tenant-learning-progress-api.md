# Spec: Multi-Tenant Learning Progress API

**Date:** 2026-01-29
**Status:** Draft
**Package:** `packages/whatsapp-service`

## Overview

Create a **generalized, multi-tenant learning progress API** that supports multiple business clients (tags), each with their own:
- **Collection** (content in Qdrant)
- **Modules** (learning units)
- **Topics** (nested within modules)

The system is data-layer abstracted - tags, collections, and schema mappings are inputs to the API, not hardcoded.

## Multi-Tenant Architecture

```
                     Business Clients (Tags)
                    /           |           \
                SOMO        CompanyX       OrgY
                  |             |            |
            [somo-lms]   [companyx-lms]  [orgy-lms]
                  |             |            |
            ├─Module 1    ├─Module 1    ├─Course 1
            │  └─Topics   │  └─Lessons  │  └─Chapters
            └─Module 2    └─Module 2    └─Course 2

         Each business client defines their own:
         - Content collection URL & name
         - Schema mapping (module/topic field names)
         - Progress tracking structure
```

## Design Principles

1. **Tag = Business Client** - Each tag (SOMO, CompanyX) is a tenant
2. **Configuration-driven** - Schema mappings stored in TagConfiguration
3. **Input-based routing** - Tag determines which collection to query
4. **Flexible metadata** - Progress stored with arbitrary structure per tag
5. **Per-user per-tag** - Users can have progress in multiple tag contexts

## Existing Infrastructure to Extend

| Component | Current | Extension |
|-----------|---------|-----------|
| `TagConfiguration` | Routing, memory, welcome | Add `lms` config section |
| `QdrantRagTarget` | Single Qdrant URL | Multiple external Qdrant connections |
| User model | Basic tags[] | Add `learningData` per-tag object |
| Routes | `/tags/:tag/config` | Add `/progress/:chatId` tag-aware |

## Implementation Steps

### 1. Create Content Domain Types
**File:** `packages/whatsapp-service/src/types/content/lms.ts`

```typescript
/**
 * LMS Configuration Types
 *
 * Configuration for Learning Management System integrations.
 * Supports multiple business clients with different content structures.
 */

/** Schema mapping for LMS content - different clients use different field names */
export interface LmsSchemaMapping {
  /** Field name for module identifier (e.g., 'module_number', 'course_id') */
  moduleField: string;
  /** Field name for module name/title */
  moduleNameField?: string;
  /** Field name for section/topic (e.g., 'section_title', 'lesson_name') */
  sectionField: string;
  /** Field name for content (e.g., 'text', 'content', 'body') */
  contentField: string;
  /** Field name for order/sequence (e.g., 'chunk_index', 'order') */
  orderField?: string;
  /** Nested topic field if topics are separate from sections */
  topicField?: string;
}

/** External Qdrant collection configuration */
export interface LmsCollectionConfig {
  /** Qdrant server URL (external) */
  url: string;
  /** API key for Qdrant (if required) */
  apiKey?: string;
  /** Collection name */
  collectionName: string;
  /** Vector field name (if named vectors used) */
  vectorName?: string;
}

/** LMS configuration for a tag/business client */
export interface LmsConfiguration {
  enabled: boolean;
  programName?: string;
  contentCollection: LmsCollectionConfig;
  schema: LmsSchemaMapping;
  autoDetect?: boolean;
  detectionThreshold?: number;
}
```

**File:** `packages/whatsapp-service/src/types/content/module.ts`

```typescript
/**
 * Module Structure Types
 *
 * Represents the structure of learning content modules.
 */

/** A module in the LMS content */
export interface ModuleStructure {
  moduleId: string | number;
  moduleName: string;
  sections: string[];
  totalChunks: number;
  order?: number;
}

/** Section/topic within a module */
export interface SectionInfo {
  sectionTitle: string;
  chunkCount: number;
  order?: number;
}
```

**File:** `packages/whatsapp-service/src/types/content/index.ts`

```typescript
export * from './lms';
export * from './module';
```

**File:** `packages/whatsapp-service/src/types/routing.ts` (extend)

```typescript
import { LmsConfiguration } from './content';

/** Extend TagConfiguration with LMS config */
export interface TagConfiguration {
  tag: string;
  displayName?: string;
  enabled: boolean;
  welcomeMessage?: WelcomeConfig;
  routing?: RoutingConfig;
  memory?: MemoryConfig;
  /** NEW: LMS/Learning configuration */
  lms?: LmsConfiguration;
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. Create Learning Domain Types

**File:** `packages/whatsapp-service/src/types/learning/progress.ts`

```typescript
/**
 * Learning Progress Types
 *
 * Tracks user progress through learning content per tag.
 */

/** Progress status for a module */
export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

/** Progress for a single module */
export interface ModuleProgress {
  moduleId: string | number;
  moduleName?: string;
  status: ModuleStatus;
  completedSections: string[];
  totalSections?: number;
  progressPercent: number;
  lastAccessedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

/** Per-tag learning data for a user */
export interface UserLearningData {
  tag: string;
  sourceCollection: {
    url: string;
    collectionName: string;
  };
  moduleProgress: Record<string, ModuleProgress>;
  currentModuleId?: string | number;
  overallProgress: number;
  totalInteractions: number;
  engagedTopics: string[];
  inferredLevel?: 'beginner' | 'intermediate' | 'advanced';
  lastActivityAt: string;
  context?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

**File:** `packages/whatsapp-service/src/types/learning/interaction.ts`

```typescript
/**
 * Learning Interaction Types
 *
 * Tracks user interactions with learning content.
 */

export type InteractionType = 'question' | 'discussion' | 'completion' | 'review';

export interface LearningInteraction {
  id: string;
  timestamp: string;
  moduleId: string | number;
  sectionTitle: string;
  interactionType: InteractionType;
  userMessage?: string;
  relevanceScore?: number;
}

export interface TopicEngagement {
  topic: string;
  interactionCount: number;
  lastInteractionAt: string;
  averageRelevance: number;
}
```

**File:** `packages/whatsapp-service/src/types/learning/api.ts`

```typescript
/**
 * Learning API Request/Response Types
 */

import { UserLearningData } from './progress';
import { LearningInteraction } from './interaction';
import { ModuleStructure } from '../content';

/** Progress query request */
export interface ProgressQueryRequest {
  chatId: string;
  tag: string;
  includeModuleStructure?: boolean;
  includeHistory?: boolean;
}

/** Progress query response */
export interface ProgressResponse {
  success: boolean;
  user?: {
    chatId: string;
    displayName?: string;
    tags: string[];
  };
  learning?: UserLearningData;
  moduleStructure?: ModuleStructure[];
  history?: LearningInteraction[];
  error?: string;
}

/** Progress update request */
export interface ProgressUpdateRequest {
  tag: string;
  moduleId?: string | number;
  sectionCompleted?: string;
  moduleCompleted?: boolean;
  setCurrentModule?: string | number;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
}
```

**File:** `packages/whatsapp-service/src/types/learning/index.ts`

```typescript
export * from './progress';
export * from './interaction';
export * from './api';
```

### 3. Extend User Model with Per-Tag Learning Data
**File:** `packages/whatsapp-service/src/utils/stateManager.ts`

Extend the User schema:

```typescript
// Extend IUser interface
interface IUser extends Document {
  chatId: string;
  phoneNumber: string;
  name?: string;
  pushname?: string;
  tags: string[];
  welcomedTags: string[];
  firstContactAt: Date;
  lastContactAt: Date;
  messageCount: number;

  /** NEW: Per-tag learning data */
  learningData?: Map<string, {
    sourceCollection: {
      url: string;
      collectionName: string;
    };
    moduleProgress: Record<string, {
      moduleId: string | number;
      moduleName?: string;
      status: string;
      completedSections: string[];
      totalSections?: number;
      progressPercent: number;
      lastAccessedAt?: Date;
      completedAt?: Date;
      metadata?: Record<string, unknown>;
    }>;
    currentModuleId?: string | number;
    overallProgress: number;
    totalInteractions: number;
    engagedTopics: string[];
    inferredLevel?: string;
    lastActivityAt: Date;
    context?: Record<string, unknown>;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

// Add new methods
class StateManager {
  // ... existing methods ...

  /**
   * Get learning data for a user and tag
   */
  async getLearningData(chatId: string, tag: string): Promise<UserLearningData | null>;

  /**
   * Initialize learning data for a user and tag
   * Uses TagConfiguration.lms to set up structure
   */
  async initializeLearningData(chatId: string, tagConfig: TagConfiguration): Promise<UserLearningData>;

  /**
   * Update learning progress for a user and tag
   */
  async updateLearningProgress(
    chatId: string,
    tag: string,
    update: {
      moduleId?: string | number;
      sectionCompleted?: string;
      moduleCompleted?: boolean;
      currentModuleId?: string | number;
      metadata?: Record<string, unknown>;
      context?: Record<string, unknown>;
    }
  ): Promise<UserLearningData | null>;

  /**
   * Track a learning interaction
   */
  async trackLearningInteraction(
    chatId: string,
    tag: string,
    moduleId: string | number,
    sectionTitle: string
  ): Promise<void>;
}
```

### 4. Create Content Domain Services
**File:** `packages/whatsapp-service/src/services/content/lmsCollectionClient.ts`

A factory-based client that connects to any Qdrant collection based on tag config:

```typescript
/**
 * LMS Collection Client Factory
 *
 * Creates Qdrant clients for external LMS content collections
 * based on TagConfiguration.lms settings.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { LmsConfiguration, LmsSchemaMapping } from '../../types/content';
import { ModuleStructure } from '../../types/content';

class LmsCollectionClient {
  private client: QdrantClient;
  private config: LmsConfiguration;
  private schema: LmsSchemaMapping;
  private moduleCache: ModuleStructure[] | null = null;

  constructor(lmsConfig: LmsConfiguration) {
    this.config = lmsConfig;
    this.schema = lmsConfig.schema;
    this.client = new QdrantClient({
      url: lmsConfig.contentCollection.url,
      apiKey: lmsConfig.contentCollection.apiKey || undefined,
    });
  }

  /**
   * Get module structure using configured schema mapping
   */
  async getModuleStructure(): Promise<ModuleStructure[]> {
    if (this.moduleCache) return this.moduleCache;

    // Scroll collection and group by schema.moduleField
    const points = await this.scrollAll();

    const modules = new Map<string | number, ModuleStructure>();
    for (const point of points) {
      const payload = point.payload as Record<string, unknown>;
      const moduleId = payload[this.schema.moduleField] as string | number;
      const sectionTitle = payload[this.schema.sectionField] as string;

      if (!modules.has(moduleId)) {
        modules.set(moduleId, {
          moduleId,
          moduleName: String(payload[this.schema.moduleNameField || this.schema.moduleField]),
          sections: [],
          totalChunks: 0,
        });
      }

      const mod = modules.get(moduleId)!;
      mod.totalChunks++;
      if (!mod.sections.includes(sectionTitle)) {
        mod.sections.push(sectionTitle);
      }
    }

    this.moduleCache = Array.from(modules.values()).sort((a, b) =>
      String(a.moduleId).localeCompare(String(b.moduleId))
    );

    return this.moduleCache;
  }

  /**
   * Search content using configured schema
   */
  async searchContent(embedding: number[], limit: number = 5) {
    const results = await this.client.search(
      this.config.contentCollection.collectionName,
      {
        vector: this.config.contentCollection.vectorName
          ? { name: this.config.contentCollection.vectorName, vector: embedding }
          : embedding,
        limit,
        with_payload: true,
      }
    );

    return results.map(r => {
      const payload = r.payload as Record<string, unknown>;
      return {
        moduleId: payload[this.schema.moduleField] as string | number,
        sectionTitle: payload[this.schema.sectionField] as string,
        content: payload[this.schema.contentField] as string,
        score: r.score,
        payload,
      };
    });
  }

  private async scrollAll() {
    const allPoints: Array<{ payload: Record<string, unknown> }> = [];
    let offset: string | number | null = null;

    do {
      const result = await this.client.scroll(this.config.contentCollection.collectionName, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset ?? undefined,
      });

      allPoints.push(...(result.points as Array<{ payload: Record<string, unknown> }>));
      offset = result.next_page_offset ?? null;
    } while (offset !== null);

    return allPoints;
  }
}

/**
 * Factory to create/cache LMS clients per tag
 */
class LmsCollectionClientFactory {
  private clients: Map<string, LmsCollectionClient> = new Map();

  getClient(tag: string, lmsConfig: LmsConfiguration): LmsCollectionClient {
    const key = `${tag}_${lmsConfig.contentCollection.url}_${lmsConfig.contentCollection.collectionName}`;

    if (!this.clients.has(key)) {
      this.clients.set(key, new LmsCollectionClient(lmsConfig));
    }

    return this.clients.get(key)!;
  }

  clearCache(): void {
    this.clients.clear();
  }
}

export const lmsClientFactory = new LmsCollectionClientFactory();
```

**File:** `packages/whatsapp-service/src/services/content/index.ts`

```typescript
export * from './lmsCollectionClient';
```

### 5. Create Learning Domain Services
**File:** `packages/whatsapp-service/src/services/learning/progressService.ts`

```typescript
/**
 * Progress Service
 *
 * Multi-tenant learning progress management.
 * Queries are tag-aware and schema-driven.
 */

import { stateManager } from '../../utils/stateManager';
import { lmsClientFactory } from '../content';
import { qdrantHandler } from '../qdrantHandler';
import { ProgressQueryRequest, ProgressResponse, ProgressUpdateRequest, UserLearningData } from '../../types/learning';
import { TagConfiguration } from '../../types/routing';
import { getErrorMessage } from '../../types/webhook';

class ProgressService {
  /**
   * Get learner progress for a specific tag
   */
  async getProgress(request: ProgressQueryRequest): Promise<ProgressResponse> {
    const { chatId, tag, includeModuleStructure, includeHistory } = request;

    try {
      // 1. Get user
      const user = await stateManager.getUser(chatId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // 2. Verify user has tag
      if (!user.tags.includes(tag)) {
        return { success: false, error: `User not enrolled in ${tag}` };
      }

      // 3. Get tag configuration
      const tagConfig = await stateManager.getConfig<TagConfiguration>(`tag_config_${tag}`);
      if (!tagConfig?.lms?.enabled) {
        return { success: false, error: `LMS not configured for tag: ${tag}` };
      }

      // 4. Get or initialize learning data
      let learningData = await stateManager.getLearningData(chatId, tag);
      if (!learningData) {
        learningData = await stateManager.initializeLearningData(chatId, tagConfig);
      }

      // 5. Optionally get module structure from content collection
      let moduleStructure;
      if (includeModuleStructure) {
        const client = lmsClientFactory.getClient(tag, tagConfig.lms);
        moduleStructure = await client.getModuleStructure();
      }

      // 6. Optionally get history from whatsapp-qdrant
      let history;
      if (includeHistory && qdrantHandler.isEnabled()) {
        const conversations = await qdrantHandler.getConversationHistory(tag, chatId, 10);
        history = conversations
          .filter(c => c.metadata?.learningContext)
          .map(c => ({
            id: c.id,
            timestamp: c.timestamp,
            moduleId: (c.metadata?.learningContext as Record<string, unknown>)?.moduleId as string | number,
            sectionTitle: (c.metadata?.learningContext as Record<string, unknown>)?.sectionTitle as string,
            interactionType: ((c.metadata?.learningContext as Record<string, unknown>)?.interactionType as string) || 'discussion',
          }));
      }

      return {
        success: true,
        user: {
          chatId: user.chatId,
          displayName: user.pushname || user.name,
          tags: user.tags,
        },
        learning: learningData,
        moduleStructure,
        history,
      };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Update progress for a user and tag
   */
  async updateProgress(chatId: string, request: ProgressUpdateRequest): Promise<ProgressResponse> {
    const { tag, moduleId, sectionCompleted, moduleCompleted, setCurrentModule, metadata, context } = request;

    try {
      // Get tag config
      const tagConfig = await stateManager.getConfig<TagConfiguration>(`tag_config_${tag}`);
      if (!tagConfig?.lms?.enabled) {
        return { success: false, error: `LMS not configured for tag: ${tag}` };
      }

      // Update progress
      const learningData = await stateManager.updateLearningProgress(chatId, tag, {
        moduleId,
        sectionCompleted,
        moduleCompleted,
        currentModuleId: setCurrentModule,
        metadata,
        context,
      });

      if (!learningData) {
        return { success: false, error: 'Failed to update progress' };
      }

      return {
        success: true,
        learning: learningData,
      };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Auto-detect learning topic from message and update progress
   */
  async detectAndTrackLearning(
    chatId: string,
    tag: string,
    message: string,
    embedding: number[]
  ): Promise<void> {
    const tagConfig = await stateManager.getConfig<TagConfiguration>(`tag_config_${tag}`);
    if (!tagConfig?.lms?.enabled || !tagConfig.lms.autoDetect) {
      return;
    }

    const client = lmsClientFactory.getClient(tag, tagConfig.lms);
    const matches = await client.searchContent(embedding, 3);

    const threshold = tagConfig.lms.detectionThreshold || 0.7;
    if (matches.length > 0 && matches[0].score >= threshold) {
      const topMatch = matches[0];
      await stateManager.trackLearningInteraction(
        chatId,
        tag,
        topMatch.moduleId,
        topMatch.sectionTitle
      );
    }
  }
}

export const progressService = new ProgressService();
```

**File:** `packages/whatsapp-service/src/services/learning/index.ts`

```typescript
export * from './progressService';
```

### 6. Create Progress Routes (Tag-Aware)
**File:** `packages/whatsapp-service/src/routes/progress.ts`

```typescript
/**
 * Progress Routes
 *
 * Multi-tenant learning progress API.
 * All endpoints require `tag` parameter.
 */

import { Router, Request, Response } from 'express';
import { progressService } from '../services/learning';
import { lmsClientFactory } from '../services/content';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { TagConfiguration } from '../types/routing';
import { ProgressUpdateRequest } from '../types/learning';

const router = Router();

/**
 * Get learner progress
 * GET /progress/:chatId?tag=SOMO&includeModuleStructure=true&includeHistory=true
 */
router.get('/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { tag, includeModuleStructure, includeHistory } = req.query;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'tag query parameter is required',
      });
    }

    const result = await progressService.getProgress({
      chatId,
      tag,
      includeModuleStructure: includeModuleStructure === 'true',
      includeHistory: includeHistory === 'true',
    });

    const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 400);
    return res.status(status).json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Update learner progress
 * POST /progress/:chatId
 * Body: { tag, moduleId?, sectionCompleted?, moduleCompleted?, metadata?, context? }
 */
router.post('/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const update = req.body as ProgressUpdateRequest;

    if (!update.tag) {
      return res.status(400).json({
        success: false,
        error: 'tag is required in request body',
      });
    }

    const result = await progressService.updateProgress(chatId, update);
    const status = result.success ? 200 : 400;
    return res.status(status).json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get module structure for a tag
 * GET /progress/modules?tag=SOMO
 */
router.get('/modules', async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'tag query parameter is required',
      });
    }

    const tagConfig = await stateManager.getConfig<TagConfiguration>(`tag_config_${tag}`);
    if (!tagConfig?.lms?.enabled) {
      return res.status(400).json({
        success: false,
        error: `LMS not configured for tag: ${tag}`,
      });
    }

    const client = lmsClientFactory.getClient(tag, tagConfig.lms);
    const modules = await client.getModuleStructure();

    return res.json({
      success: true,
      tag,
      programName: tagConfig.lms.programName,
      modules,
      totalModules: modules.length,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export default router;
```

## File Organization

### Domain-Organized Type Structure

```
packages/whatsapp-service/src/
├── types/
│   ├── routing.ts          # Existing routing types (extend)
│   ├── webhook.ts          # Existing webhook types
│   ├── memory.ts           # Existing Qdrant memory types
│   │
│   ├── content/            # NEW: Content/LMS domain types
│   │   ├── index.ts        # Re-exports all content types
│   │   ├── lms.ts          # LmsConfiguration, LmsSchemaMapping, LmsCollectionConfig
│   │   └── module.ts       # ModuleStructure, SectionInfo
│   │
│   └── learning/           # NEW: Learning/Progress domain types
│       ├── index.ts        # Re-exports all learning types
│       ├── progress.ts     # UserLearningData, ModuleProgress
│       ├── interaction.ts  # LearningInteraction, TopicEngagement
│       └── api.ts          # ProgressQueryRequest, ProgressResponse, ProgressUpdateRequest
│
├── services/
│   ├── content/            # NEW: Content domain services
│   │   ├── index.ts        # Re-exports
│   │   └── lmsCollectionClient.ts  # Factory + client for external Qdrant
│   │
│   └── learning/           # NEW: Learning domain services
│       ├── index.ts        # Re-exports
│       └── progressService.ts      # Main progress service
│
├── routes/
│   └── progress.ts         # Progress API routes
│
└── utils/
    └── stateManager.ts     # Extend with learning methods
```

### Files Summary

| Action | File | Purpose |
|--------|------|---------|
| **Content Domain Types** |
| Create | `src/types/content/index.ts` | Export all content types |
| Create | `src/types/content/lms.ts` | `LmsConfiguration`, `LmsSchemaMapping` |
| Create | `src/types/content/module.ts` | `ModuleStructure`, `SectionInfo` |
| **Learning Domain Types** |
| Create | `src/types/learning/index.ts` | Export all learning types |
| Create | `src/types/learning/progress.ts` | `UserLearningData`, `ModuleProgress` |
| Create | `src/types/learning/interaction.ts` | `LearningInteraction`, `TopicEngagement` |
| Create | `src/types/learning/api.ts` | Request/Response types for API |
| **Content Domain Services** |
| Create | `src/services/content/index.ts` | Export content services |
| Create | `src/services/content/lmsCollectionClient.ts` | Qdrant client factory |
| **Learning Domain Services** |
| Create | `src/services/learning/index.ts` | Export learning services |
| Create | `src/services/learning/progressService.ts` | Progress management |
| **Existing Files to Modify** |
| Modify | `src/types/routing.ts` | Add `lms?: LmsConfiguration` to TagConfiguration |
| Modify | `src/utils/stateManager.ts` | Add `learningData` to User, learning methods |
| Modify | `src/index.ts` | Mount progress routes |
| **Routes** |
| Create | `src/routes/progress.ts` | Progress API endpoints |

## API Endpoints

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/service/progress/:chatId` | `tag` (required) | Get progress for user/tag |
| POST | `/service/progress/:chatId` | Body: `{tag, ...}` | Update progress |
| GET | `/service/progress/modules` | `tag` (required) | Get module structure |

## Example: Configuring a New Business Client

```bash
# Set up LMS config for CompanyX
curl -X POST "https://wa.dater.world/service/tags/CompanyX/config" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "displayName": "CompanyX Training",
    "lms": {
      "enabled": true,
      "programName": "CompanyX Staff Training",
      "contentCollection": {
        "url": "https://their-qdrant.example.com",
        "apiKey": "their-api-key",
        "collectionName": "companyx-training"
      },
      "schema": {
        "moduleField": "course_id",
        "moduleNameField": "course_name",
        "sectionField": "lesson_title",
        "contentField": "content",
        "orderField": "sequence"
      },
      "autoDetect": true,
      "detectionThreshold": 0.75
    }
  }'
```

## Example: SOMO Configuration

```bash
curl -X POST "https://wa.dater.world/service/tags/SOMO/config" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "displayName": "SOMO LMS",
    "lms": {
      "enabled": true,
      "programName": "SOMO Financial Literacy",
      "contentCollection": {
        "url": "https://qd.dater.world",
        "apiKey": "9904389a589e2b1c1662f970078adc5d00e83827c60845346e06531cdac904da",
        "collectionName": "somo-lms",
        "vectorName": "somo-lms-content"
      },
      "schema": {
        "moduleField": "module_number",
        "sectionField": "section_title",
        "contentField": "text",
        "orderField": "chunk_index"
      },
      "autoDetect": true,
      "detectionThreshold": 0.7
    }
  }'
```

## Verification

1. **Type Check:** `npm run type-check`
2. **Unit Tests:** Test progress service with mock tag configs
3. **Integration:**
   ```bash
   # Configure SOMO with existing collection
   curl -X POST ".../tags/SOMO/config" -d '{"lms": {...}}'

   # Query progress
   curl "https://wa.dater.world/service/progress/254...@c.us?tag=SOMO"

   # Update progress
   curl -X POST "https://wa.dater.world/service/progress/254...@c.us" \
     -d '{"tag": "SOMO", "moduleId": 2, "sectionCompleted": "Budgeting Basics"}'

   # Get modules for voice bot menu
   curl "https://wa.dater.world/service/progress/modules?tag=SOMO"
   ```

## Voice Bot Integration

The voice bot calls these endpoints to:
1. **Resume learning** - Query `GET /progress/:chatId?tag=SOMO` to find where user left off
2. **Track completions** - Call `POST /progress/:chatId` when user finishes a section
3. **Build menu** - Call `GET /progress/modules?tag=SOMO` to build interactive menu
