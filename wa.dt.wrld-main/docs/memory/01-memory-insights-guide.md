# Memory Insights Guide

## Purpose

Provides visibility into RAG (Retrieval-Augmented Generation) memory utilization. Operators can view what context is being retrieved for conversations, monitor storage usage per user, and debug poor responses by examining retrieval quality metrics.

**Feature Location:** Backend API (`packages/whatsapp-service/src/controllers/MemoryController.ts`), Frontend UI (`packages/whatsapp-dashboard/src/pages/MemoryInsightsPage.tsx`)

---

## Architecture Overview

### RAG Memory System

The WhatsApp bot uses Qdrant vector database to store and retrieve conversational context. Each message is:
1. **Embedded** using OpenRouter LLM API (configured model)
2. **Stored** in Qdrant collection with metadata (chatId, role, tags, timestamp)
3. **Retrieved** via hybrid search (vector similarity + keyword matching) when user sends new messages

### Memory Insights Components

```
┌─────────────────────────────────────────────────────────┐
│  qdrantHandler.ts (Core Memory Operations)              │
│  - storeMessage()         Store new memories            │
│  - retrieveSimilar()      Get relevant context          │
│  - hybridSearch()         Vector + keyword search       │
│  - getMemoryStats()       Collection statistics         │
│  - searchMemories()       Search with filters           │
│  - exportMemories()       Data portability              │
│  - deleteMemory()         Remove specific memories      │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Exposed via REST API
                           ▼
┌─────────────────────────────────────────────────────────┐
│  MemoryController.ts (API Endpoints)                    │
│  - GET /memory/stats/:chatId                            │
│  - POST /memory/search                                  │
│  - GET /memory/export/:chatId                           │
│  - DELETE /memory/:messageId                            │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Consumed by Dashboard
                           ▼
┌─────────────────────────────────────────────────────────┐
│  MemoryInsightsPage.tsx (Dashboard UI)                  │
│  - MemoryStatsCard         Collection statistics        │
│  - RetrievedContextPanel   Search & view memories       │
│  - MemoryExportButton      Download user data           │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoints

All endpoints require API key authentication via `x-api-key` header.

### GET /service/memory/stats/:chatId

Retrieve memory statistics for a specific chat.

**Parameters:**
- `chatId` (path): WhatsApp chat ID (e.g., `254123456789@c.us`)
- `tag` (query, optional): Filter by tag (e.g., `SOMO`)
- `collection` (query, optional): Qdrant collection name (defaults to configured collection)

**Response:**
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "name": "whatsapp_memory",
        "vectorCount": 1234,
        "indexedVectorsCount": 1234,
        "storageSizeBytes": 5242880,
        "lastUpdatedAt": "2026-02-10T15:30:00Z"
      }
    ],
    "totalVectors": 1234,
    "totalStorageBytes": 5242880
  }
}
```

**Example:**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:3001/service/memory/stats/254123456789@c.us?tag=SOMO"
```

---

### POST /service/memory/search

Search memories using hybrid search (vector similarity + keyword matching).

**Request Body:**
```json
{
  "query": "pregnancy health",
  "chatId": "254123456789@c.us",
  "tag": "SOMO",
  "limit": 10,
  "offset": 0,
  "collection": "whatsapp_memory"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "msg_1234567890",
        "score": 0.856,
        "vectorScore": 0.82,
        "keywordScore": 0.92,
        "content": "What are the signs of labor?",
        "chatId": "254123456789@c.us",
        "role": "user",
        "timestamp": "2026-02-10T10:15:00Z",
        "tags": ["SOMO"]
      }
    ],
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

**Example:**
```bash
curl -X POST \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"query":"pregnancy","chatId":"254123456789@c.us","limit":10}' \
  "http://localhost:3001/service/memory/search"
```

---

### GET /service/memory/export/:chatId

Export all memories for a user (data portability).

