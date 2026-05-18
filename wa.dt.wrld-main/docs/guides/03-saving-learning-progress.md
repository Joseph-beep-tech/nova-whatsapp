# Saving Learning Progress - Developer Guide

A practical guide for tracking user learning progress in WhatsApp-based courses.

---

## Quick Start

**The basics:** Every user (`chatId`) can have progress in multiple programs (`tag`). Each program has modules, and each module has sections.

```
User: 254722833440@c.us
  └── Tag: SOMO
  │     ├── Module 1: "Intro to Savings" → 100% complete
  │     └── Module 2: "Budgeting" → 50% complete (current)
  └── Tag: HEALTH
        └── Module 1: "Nutrition Basics" → 25% complete
```

---

## Method 1: Direct Database (Backend Code)

Use `stateManager` when you're writing TypeScript code inside the service.

### Initialize Learning Data

When a user first joins a program:

```typescript
import { stateManager } from '../utils/stateManager';

// User just enrolled in SOMO program
const chatId = '254722833440@c.us';

const learningData = await stateManager.initializeLearningData(chatId, {
  tag: 'SOMO',
  lms: {
    contentCollection: {
      url: 'https://qdrant.example.com',
      collectionName: 'somo_content',
    },
  },
});

console.log(learningData);
// {
//   tag: 'SOMO',
//   moduleProgress: {},
//   overallProgress: 0,
//   totalInteractions: 0,
//   engagedTopics: [],
//   lastActivityAt: '2026-01-30T10:00:00.000Z',
//   ...
// }
```

### Track a Section Completion

User just finished reading "Why Save?" in Module 1:

```typescript
const result = await stateManager.updateLearningProgress(
  '254722833440@c.us',
  'SOMO',
  {
    moduleId: 1,
    sectionCompleted: 'Why Save?',
  }
);

console.log(result.moduleProgress['1']);
// {
//   moduleId: 1,
//   status: 'in_progress',
//   completedSections: ['Why Save?'],
//   progressPercent: 33,  // 1 of 3 sections
//   lastAccessedAt: '2026-01-30T10:15:00.000Z'
// }
```

### Mark Module as Complete

User finished all sections and passed the quiz:

```typescript
await stateManager.updateLearningProgress(
  '254722833440@c.us',
  'SOMO',
  {
    moduleId: 1,
    moduleCompleted: true,
    metadata: {
      quizScore: 85,
      completionTime: '45 minutes',
    },
  }
);
```

### Track an Interaction

User asked about budgeting (section detection happened elsewhere):

```typescript
await stateManager.trackLearningInteraction(
  '254722833440@c.us',
  'SOMO',
  2,                    // moduleId
  'Creating a Budget'   // section title
);

// This increments totalInteractions
// Adds 'Creating a Budget' to engagedTopics
// Updates lastActivityAt
// Sets currentModuleId to 2
```

### Get Current Progress

```typescript
const progress = await stateManager.getLearningData(
  '254722833440@c.us',
  'SOMO'
);

if (progress) {
  console.log(`Overall: ${progress.overallProgress}%`);
  console.log(`Current module: ${progress.currentModuleId}`);
  console.log(`Topics engaged: ${progress.engagedTopics.join(', ')}`);
}
```

---

## Method 2: HTTP API (n8n / External)

Use the REST API when calling from n8n workflows or external services.

### Update Progress

```http
POST /service/progress/254722833440@c.us
Content-Type: application/json
X-API-Key: your-api-key

{
  "tag": "SOMO",
  "moduleId": 2,
  "sectionCompleted": "Income vs Expenses"
}
```

**Response:**
```json
{
  "success": true,
  "chatId": "254722833440@c.us",
  "tag": "SOMO",
  "updated": {
    "moduleId": 2,
    "sectionCompleted": "Income vs Expenses",
    "newProgressPercent": 25
  }
}
```

### n8n HTTP Request Node

```json
{
  "method": "POST",
  "url": "http://whatsapp-service:3001/service/progress/{{ $json.from }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "body": {
    "tag": "SOMO",
    "moduleId": "{{ $json.detectedModuleId }}",
    "sectionCompleted": "{{ $json.detectedSection }}"
  }
}
```

### Get Progress

```http
GET /service/progress/254722833440@c.us?tag=SOMO
X-API-Key: your-api-key
```

---

## Realistic Examples

### Example 1: User Reads a Lesson

User sends: *"Tell me about savings"*

Your workflow detects this matches Module 1, Section "Why Save?":

