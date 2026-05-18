# Memory Schema Enhancements

**Date**: January 2026
**Status**: ✅ Complete
**Branch**: `feat/memory-schema-enhancements`

---

## Overview

Enhanced the conversation memory system with hybrid search capabilities, thread detection, conversation summarization, and learning feedback signals. These improvements enable better context retrieval for RAG responses and more intelligent conversation management.

---

## What Changed

### Before
- Vector-only semantic search in Qdrant
- No conversation summarization
- Flat message storage (no thread grouping)
- Basic learning progress tracking

### After
- **Hybrid Search**: Combined vector + keyword search with RRF fusion
- **Thread Detection**: Automatic conversation thread boundaries
- **Conversation Summaries**: Rolling daily summaries stored in MongoDB
- **Enhanced Metadata**: Message classification, importance scoring, TTL categories
- **Feedback Signals**: Detailed learning engagement tracking

---

## How This Changes System Behavior

### 1. Improved Context Retrieval

**Before**: Searching for "Python data types" would only find semantically similar messages, potentially missing exact keyword matches.

**After**: Hybrid search combines semantic similarity with keyword matching, so messages containing "Python" and "data types" are found even if embedding similarity is low.

```typescript
// New hybrid search with configurable strategy
const results = await qdrantHandler.hybridSearch({
  query: "Python data types",
  chatId: "254722833440@c.us",
  strategy: "hybrid",      // 'vector' | 'keyword' | 'hybrid'
  vectorWeight: 0.7,       // 70% vector, 30% keyword
  limit: 10,
}, "somo-conversations");
```

### 2. Automatic Thread Grouping

**Before**: All messages stored as flat sequence. RAG context retrieval couldn't distinguish between different conversation topics.

**After**: Messages automatically grouped into threads based on time gaps and topic similarity. Context retrieval can filter by thread.

```typescript
// Thread boundary detection happens automatically on message storage
// Messages within 30 minutes with topic overlap stay in same thread
// New thread starts after:
// - 30+ minute gap
// - Topic shift (< 20% keyword overlap)
```

**Behavioral Impact**:
- RAG responses can focus on the current thread's context
- Summarization can operate per-thread
- Analytics can track conversation patterns

### 3. Conversation Summarization

**Before**: Long conversations accumulated without compression. Token limits forced truncation of older context.

**After**: Daily rolling summaries condense conversation history. Recent messages + summary provides more comprehensive context.

```typescript
// Get or create today's summary
const summary = await stateManager.getOrCreateTodaySummary({
  chatId: "254722833440@c.us",
  sessionId: "mysession",
  tag: "SOMO",
});

// Append summary entry after processing a batch of messages
await stateManager.appendSummaryEntry(summary.id, {
  text: "User asked about Python basics, covered variables and data types",
  messageCount: 15,
  sourceMessageIds: ["msg-1", "msg-2", ...],
  topics: ["python", "variables", "data types"],
});

// Retrieve summaries for RAG context
const recentSummaries = await stateManager.getSummariesForContext({
  chatId: "254722833440@c.us",
  tag: "SOMO",
  limit: 7,  // Last 7 days
});
```

**Behavioral Impact**:
- RAG can include historical context without token explosion
- Conversations spanning multiple days maintain continuity
- Pruning can remove raw messages while preserving summaries

### 4. Message Classification and Importance

**Before**: All messages treated equally for storage and retrieval.

**After**: Messages classified by type and assigned importance scores for prioritized retrieval.

| Message Type | Example | Importance | TTL Category |
|--------------|---------|------------|--------------|
| `greeting` | "Hi there!" | 0.1 | `ephemeral` |
| `command` | "Send me the report" | 0.5 | `session` |
| `statement` | "The meeting is at 3pm" | 0.5-0.7 | `session`/`persistent` |
| `question` | "What is Python?" | 0.7-0.9 | `persistent` |

**Behavioral Impact**:
- Important messages (questions, detailed statements) prioritized in retrieval
- Ephemeral messages (greetings) can be pruned more aggressively
- Search results weighted by importance

### 5. Learning Feedback Signals

**Before**: Progress tracked as simple completion percentages.

**After**: Rich engagement metrics for adaptive learning.

```typescript
// ModuleProgress now includes:
interface ModuleProgress {
  // ... existing fields ...

  // New feedback signals
  attempts?: ModuleAttempt[];        // Track all attempts with timing
  difficultyScore?: number;          // 0-1, higher = harder for user
  engagementScore?: number;          // 0-1, based on time and interactions
  masteryConfidence?: number;        // 0-1, consistency of performance
  avgTimePerSection?: number;        // Seconds per section
  feedbackQuestions?: LearningQuestion[];  // Questions asked in module
}

// UserLearningData aggregates across modules:
interface UserLearningData {
  // ... existing fields ...

  // Aggregated signals
  avgDifficulty?: number;           // Average across modules
  overallEngagement?: number;       // Overall engagement score
  totalQuestionsAsked?: number;     // Questions across all modules
  repeatQuestionRate?: number;      // 0-1, confusion indicator
  avgSessionDuration?: number;      // Seconds per session
  learningVelocity?: number;        // Sections per hour
}
```

