# Memory Schema Enhancements Spec

**Version:** 1.1
**Date:** 2026-01-30
**Status:** Implemented
**Related:** Clawdbot agentic memory patterns analysis

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Type Definitions | ✅ Complete | `memory.ts`, `progress.ts` |
| Phase 2: MongoDB Schema | ✅ Complete | ConversationSummary in stateManager |
| Phase 3: Qdrant Enhancements | ✅ Complete | Hybrid search, RRF fusion |
| Phase 4: Thread Detection | ✅ Complete | threadDetector.ts service |
| Phase 5: Summary Generator | ⏳ Pending | Schema ready, LLM integration pending |
| Tests | ✅ Complete | 47 tests passing |

**Documentation:** See [docs/architecture/05-memory-schema-enhancements.md](../docs/architecture/05-memory-schema-enhancements.md)

---

## Overview

Enhance MongoDB and Qdrant schemas to support:
1. **Working memory layer** (conversation summaries)
2. **Hybrid search** (semantic + keyword)
3. **Feedback signals** for learning analytics

Based on analysis of Clawdbot's three-tier memory architecture and hybrid search patterns.

---

## Current Architecture

| Layer | Storage | Current Use |
|-------|---------|-------------|
| Long-term | MongoDB | Users, learning progress, webhooks, config |
| Semantic | Qdrant | Conversation messages with embeddings |
| Ephemeral | Redis | Session metadata, cache |

**Gap:** No intermediate "working memory" layer between raw conversation (Qdrant) and long-term user data (MongoDB).

---

## 1. ConversationSummary Collection (MongoDB)

**Status:** ✅ Implemented

New collection for daily conversation summaries, generated on-demand when context is needed.

### Schema (Implemented)

```typescript
interface SummaryEntry {
  timestamp: string;
  text: string;              // Summary text
  messageCount: number;      // Messages summarized
  sourceMessageIds: string[];// Reference tracking
  topics: string[];          // Extracted topics
}

interface ConversationSummary {
  id: string;
  chatId: string;           // Indexed
  sessionId: string;        // Indexed
  tag: string;              // Indexed
  date: string;             // YYYY-MM-DD, indexed

  entries: SummaryEntry[];  // Append-only
  totalMessagesSummarized: number;

  createdAt: string;
  updatedAt: string;
}
```

### API (Implemented)

```typescript
// Create/get summary
await stateManager.getOrCreateTodaySummary({ chatId, sessionId, tag });

// Append entry
await stateManager.appendSummaryEntry(summaryId, entry);

// Retrieve for context
await stateManager.getSummariesForContext({ chatId, tag, limit: 7 });

// Cleanup
await stateManager.deleteSummariesOlderThan(chatId, "2025-01-01");
```

---

## 2. Enhanced Qdrant Payload

**Status:** ✅ Implemented

### Updated QdrantPointPayload (Implemented)

```typescript
interface QdrantPointPayload {
  // Existing fields
  id: string;
  chatId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tags: string[];
  conversationSessionId?: string;

  // NEW: Keyword-optimized fields
  contentNormalized?: string;   // Lowercased, stopwords removed
  keywords?: string[];          // Extracted terms
  contentLength?: number;       // For BM25 normalization
  messageType?: 'question' | 'statement' | 'command' | 'greeting';

  // NEW: Thread awareness
  threadId?: string;
  positionInThread?: number;
  isThreadStart?: boolean;

  // NEW: Pruning metadata
  importance?: number;          // 0-1, rule-based
  ttlCategory?: 'ephemeral' | 'session' | 'persistent';
  referencedInSummary?: boolean;
}
```

---

## 3. Hybrid Search Implementation

**Status:** ✅ Implemented

### HybridSearchOptions (Implemented)

```typescript
interface HybridSearchOptions {
  query: string;
  chatId: string;
  tag?: string;
  limit?: number;

  strategy?: 'vector' | 'keyword' | 'hybrid';
  vectorWeight?: number;        // Default: 0.7
  minScore?: number;

  // Filters
  threadId?: string;
  messageType?: MessageType;
  after?: string;
  before?: string;
}
```