```typescript
// In message handler
async function handleLearningMessage(chatId: string, message: string) {
  // 1. Detect which content they're asking about
  const match = await detectLearningContent(message, 'SOMO');

  if (match && match.confidence > 0.7) {
    // 2. Track the interaction
    await stateManager.trackLearningInteraction(
      chatId,
      'SOMO',
      match.moduleId,
      match.sectionTitle
    );

    // 3. Return the content
    return getContentForSection(match.moduleId, match.sectionTitle);
  }
}
```

### Example 2: User Completes a Quiz

User just scored 85% on Module 1 quiz:

```typescript
async function handleQuizCompletion(
  chatId: string,
  moduleId: number,
  score: number
) {
  const passed = score >= 70;

  await stateManager.updateLearningProgress(chatId, 'SOMO', {
    moduleId,
    moduleCompleted: passed,
    metadata: {
      quizScore: score,
      quizAttempts: 1,
      quizPassedAt: passed ? new Date().toISOString() : undefined,
    },
  });

  if (passed) {
    // Move to next module
    await stateManager.updateLearningProgress(chatId, 'SOMO', {
      currentModuleId: moduleId + 1,
    });
    return `Great job! You scored ${score}%. Moving to Module ${moduleId + 1}!`;
  } else {
    return `You scored ${score}%. You need 70% to pass. Want to review the material?`;
  }
}
```

### Example 3: Admin Dashboard Query

Get all learners struggling with Module 2:

```typescript
async function getStrugglingLearners(tag: string, moduleId: number) {
  const users = await stateManager.getUsersByTag(tag);

  const struggling = [];

  for (const user of users) {
    const progress = await stateManager.getLearningData(user.chatId, tag);
    if (!progress) continue;

    const moduleProgress = progress.moduleProgress[String(moduleId)];
    if (moduleProgress) {
      // Check for struggle indicators
      const isStruggling =
        moduleProgress.difficultyScore > 0.7 ||
        (moduleProgress.attempts?.length || 0) > 3 ||
        (progress.repeatQuestionRate || 0) > 0.5;

      if (isStruggling) {
        struggling.push({
          chatId: user.chatId,
          name: user.name || user.pushname,
          difficultyScore: moduleProgress.difficultyScore,
          attempts: moduleProgress.attempts?.length || 0,
        });
      }
    }
  }

  return struggling;
}
```

### Example 4: Tracking Difficulty with Feedback Signals

When a user struggles (asks multiple questions, takes long):

```typescript
import { ModuleAttempt, LearningQuestion } from '../types/learning/progress';

async function recordModuleAttempt(
  chatId: string,
  tag: string,
  moduleId: number,
  attempt: ModuleAttempt
) {
  const progress = await stateManager.getLearningData(chatId, tag);
  if (!progress) return;

  const moduleKey = String(moduleId);
  const existing = progress.moduleProgress[moduleKey];

  // Calculate new difficulty score based on attempts
  const attempts = [...(existing?.attempts || []), attempt];
  const failedAttempts = attempts.filter(a => !a.success).length;
  const difficultyScore = Math.min(failedAttempts / attempts.length, 1);

  // Calculate engagement score
  const totalTime = attempts.reduce((sum, a) => sum + a.durationSeconds, 0);
  const avgTimePerAttempt = totalTime / attempts.length;
  const engagementScore = Math.min(avgTimePerAttempt / 300, 1); // 5 min = 1.0

  await stateManager.updateLearningProgress(chatId, tag, {
    moduleId,
    metadata: {
      attempts,
      difficultyScore,
      engagementScore,
      masteryConfidence: attempt.success ? 0.8 : 0.3,
    },
  });
}

// Usage:
await recordModuleAttempt('254722833440@c.us', 'SOMO', 1, {
  sectionId: 'quiz-1',
  startedAt: '2026-01-30T10:00:00Z',
  completedAt: '2026-01-30T10:15:00Z',
  durationSeconds: 900,
  success: true,
  score: 85,
  hintsUsed: 2,
  askedForHelp: false,
});
```

---

## Data Structure Reference

### User Identification

| Field | Example | Description |
|-------|---------|-------------|
| `chatId` | `254722833440@c.us` | WhatsApp chat ID (phone + @c.us) |
| `tag` | `SOMO` | Program/business identifier |

### Module Progress Fields