**Behavioral Impact**:
- System can identify struggling users (high difficulty, high repeat questions)
- Adaptive pacing based on learning velocity
- Engagement tracking for course effectiveness analysis

---

## New Data Structures

### Qdrant Point Payload (Enhanced)

```typescript
interface QdrantPointPayload {
  // Core fields (existing)
  id: string;
  chatId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tags: string[];
  conversationSessionId?: string;

  // NEW: Hybrid Search Fields
  contentNormalized?: string;    // Lowercase, stopwords removed
  keywords?: string[];           // Extracted keywords
  contentLength?: number;        // For BM25 normalization
  messageType?: MessageType;     // 'question' | 'statement' | 'command' | 'greeting'

  // NEW: Thread Awareness
  threadId?: string;             // Groups related messages
  positionInThread?: number;     // 0-indexed position
  isThreadStart?: boolean;       // First message in thread

  // NEW: Pruning Metadata
  importance?: number;           // 0-1, retrieval priority
  ttlCategory?: TtlCategory;     // 'ephemeral' | 'session' | 'persistent'
  referencedInSummary?: boolean; // Protected from pruning
}
```

### ConversationSummary (MongoDB)

```typescript
interface ConversationSummary {
  id: string;
  chatId: string;
  sessionId: string;
  tag: string;
  date: string;                  // YYYY-MM-DD
  entries: SummaryEntry[];       // Append-only
  totalMessagesSummarized: number;
  createdAt: string;
  updatedAt: string;
}

interface SummaryEntry {
  timestamp: string;
  text: string;
  messageCount: number;
  sourceMessageIds: string[];
  topics: string[];
}
```

### ConversationThread

```typescript
interface ConversationThread {
  threadId: string;
  chatId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;       // null if ongoing
  messageCount: number;
  topics: string[];
  isActive: boolean;
}
```

---

## API Reference

### Hybrid Search

```typescript
import { qdrantHandler } from './services/qdrantHandler';

// Full hybrid search with all options
const results = await qdrantHandler.hybridSearch({
  query: "Python data types",
  chatId: "254722833440@c.us",
  tag: "SOMO",                   // Optional tag filter
  strategy: "hybrid",            // 'vector' | 'keyword' | 'hybrid'
  limit: 10,
  vectorWeight: 0.7,             // Default: 0.7
  minScore: 0.3,                 // Minimum combined score
  threadId: "thread-123",        // Optional thread filter
  messageType: "question",       // Optional type filter
  after: "2026-01-01T00:00:00Z", // Optional time filter
  before: "2026-01-31T23:59:59Z",
}, "somo-conversations");

// Results include score breakdown
results.forEach(r => {
  console.log(`${r.message.content}`);
  console.log(`  Combined: ${r.score}`);
  console.log(`  Vector: ${r.scores.vector}`);
  console.log(`  Keyword: ${r.scores.keyword}`);
});
```

### Thread Detection

```typescript
import {
  detectThreadBoundary,
  getActiveThread,
  closeThread,
  forceNewThread,
} from './services/threadDetector';

// Automatic thread detection
const result = detectThreadBoundary(message, {
  maxGapMs: 30 * 60 * 1000,      // 30 minutes (default)
  minTopicSimilarity: 0.2,       // 20% keyword overlap (default)
});

console.log(result.threadId);        // UUID
console.log(result.isNewThread);     // true if new thread started
console.log(result.positionInThread); // 0 for first message

// Store message with thread info
await qdrantHandler.storeMessage(message, "collection", {
  threadId: result.threadId,
  positionInThread: result.positionInThread,
  isThreadStart: result.isThreadStart,
});

// Get current thread
const thread = getActiveThread(chatId);

// Force new thread (e.g., user says "new topic")
const newThreadId = forceNewThread(chatId, sessionId, timestamp);
```

### Conversation Summaries

```typescript
import { stateManager } from './utils/stateManager';

// Get or create today's summary
const summary = await stateManager.getOrCreateTodaySummary({
  chatId: "254722833440@c.us",
  sessionId: "mysession",
  tag: "SOMO",
});

// Add entry after processing messages
await stateManager.appendSummaryEntry(summary.id, {
  text: "User learned about Python variables and data types",
  messageCount: 15,
  sourceMessageIds: ["msg-1", "msg-2"],
  topics: ["python", "variables", "data-types"],
});

// Retrieve for RAG context
const summaries = await stateManager.getSummariesForContext({
  chatId: "254722833440@c.us",
  tag: "SOMO",
  limit: 7,
  afterDate: "2026-01-01",
});

// Cleanup old summaries
await stateManager.deleteSummariesOlderThan(chatId, "2025-01-01");
```

### Utility Functions

```typescript
import {
  extractKeywords,
  normalizeContent,
  classifyMessageType,
  calculateImportance,
  determineTtlCategory,
} from './services/qdrantHandler';

// Keyword extraction
const keywords = extractKeywords("What are Python data types?");
// ['python', 'data', 'types']

// Content normalization
const normalized = normalizeContent("Hello, World! How are YOU?");
// 'hello world'

// Message classification
const type = classifyMessageType("What is Python?");
// 'question'

// Importance scoring
const importance = calculateImportance("What is the deadline?", "question");
// 0.7

// TTL category
const ttl = determineTtlCategory("Hi!", "greeting");
// 'ephemeral'
```