**Parameters:**
- `chatId` (path): WhatsApp chat ID
- `tag` (query, optional): Filter by tag
- `collection` (query, optional): Collection name

**Response:**
```json
{
  "success": true,
  "data": {
    "chatId": "254123456789@c.us",
    "exportedAt": "2026-02-10T16:00:00Z",
    "totalMemories": 150,
    "memories": [
      {
        "id": "msg_1234567890",
        "content": "What are the signs of labor?",
        "role": "user",
        "timestamp": "2026-02-10T10:15:00Z",
        "tags": ["SOMO"]
      }
    ]
  }
}
```

**Example:**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:3001/service/memory/export/254123456789@c.us" \
  -o user_memories.json
```

---

### DELETE /service/memory/:messageId

Delete a specific memory by message ID.

**Parameters:**
- `messageId` (path): Message ID to delete
- `collection` (query, optional): Collection name

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "messageId": "msg_1234567890"
  }
}
```

**Example:**
```bash
curl -X DELETE \
  -H "x-api-key: your-api-key" \
  "http://localhost:3001/service/memory/msg_1234567890"
```

---

## Dashboard Usage

### Accessing Memory Insights

1. **Navigate to Dashboard**
   Visit `http://localhost:3002` (development) or your production dashboard URL

2. **Select a Chat**
   Choose a conversation from the chat list

3. **Open Memory Insights**
   Click "Memory" in the navigation sidebar (or visit `/memory` route directly)

### Memory Insights Page Layout

```
┌──────────────────────────────────────────────────────┐
│  🧠 Memory Insights                                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Memory Statistics                          │    │
│  │  Collection: whatsapp_memory                │    │
│  │  📊 Vectors: 1,234                          │    │
│  │  💾 Storage: 5.0 MB                         │    │
│  │  📅 Updated: 2 hours ago                    │    │
│  │                       [Export Memories ↓]   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Search Memories                            │    │
│  │  [Search query...              ] [Search]   │    │
│  │                                              │    │
│  │  ┌──────────────────────────────────────┐  │    │
│  │  │ "What are the signs of labor?"       │  │    │
│  │  │ Relevance: 85.6%                     │  │    │
│  │  │ Vector: 82.0% | Keyword: 92.0%       │  │    │
│  │  │ user · 2 hours ago · SOMO     [🗑]   │  │    │
│  │  └──────────────────────────────────────┘  │    │
│  │                                              │    │
│  │  [← Previous]  Page 1 of 3 (25 total) [Next →] │
│  └────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### Features

#### 1. Memory Statistics Card

Displays collection-level statistics:
- **Collection Name:** Qdrant collection identifier
- **Vector Count:** Total number of stored memories
- **Indexed Vectors:** Vectors available for search
- **Storage Size:** Formatted in appropriate units (B, KB, MB, GB)
- **Last Updated:** Relative time since last update

#### 2. Retrieved Context Panel

Search and view retrieved memories:
- **Search Input:** Type query and press Enter or click Search
- **Wildcard Search:** Leave empty and search to retrieve all memories
- **Clear Button:** Reset search query
- **Results List:** Shows matching memories with:
  - Message content (truncated to 4 lines)
  - Relevance score breakdown (Overall, Vector, Keyword)
  - Role badge (user, assistant, system)
  - Timestamp (relative time)
  - Tags (if any)
  - Delete button (trash icon)

#### 3. Pagination

Navigate through search results:
- **Items Per Page:** 10 memories
- **Page Info:** "Page X of Y (Z total)"
- **Previous/Next Buttons:** Navigate between pages
- **Auto-disable:** Buttons disabled when at first/last page

#### 4. Memory Export

Download user data as JSON:
- **Export Button:** Click to download all memories for selected chat
- **Filename Format:** `memory-export-{chatId}-{timestamp}.json`
- **Loading State:** Button shows spinner during export
- **Error Handling:** Displays inline error if export fails

#### 5. Delete Memory

Remove specific memories:
- **Delete Icon:** Click trash icon on any memory
- **Confirmation Dialog:** "Are you sure you want to delete this memory?"
- **Async Deletion:** Shows loading spinner during deletion
- **Optimistic Update:** Memory removed from list immediately
- **Error Handling:** Re-adds memory if deletion fails

---

## Use Cases

### 1. Debugging Poor Bot Responses

**Scenario:** Bot gives irrelevant answer to user question.

**Steps:**
1. Navigate to Memory Insights page
2. Select the problematic chat
3. Search for keywords from user's question
4. Review retrieved context:
   - Check relevance scores (should be >0.7 for good matches)
   - Verify vector score (semantic similarity)
   - Verify keyword score (lexical matching)
5. If no relevant context found:
   - Check if similar messages were stored (search historical messages)
   - Verify message storage is working (check recent memories)
   - Adjust embedding model or search parameters if needed

**Example:**
```
User asked: "What are signs of labor?"
Bot responded: "I can help with nutrition."