```typescript
{
  moduleId: 1,                           // Module identifier
  moduleName: 'Intro to Savings',        // Display name
  status: 'in_progress',                 // 'not_started' | 'in_progress' | 'completed'
  completedSections: ['Why Save?'],      // Sections user finished
  totalSections: 3,                      // Total sections in module
  progressPercent: 33,                   // 0-100
  lastAccessedAt: '2026-01-30T10:00:00Z',
  completedAt: null,                     // Set when status = 'completed'

  // Feedback signals (optional)
  attempts: [...],                       // ModuleAttempt[]
  difficultyScore: 0.3,                  // 0-1 (higher = harder for user)
  engagementScore: 0.8,                  // 0-1 (higher = more engaged)
  masteryConfidence: 0.7,                // 0-1 (confidence in mastery)
  avgTimePerSection: 180,                // Seconds
  feedbackQuestions: [...],              // LearningQuestion[]
}
```

### User Learning Data Fields

```typescript
{
  tag: 'SOMO',
  moduleProgress: { '1': {...}, '2': {...} },
  currentModuleId: 2,
  overallProgress: 45,                   // 0-100, avg of all modules
  totalInteractions: 27,                 // Total messages/actions
  engagedTopics: ['savings', 'budgeting'],
  inferredLevel: 'beginner',             // 'beginner' | 'intermediate' | 'advanced'
  lastActivityAt: '2026-01-30T10:00:00Z',

  // Aggregated feedback signals (optional)
  avgDifficulty: 0.4,                    // Avg across all modules
  overallEngagement: 0.7,
  totalQuestionsAsked: 12,
  repeatQuestionRate: 0.2,               // 0-1 (higher = more confusion)
  avgSessionDuration: 1200,              // Seconds
  learningVelocity: 2.5,                 // Sections per hour
}
```

---

## Common Patterns

### Pattern: Auto-detect Module from Message

```typescript
async function detectAndTrack(chatId: string, message: string, tag: string) {
  // Search content collection for matching section
  const results = await qdrantHandler.hybridSearch({
    query: message,
    chatId,
    tag,
    strategy: 'hybrid',
    limit: 1,
  }, `${tag.toLowerCase()}-content`);

  if (results.length > 0 && results[0].score > 0.7) {
    const match = results[0].message;

    await stateManager.trackLearningInteraction(
      chatId,
      tag,
      match.metadata?.moduleId as number,
      match.metadata?.sectionTitle as string
    );

    return match;
  }

  return null;
}
```

### Pattern: Progress Summary for LLM Context

```typescript
async function getProgressSummary(chatId: string, tag: string): string {
  const progress = await stateManager.getLearningData(chatId, tag);

  if (!progress) {
    return 'This is a new learner with no previous progress.';
  }

  const completed = Object.values(progress.moduleProgress)
    .filter(m => m.status === 'completed')
    .map(m => m.moduleName);

  const current = progress.moduleProgress[String(progress.currentModuleId)];

  return `
Learner Progress:
- Overall: ${progress.overallProgress}% complete
- Completed: ${completed.join(', ') || 'None yet'}
- Currently on: ${current?.moduleName || 'Not started'}
- Sections done in current module: ${current?.completedSections.join(', ') || 'None'}
- Topics they've discussed: ${progress.engagedTopics.slice(0, 5).join(', ')}
- Level: ${progress.inferredLevel || 'beginner'}
`.trim();
}
```

### Pattern: Check if User Needs Help

```typescript
async function needsIntervention(chatId: string, tag: string): boolean {
  const progress = await stateManager.getLearningData(chatId, tag);
  if (!progress) return false;

  // Check for struggle signals
  const struggles = [
    progress.repeatQuestionRate > 0.5,           // Asking same things
    progress.avgDifficulty > 0.7,                // Finding it hard
    progress.overallEngagement < 0.3,            // Not engaging
    progress.learningVelocity < 0.5,             // Very slow progress
  ];

  return struggles.filter(Boolean).length >= 2;
}
```

---

## Troubleshooting

### "User not found"

The user must exist before you can save progress. Register them first:

```typescript
await stateManager.registerUser(chatId, {
  tags: ['SOMO'],
});
```

### Progress not updating

Check that the `tag` matches exactly (case-sensitive):

```typescript
// Wrong - case mismatch
await stateManager.getLearningData(chatId, 'somo');

// Correct
await stateManager.getLearningData(chatId, 'SOMO');
```

### Module not showing in progress

Initialize learning data first:

```typescript
await stateManager.initializeLearningData(chatId, tagConfig);
```

---

## Related Docs

- [Learning Progress API Reference](../whatsapp/06-learning-progress-api.md) - Full API spec
- [Memory Schema Enhancements](../architecture/05-memory-schema-enhancements.md) - Feedback signals architecture
- [Developer API Guide](../whatsapp/05-developer-api-guide.md) - General API guide
