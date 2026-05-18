# Learning Progress API Reference

Multi-tenant API for tracking learner progress through LMS content.

## Overview

The Progress API enables tracking and managing learner progress within WhatsApp-based learning programs. It follows a **multi-tenant design** where all endpoints require a `tag` parameter to identify the business client (e.g., SOMO, CompanyX).

### Base URL

```
/service/progress
```

### Authentication

All endpoints require API key authentication via `X-API-Key` header.

---

## Endpoints

### Get Module Structure

Retrieve the module/curriculum structure for a learning program.

```
GET /service/progress/modules?tag={tag}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tag` | string | Yes | Business client tag (e.g., 'SOMO') |

**Response:**
```json
{
  "success": true,
  "tag": "SOMO",
  "programName": "SOMO Financial Literacy",
  "modules": [
    {
      "moduleId": 1,
      "moduleName": "Introduction to Savings",
      "sections": ["Why Save?", "Types of Savings", "Setting Goals"],
      "order": 1
    }
  ],
  "totalModules": 5
}
```

---

### Get All Learners

List all learners with progress summaries for admin dashboards.

```
GET /service/progress/learners?tag={tag}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tag` | string | Yes | Business client tag |

**Response:**
```json
{
  "success": true,
  "tag": "SOMO",
  "learners": [
    {
      "chatId": "254722833440@c.us",
      "displayName": "John Doe",
      "overallProgress": 45,
      "currentModuleId": 2,
      "lastActivityAt": "2026-01-29T10:30:00.000Z",
      "totalInteractions": 15
    }
  ],
  "totalLearners": 42
}
```

---

### Get Learner Progress

Get detailed progress for a specific learner.

```
GET /service/progress/{chatId}?tag={tag}&includeModuleStructure={bool}&includeHistory={bool}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatId` | string | User's WhatsApp chat ID (e.g., `254722833440@c.us`) |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tag` | string | Yes | Business client tag |
| `includeModuleStructure` | boolean | No | Include full module structure |
| `includeHistory` | boolean | No | Include recent interaction history |

**Response:**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "displayName": "John Doe",
    "tags": ["SOMO", "VIP"]
  },
  "learning": {
    "tag": "SOMO",
    "sourceCollection": {
      "url": "https://qdrant.example.com",
      "collectionName": "somo_content"
    },
    "moduleProgress": {
      "1": {
        "moduleId": 1,
        "moduleName": "Introduction to Savings",
        "status": "completed",
        "completedSections": ["Why Save?", "Types of Savings", "Setting Goals"],
        "totalSections": 3,
        "progressPercent": 100,
        "completedAt": "2026-01-20T14:00:00.000Z"
      },
      "2": {
        "moduleId": 2,
        "moduleName": "Budgeting Basics",
        "status": "in_progress",
        "completedSections": ["Income vs Expenses"],
        "totalSections": 4,
        "progressPercent": 25,
        "lastAccessedAt": "2026-01-29T10:30:00.000Z"
      }
    },
    "currentModuleId": 2,
    "overallProgress": 45,
    "totalInteractions": 15,
    "engagedTopics": ["savings", "budgeting", "emergency funds"],
    "inferredLevel": "beginner",
    "lastActivityAt": "2026-01-29T10:30:00.000Z"
  }
}
```

---

### Update Learner Progress

Update progress for a specific learner.

```
POST /service/progress/{chatId}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatId` | string | User's WhatsApp chat ID |

**Request Body:**
```json
{
  "tag": "SOMO",
  "moduleId": 2,
  "sectionCompleted": "Creating a Budget",
  "metadata": {
    "quizScore": 85,
    "timeSpent": "15m"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | Business client tag |
| `moduleId` | string/number | No | Module to update |
| `sectionCompleted` | string | No | Section to mark completed |
| `moduleCompleted` | boolean | No | Mark entire module as completed |
| `setCurrentModule` | string/number | No | Set current active module |
| `metadata` | object | No | Additional metadata to merge |
| `context` | object | No | Additional context to merge |

**Response:**
```json
{
  "success": true,
  "chatId": "254722833440@c.us",
  "tag": "SOMO",
  "updated": {
    "moduleId": 2,
    "sectionCompleted": "Creating a Budget",
    "newProgressPercent": 50
  }
}
```

---

## Data Types

### ModuleStatus

```typescript
type ModuleStatus = 'not_started' | 'in_progress' | 'completed';
```

### KnowledgeLevel

```typescript
type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';
```

### ModuleProgress

```typescript
interface ModuleProgress {
  moduleId: string | number;
  moduleName?: string;
  status: ModuleStatus;
  completedSections: string[];
  totalSections?: number;
  progressPercent: number;         // 0-100
  lastAccessedAt?: string;         // ISO timestamp
  completedAt?: string;            // ISO timestamp
  metadata?: Record<string, unknown>;
}
```

### UserLearningData

```typescript
interface UserLearningData {
  tag: string;
  sourceCollection: {
    url: string;
    collectionName: string;
  };
  moduleProgress: Record<string, ModuleProgress>;
  currentModuleId?: string | number;
  overallProgress: number;         // 0-100
  totalInteractions: number;
  engagedTopics: string[];
  inferredLevel?: KnowledgeLevel;
  lastActivityAt: string;          // ISO timestamp
  context?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Architecture

### Data Sources

| Source | Purpose |
|--------|---------|
| **MongoDB** | User data, learning progress state |
| **Qdrant** | Module structure, content search, conversation history |

### Multi-Tenant Design

All learning data is isolated by `tag`:
- SOMO users only see SOMO progress
- Each tag can have different LMS configurations
- Progress is stored per user per tag

### LMS Configuration

Each tag can have LMS settings in its tag configuration:

```json
{
  "tag": "SOMO",
  "lms": {
    "enabled": true,
    "programName": "SOMO Financial Literacy",
    "autoDetect": true,
    "detectionThreshold": 0.7,
    "contentCollection": "somo_content"
  }
}
```

### Semantic Topic Detection

When `autoDetect` is enabled, the system:
1. Embeds incoming messages using OpenAI embeddings
2. Searches the content collection for similar topics
3. Automatically tracks which topics/sections the learner engages with
4. Uses `detectionThreshold` to filter low-confidence matches

---

## n8n Integration

### Track Progress from Workflow

```json
{
  "method": "POST",
  "url": "http://whatsapp-service:3001/service/progress/{{ $json.chatId }}",
  "body": {
    "tag": "SOMO",
    "moduleId": "{{ $json.detectedModule }}",
    "sectionCompleted": "{{ $json.completedSection }}"
  },
  "headers": {
    "X-API-Key": "{{ $env.API_KEY }}"
  }
}
```

### Fetch Progress for Context

```json
{
  "method": "GET",
  "url": "http://whatsapp-service:3001/service/progress/{{ $json.chatId }}?tag=SOMO&includeModuleStructure=true",
  "headers": {
    "X-API-Key": "{{ $env.API_KEY }}"
  }
}
```

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `tag query parameter is required` | Missing tag parameter |
| 400 | `tag is required in request body` | Missing tag in POST body |
| 404 | `User not found` | No user with given chatId |
| 404 | `No learning data for tag` | User has no progress for this tag |
| 500 | Internal server error | See logs for details |

---

## Related Documentation

- [Service API Reference](03-service-api-reference.md) - Main service endpoints
- [Developer Guide](05-developer-api-guide.md) - Integration guide
