# Learning Progress API Specification

**Version:** 2.0
**Base URL:** `http://whatsapp-service:3001/service/progress`
**Auth:** API Key via `X-API-Key` header

---

## Overview

REST API for managing multi-tenant learning progress. Each user can have progress across multiple programs (tags).

```
┌─────────────────────────────────────────────────────────────┐
│                        API Endpoints                         │
├─────────────────────────────────────────────────────────────┤
│  GET  /modules?tag={tag}           → Get module structure    │
│  GET  /learners?tag={tag}          → List all learners       │
│  GET  /{chatId}?tag={tag}          → Get learner progress    │
│  POST /{chatId}                    → Update progress         │
│  POST /{chatId}/interaction        → Track interaction       │
│  POST /{chatId}/attempt            → Record attempt          │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication

All requests require the `X-API-Key` header:

```http
X-API-Key: your-api-key-here
```

---

## Endpoints

### GET /modules

Get the curriculum structure for a program.

**Request:**
```http
GET /service/progress/modules?tag=SOMO
X-API-Key: sk_xxxx
```

**Response:** `200 OK`
```json
{
  "success": true,
  "tag": "SOMO",
  "programName": "SOMO Financial Literacy",
  "modules": [
    {
      "moduleId": 1,
      "moduleName": "Introduction to Savings",
      "sections": [
        "Why Save?",
        "Types of Savings",
        "Setting Goals"
      ],
      "order": 1
    },
    {
      "moduleId": 2,
      "moduleName": "Budgeting Basics",
      "sections": [
        "Income vs Expenses",
        "Creating a Budget",
        "Tracking Spending",
        "Adjusting Your Budget"
      ],
      "order": 2
    }
  ],
  "totalModules": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tag` | string | Program identifier |
| `programName` | string | Human-readable program name |
| `modules[].moduleId` | number | Unique module ID |
| `modules[].moduleName` | string | Module title |
| `modules[].sections` | string[] | Section titles in order |
| `modules[].order` | number | Display order |
| `totalModules` | number | Total modules in program |

---

### GET /learners

List all learners enrolled in a program.

**Request:**
```http
GET /service/progress/learners?tag=SOMO
X-API-Key: sk_xxxx
```

**Response:** `200 OK`
```json
{
  "success": true,
  "tag": "SOMO",
  "learners": [
    {
      "chatId": "254722833440@c.us",
      "phoneNumber": "254722833440",
      "displayName": "John Doe",
      "overallProgress": 45,
      "currentModuleId": 2,
      "lastActivityAt": "2026-01-30T10:30:00.000Z",
      "totalInteractions": 27,
      "inferredLevel": "beginner"
    }
  ],
  "totalLearners": 42
}
```

| Field | Type | Description |
|-------|------|-------------|
| `learners[].chatId` | string | WhatsApp chat ID |
| `learners[].phoneNumber` | string | Normalized phone number |
| `learners[].displayName` | string | Name or pushname |
| `learners[].overallProgress` | number | 0-100 percentage |
| `learners[].currentModuleId` | number | Current active module |
| `learners[].lastActivityAt` | string | ISO 8601 timestamp |
| `learners[].totalInteractions` | number | Total tracked interactions |
| `learners[].inferredLevel` | string | `beginner` / `intermediate` / `advanced` |

---

### GET /{chatId}

Get detailed progress for a specific learner.

**Request:**
```http
GET /service/progress/254722833440@c.us?tag=SOMO&includeModuleStructure=true
X-API-Key: sk_xxxx
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tag` | string | Yes | - | Program identifier |
| `includeModuleStructure` | boolean | No | false | Include full module structure |
| `includeHistory` | boolean | No | false | Include recent interaction history |
| `includeFeedback` | boolean | No | false | Include feedback signals |

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "phoneNumber": "254722833440",
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
        "completedAt": "2026-01-20T14:00:00.000Z",
        "difficultyScore": 0.2,
        "engagementScore": 0.85,
        "masteryConfidence": 0.9
      },
      "2": {
        "moduleId": 2,
        "moduleName": "Budgeting Basics",
        "status": "in_progress",
        "completedSections": ["Income vs Expenses"],
        "totalSections": 4,
        "progressPercent": 25,
        "lastAccessedAt": "2026-01-30T10:30:00.000Z",
        "difficultyScore": 0.5,
        "engagementScore": 0.7
      }
    },
    "currentModuleId": 2,
    "overallProgress": 45,
    "totalInteractions": 27,
    "engagedTopics": ["savings", "budgeting", "emergency funds"],
    "inferredLevel": "beginner",
    "lastActivityAt": "2026-01-30T10:30:00.000Z",
    "avgDifficulty": 0.35,
    "overallEngagement": 0.78,
    "learningVelocity": 2.1
  }
}
```

**Error Responses:**

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "tag query parameter is required"}` | Missing tag |
| 404 | `{"error": "User not found"}` | Invalid chatId |
| 404 | `{"error": "No learning data for tag"}` | User not enrolled |

---

### POST /{chatId}

Update progress for a learner.

**Request:**
```http
POST /service/progress/254722833440@c.us
Content-Type: application/json
X-API-Key: sk_xxxx