---

## MongoDB Indexes

### ConversationSummary Collection

```javascript
// Efficient queries by chat and date
db.conversationsummaries.createIndex({ chatId: 1, date: -1 });
db.conversationsummaries.createIndex({ sessionId: 1, date: -1 });
db.conversationsummaries.createIndex({ chatId: 1, tag: 1, date: -1 });
```

---

## Integration Examples

### Enhanced RAG Context Retrieval

```typescript
async function getEnhancedContext(
  chatId: string,
  query: string,
  tag: string
): Promise<RetrievedContext> {
  // 1. Get thread context
  const thread = getActiveThread(chatId);

  // 2. Hybrid search (current thread preferred)
  const similar = await qdrantHandler.hybridSearch({
    query,
    chatId,
    tag,
    strategy: "hybrid",
    threadId: thread?.threadId,
    limit: 5,
  }, `${tag.toLowerCase()}-conversations`);

  // 3. Get recent history
  const history = await qdrantHandler.getConversationHistory(
    `${tag.toLowerCase()}-conversations`,
    chatId,
    10
  );

  // 4. Get summaries for longer context
  const summaries = await stateManager.getSummariesForContext({
    chatId,
    tag,
    limit: 3,
  });

  // 5. Combine into context
  return {
    similarMessages: similar.map(r => ({
      message: r.message,
      score: r.score,
    })),
    conversationHistory: history,
    summaries: summaries.map(s => s.entries.map(e => e.text).join('\n')),
    currentThread: thread,
  };
}
```

### Message Processing Pipeline

```typescript
async function processIncomingMessage(
  message: ConversationMessage,
  collectionName: string
) {
  // 1. Detect thread boundary
  const threadResult = detectThreadBoundary(message);

  // 2. Store with enhanced metadata
  await qdrantHandler.storeMessage(message, collectionName, {
    threadId: threadResult.threadId,
    positionInThread: threadResult.positionInThread,
    isThreadStart: threadResult.isThreadStart,
  });

  // 3. Check if summary needed (e.g., every 20 messages)
  const thread = getActiveThread(message.chatId);
  if (thread && thread.messageCount % 20 === 0) {
    await generateAndStoreSummary(message.chatId, thread);
  }
}
```

---

## Testing

Run the new tests:

```bash
# All new tests
npm test -- --testPathPattern="qdrantHandler|threadDetector"

# Specific test files
npm test -- __tests__/unit/services/qdrantHandler.test.ts
npm test -- __tests__/unit/services/threadDetector.test.ts
```

Coverage:
- `qdrantHandler.test.ts`: 25 tests (keyword extraction, RRF, classification)
- `threadDetector.test.ts`: 22 tests (thread detection, lifecycle, cleanup)

---

## Configuration

### Thread Detection Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxGapMs` | 30 minutes | Time gap before new thread |
| `minTopicSimilarity` | 0.2 | Minimum keyword overlap |
| `useSemanticDetection` | false | Use embeddings for topic detection |

### Hybrid Search Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| `strategy` | `hybrid` | Search strategy |
| `vectorWeight` | 0.7 | Vector vs keyword weight |
| `limit` | 10 | Max results |
| `minScore` | 0 | Minimum score threshold |

---

## Future Enhancements

### Planned
1. **Automatic Summarization**: LLM-powered summary generation
2. **Semantic Thread Detection**: Use embeddings for topic similarity
3. **Pruning Service**: Automated cleanup based on TTL categories
4. **Thread Analytics**: Dashboard for conversation patterns

### Potential
1. **Multi-language Keyword Extraction**: Swahili stopwords
2. **Importance Learning**: ML-based importance scoring
3. **Thread Merging**: Combine related threads

---

## Migration Notes

### For Existing Deployments

1. **No breaking changes** - All new fields are optional
2. **Existing messages** - Won't have new metadata until re-indexed
3. **Gradual adoption** - New features can be enabled incrementally

### Re-indexing Existing Messages

```typescript
// Optional: Add metadata to existing messages
async function enrichExistingMessage(point: QdrantPoint) {
  const content = point.payload.content;

  return {
    ...point.payload,
    contentNormalized: normalizeContent(content),
    keywords: extractKeywords(content),
    messageType: classifyMessageType(content),
    importance: calculateImportance(content, classifyMessageType(content)),
    ttlCategory: determineTtlCategory(content, classifyMessageType(content)),
  };
}
```

---

## Related Documentation

- [MongoDB Integration](02-mongodb-integration.md) - StateManager and MongoDB setup
- [Architecture Overview](01-architecture-overview.md) - System architecture
- [Developer API Guide](../whatsapp/05-developer-api-guide.md) - API usage
- [Learning Progress API](../whatsapp/06-learning-progress-api.md) - Learning progress tracking

---

**Last Updated**: January 30, 2026
**Version**: whatsapp-service v2.1.0