Memory search shows:
- Top result: "nutrition during pregnancy" (score: 0.45) ❌ Too low
- No labor-related memories found

Action: Check if labor information was ever discussed, or add labor FAQs to memory.
```

### 2. Monitoring Storage Costs

**Scenario:** Track memory usage as user base grows.

**Steps:**
1. Review Memory Statistics card
2. Note total storage size across all collections
3. Export data periodically for archival
4. Delete old/irrelevant memories to reduce costs

**Example:**
```
Collection: whatsapp_memory
Vectors: 50,000
Storage: 500 MB

Action: Archive memories older than 6 months, reducing to 300 MB.
```

### 3. User Data Portability (GDPR Compliance)

**Scenario:** User requests their data.

**Steps:**
1. Select user's chat
2. Click "Export Memories" button
3. Save downloaded JSON file
4. Share with user or legal team

**Example Export:**
```json
{
  "chatId": "254123456789@c.us",
  "exportedAt": "2026-02-10T16:00:00Z",
  "totalMemories": 150,
  "memories": [...]
}
```

### 4. Quality Assurance

**Scenario:** Verify RAG system is working correctly.

**Steps:**
1. Send test message via WhatsApp
2. Wait for bot response
3. Check Memory Insights to verify:
   - Message was stored (vector count increased)
   - Relevant context was retrieved (check search results)
   - Scores are reasonable (>0.5 for related topics)

---

## Configuration

### Environment Variables

Memory insights feature requires the following environment variables in `whatsapp-service`:

```bash
# Qdrant Configuration
ENABLE_QDRANT=true
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=whatsapp_memory

# OpenRouter for Embeddings
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=openai/gpt-4o-mini

# API Authentication
API_KEY=your-secure-api-key
```

### Qdrant Collection Setup

The RAG system uses Qdrant collections with the following schema:

```typescript
interface MemoryPayload {
  content: string;          // Message text
  chatId: string;           // WhatsApp chat ID
  role: 'user' | 'assistant' | 'system';
  timestamp: string;        // ISO 8601 format
  tags?: string[];          // Optional tags (e.g., ['SOMO'])
  messageId: string;        // Unique message identifier
}
```

**Vector Dimensions:** Determined by embedding model (e.g., 1536 for OpenAI models)
**Distance Metric:** Cosine similarity
**Indexing:** HNSW (Hierarchical Navigable Small World)

---

## Troubleshooting

### No Memories Found

**Problem:** Search returns empty results.

**Solutions:**
1. Verify `ENABLE_QDRANT=true` in environment
2. Check Qdrant service is running: `curl http://localhost:6333/health`
3. Verify collection exists: `curl http://localhost:6333/collections`
4. Check backend logs for storage errors

### Low Relevance Scores

**Problem:** Retrieved memories have scores <0.5.