{
  "tag": "SOMO",
  "moduleId": 2,
  "sectionCompleted": "Creating a Budget",
  "metadata": {
    "timeSpent": "15m",
    "source": "lesson_view"
  }
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | Program identifier |
| `moduleId` | number/string | No | Module to update |
| `sectionCompleted` | string | No | Section to mark complete |
| `moduleCompleted` | boolean | No | Mark entire module complete |
| `setCurrentModule` | number/string | No | Set current active module |
| `metadata` | object | No | Merge into module metadata |
| `context` | object | No | Merge into learning context |

**Response:** `200 OK`
```json
{
  "success": true,
  "chatId": "254722833440@c.us",
  "tag": "SOMO",
  "updated": {
    "moduleId": 2,
    "sectionCompleted": "Creating a Budget",
    "newStatus": "in_progress",
    "newProgressPercent": 50,
    "completedSections": ["Income vs Expenses", "Creating a Budget"]
  }
}
```

---

### POST /{chatId}/interaction

Track a learning interaction (lighter than full update).

**Request:**
```http
POST /service/progress/254722833440@c.us/interaction
Content-Type: application/json
X-API-Key: sk_xxxx

{
  "tag": "SOMO",
  "moduleId": 2,
  "sectionTitle": "Creating a Budget",
  "interactionType": "view"
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | Program identifier |
| `moduleId` | number/string | Yes | Module being accessed |
| `sectionTitle` | string | Yes | Section being accessed |
| `interactionType` | string | No | `view` / `question` / `quiz` |

**Response:** `200 OK`
```json
{
  "success": true,
  "chatId": "254722833440@c.us",
  "tag": "SOMO",
  "interaction": {
    "moduleId": 2,
    "sectionTitle": "Creating a Budget",
    "totalInteractions": 28,
    "engagedTopics": ["savings", "budgeting", "emergency funds", "Creating a Budget"]
  }
}
```

---

### POST /{chatId}/attempt

Record a module attempt with detailed feedback signals.

**Request:**
```http
POST /service/progress/254722833440@c.us/attempt
Content-Type: application/json
X-API-Key: sk_xxxx

{
  "tag": "SOMO",
  "moduleId": 1,
  "attempt": {
    "sectionId": "quiz-1",
    "startedAt": "2026-01-30T10:00:00Z",
    "completedAt": "2026-01-30T10:12:00Z",
    "durationSeconds": 720,
    "success": true,
    "score": 85,
    "hintsUsed": 2,
    "askedForHelp": false
  }
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | Program identifier |
| `moduleId` | number/string | Yes | Module attempted |
| `attempt.sectionId` | string | Yes | Section/quiz identifier |
| `attempt.startedAt` | string | Yes | ISO 8601 start time |
| `attempt.completedAt` | string | No | ISO 8601 end time (null if abandoned) |
| `attempt.durationSeconds` | number | Yes | Time taken |
| `attempt.success` | boolean | Yes | Whether attempt succeeded |
| `attempt.score` | number | No | Score 0-100 if applicable |
| `attempt.hintsUsed` | number | No | Number of hints used |
| `attempt.askedForHelp` | boolean | No | Whether user asked for help |

**Response:** `200 OK`
```json
{
  "success": true,
  "chatId": "254722833440@c.us",
  "tag": "SOMO",
  "attempt": {
    "moduleId": 1,
    "sectionId": "quiz-1",
    "attemptNumber": 1,
    "success": true
  },
  "updatedMetrics": {
    "difficultyScore": 0.2,
    "engagementScore": 0.85,
    "masteryConfidence": 0.9
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
  progressPercent: number;          // 0-100
  lastAccessedAt?: string;          // ISO 8601
  completedAt?: string;             // ISO 8601

  // Feedback signals
  attempts?: ModuleAttempt[];
  difficultyScore?: number;         // 0-1 (higher = harder)
  engagementScore?: number;         // 0-1 (higher = more engaged)
  masteryConfidence?: number;       // 0-1 (confidence in mastery)
  avgTimePerSection?: number;       // Seconds
  feedbackQuestions?: LearningQuestion[];
}
```

### ModuleAttempt

```typescript
interface ModuleAttempt {
  sectionId: string;
  startedAt: string;               // ISO 8601
  completedAt: string | null;      // ISO 8601, null if abandoned
  durationSeconds: number;
  success: boolean;
  score?: number;                  // 0-100
  hintsUsed?: number;
  askedForHelp?: boolean;
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
  lastActivityAt: string;          // ISO 8601

  // Aggregated feedback signals
  avgDifficulty?: number;          // 0-1
  overallEngagement?: number;      // 0-1
  totalQuestionsAsked?: number;
  repeatQuestionRate?: number;     // 0-1
  avgSessionDuration?: number;     // Seconds
  learningVelocity?: number;       // Sections per hour
}
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "success": false,
  "error": "Error message here"
}
```

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `tag query parameter is required` | Missing tag in query |
| 400 | `tag is required in request body` | Missing tag in body |
| 400 | `moduleId is required` | Missing moduleId for attempt |
| 401 | `Invalid API key` | Wrong or missing X-API-Key |
| 404 | `User not found` | chatId doesn't exist |
| 404 | `No learning data for tag` | User not enrolled in tag |
| 500 | `Internal server error` | Server error (check logs) |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| GET requests | 100/minute |
| POST requests | 50/minute |
| Per chatId | 20/minute |

---

## Examples

### cURL: Update Progress

```bash
curl -X POST "http://localhost:3001/service/progress/254722833440@c.us" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "tag": "SOMO",
    "moduleId": 2,
    "sectionCompleted": "Creating a Budget"
  }'
```

### cURL: Get Progress

```bash
curl "http://localhost:3001/service/progress/254722833440@c.us?tag=SOMO&includeFeedback=true" \
  -H "X-API-Key: your-api-key"
```

### JavaScript: Fetch Progress

```javascript
const response = await fetch(
  `${API_URL}/service/progress/${chatId}?tag=SOMO`,
  {
    headers: { 'X-API-Key': API_KEY }
  }
);
const data = await response.json();
console.log(`Progress: ${data.learning.overallProgress}%`);
```

### n8n: HTTP Request Node

```json
{
  "parameters": {
    "method": "POST",
    "url": "http://whatsapp-service:3001/service/progress/={{ $json.from }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        { "name": "tag", "value": "SOMO" },
        { "name": "moduleId", "value": "={{ $json.moduleId }}" },
        { "name": "sectionCompleted", "value": "={{ $json.section }}" }
      ]
    }
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-30 | Added feedback signals, /attempt endpoint |
| 1.0 | 2026-01-15 | Initial release |

---

## Related Documentation

- [Developer Guide](../guides/03-saving-learning-progress.md) - Practical examples
- [Memory Schema](../architecture/05-memory-schema-enhancements.md) - Feedback signals architecture
- [Service API Reference](03-service-api-reference.md) - All service endpoints