### Implementation Details

- **RRF Fusion**: Reciprocal Rank Fusion combines vector and keyword results
- **Keyword Extraction**: Stopword filtering, frequency-based ranking
- **Message Classification**: Rule-based type detection

---

## 4. Thread Detection Service

**Status:** ✅ Implemented

### ConversationThread (Implemented)

```typescript
interface ConversationThread {
  threadId: string;
  chatId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  topics: string[];
  isActive: boolean;
}
```

### Detection Logic (Implemented)

```typescript
// Boundary triggers:
// 1. Time gap > 30 minutes
// 2. Topic similarity < 20% (keyword overlap)

const result = detectThreadBoundary(message, {
  maxGapMs: 30 * 60 * 1000,      // 30 minutes
  minTopicSimilarity: 0.2,       // 20% keyword overlap
});
```

### API (Implemented)

```typescript
import {
  detectThreadBoundary,
  getActiveThread,
  closeThread,
  forceNewThread,
  cleanupStaleThreads,
  getThreadStats,
} from './services/threadDetector';
```

---

## 5. Feedback Signal Extensions

**Status:** ✅ Implemented

### ModuleAttempt (Implemented)

```typescript
interface ModuleAttempt {
  sectionId: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  success: boolean;
  score?: number;
  hintsUsed?: number;
  askedForHelp?: boolean;
}
```

### Extended ModuleProgress (Implemented)

```typescript
interface ModuleProgress {
  // Existing fields...

  // NEW: Feedback signals
  attempts?: ModuleAttempt[];
  difficultyScore?: number;     // 0-1
  engagementScore?: number;     // 0-1
  masteryConfidence?: number;   // 0-1
  avgTimePerSection?: number;
  feedbackQuestions?: LearningQuestion[];
}
```

### Extended UserLearningData (Implemented)

```typescript
interface UserLearningData {
  // Existing fields...

  // NEW: Aggregated signals
  avgDifficulty?: number;
  overallEngagement?: number;
  totalQuestionsAsked?: number;
  repeatQuestionRate?: number;
  avgSessionDuration?: number;
  learningVelocity?: number;
}
```

---

## Files Created/Modified

| File | Action | Status |
|------|--------|--------|
| `src/types/memory.ts` | Modified | ✅ |
| `src/types/learning/progress.ts` | Modified | ✅ |
| `src/utils/stateManager.ts` | Modified | ✅ |
| `src/services/qdrantHandler.ts` | Modified | ✅ |
| `src/services/threadDetector.ts` | Created | ✅ |
| `__tests__/unit/services/qdrantHandler.test.ts` | Created | ✅ |
| `__tests__/unit/services/threadDetector.test.ts` | Created | ✅ |
| `docs/architecture/05-memory-schema-enhancements.md` | Created | ✅ |

---

## Verification

| Check | Status |
|-------|--------|
| Type check (`npm run type-check`) | ✅ Passing |
| Unit tests (47 new tests) | ✅ Passing |
| Integration test | ⏳ Pending |
| Manual test | ⏳ Pending |

---

## Remaining Work

### Phase 5: Summary Generator (Not Yet Implemented)

The schema and storage layer is ready. Remaining:

1. **LLM Integration**: Call OpenRouter to generate summary text
2. **Trigger Logic**: When to generate summaries
3. **Integration**: Wire into message processing pipeline

### Future Enhancements

1. **Semantic Topic Detection**: Use embeddings for topic similarity
2. **Importance Learning**: ML-based importance scoring
3. **Automatic Pruning**: Service to clean up based on TTL

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Keyword extraction method | Simple regex with stopwords (fast, effective) |
| Thread persistence | Qdrant metadata + in-memory state (not separate collection) |
| Summary length | Variable (entries append over day) |
| Type conflicts | Renamed `KbQuestion` to `LearningQuestion` to avoid collision |

---

**Last Updated:** January 30, 2026