**Solutions:**
1. Review embedding model quality (try different LLM_MODEL)
2. Check if enough historical context exists
3. Verify message content is meaningful (not just "hi", "ok")
4. Adjust hybrid search weights in `qdrantHandler.ts`

### Export Fails

**Problem:** Export button shows error.

**Solutions:**
1. Check API key is valid
2. Verify user has memories stored
3. Check backend logs for Qdrant connection errors
4. Ensure sufficient server memory for large exports

### Delete Not Working

**Problem:** Delete button doesn't remove memory.

**Solutions:**
1. Verify messageId is correct
2. Check API key has delete permissions
3. Review backend logs for Qdrant delete errors
4. Confirm collection name matches configured collection

---

## Performance Considerations

### Search Performance

- **Vector Search:** O(log n) with HNSW indexing
- **Hybrid Search:** Combines vector + keyword, slightly slower
- **Recommended Limits:** Keep search limit ≤50 for UI responsiveness

### Storage Scaling

| Users | Avg Messages/User | Vectors | Storage (approx) |
|-------|-------------------|---------|------------------|
| 100   | 50                | 5,000   | 50 MB            |
| 1,000 | 100               | 100,000 | 1 GB             |
| 10,000| 200               | 2M      | 20 GB            |

**Note:** Storage estimates assume 1536-dimensional vectors (OpenAI embeddings)

### Optimization Tips

1. **Use Tags:** Filter by tag to reduce search space
2. **Pagination:** Fetch memories in batches (10-20 per page)
3. **Archive Old Data:** Export and delete memories >6 months old
4. **Monitor Qdrant:** Check `/service/health` and Qdrant metrics regularly

---

## Security & Privacy

### Data Access Control

- **API Key Required:** All memory endpoints require valid `x-api-key` header
- **No Cross-Chat Access:** `chatId` parameter enforces user isolation
- **No Sensitive Data:** Memory content is user messages only (no credentials)

### GDPR Compliance

- **Right to Access:** Export endpoint provides user data
- **Right to Deletion:** Delete endpoint removes specific memories
- **Data Minimization:** Only message content + metadata stored
- **Purpose Limitation:** Memory used only for conversation context

### Best Practices

1. **Rotate API Keys:** Change `API_KEY` regularly
2. **Audit Exports:** Log who exports user data and when
3. **Anonymize Logs:** Don't log message content in application logs
4. **Secure Transport:** Always use HTTPS in production

---

## Related Documentation

| File | Purpose |
|------|---------|
| [docs/architecture/05-memory-schema-enhancements.md](../architecture/05-memory-schema-enhancements.md) | RAG memory architecture |
| [docs/dashboard/01-dashboard-overview.md](../dashboard/01-dashboard-overview.md) | Dashboard architecture |
| [packages/whatsapp-service/src/services/qdrantHandler.ts](../../packages/whatsapp-service/src/services/qdrantHandler.ts) | Core memory operations |
| [packages/whatsapp-service/src/controllers/MemoryController.ts](../../packages/whatsapp-service/src/controllers/MemoryController.ts) | API endpoint definitions |
| [packages/whatsapp-dashboard/src/stores/memoryStore.ts](../../packages/whatsapp-dashboard/src/stores/memoryStore.ts) | Frontend state management |

---

## Roadmap

### Planned Enhancements

- **Memory Analytics:** Visualize memory growth over time
- **Relevance Tuning:** UI to adjust hybrid search weights
- **Bulk Operations:** Delete/export multiple memories at once
- **Memory Insights:** Show which memories influenced each bot response
- **Auto-Cleanup:** Scheduled job to archive old memories
- **Memory Sharing:** Export memories between related chats

---

## Support

For issues with memory insights:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review backend logs: `docker logs whatsapp-service --tail 100`
3. Verify Qdrant health: `curl http://localhost:6333/health`
4. Check API documentation: Visit `/api-docs/service` for interactive Swagger docs
