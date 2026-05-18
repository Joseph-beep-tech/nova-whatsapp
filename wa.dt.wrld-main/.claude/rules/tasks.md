# Task Management System

## Overview

This project uses a structured task tracking system via `tasks.json` in the project root, with automatic changelog generation for milestone changes.

**Design Principle**: Each task should be completable within a single context window. Complex work is broken into smaller, self-contained subtasks with explicit context requirements.

## Task ID Format

Every task has a unique ID in the format: `{index}-{timestamp}-{slug}`

```
001-20260110-n8n-data-extraction-fix
002-20260110-workflow-versioning-fix
007-20260112-phase1-enhancement
```

| Component | Description | Example |
|-----------|-------------|---------|
| `index` | Global sequential counter (zero-padded, 3 digits) | `001`, `002`, `015` |
| `timestamp` | YYYYMMDD when task was created | `20260110` |
| `slug` | URL-friendly description (kebab-case) | `n8n-data-extraction-fix` |

**Subtask IDs** use decimal notation: `{parent-index}.{seq}-{slug}`

```
007.1-research
007.2-implement
007.3-integrate
```

**Rules:**
- Index is global across all milestones (never resets)
- IDs are immutable once assigned
- Slugs should be concise (3-5 words max)

## Archive System

Completed tasks are archived by version/milestone to keep `tasks.json` focused on active work.

### Structure

```
.archive/
  v0.1.0/
    tasks.json   # All completed tasks from v0.1.0
  v1.0.0/
    tasks.json   # All completed tasks from v1.0.0

package.json     # version field = current milestone
tasks.json       # Only active tasks (passes: false)
```

### Key Rules

1. **Version = Milestone**: `package.json` version determines current milestone
2. **Immutable Archives**: Once archived, files in `.archive/` are never edited
3. **Forward References Only**: New tasks reference old tasks, not vice versa
4. **Archive Trigger**: On version bump, move all `passes: true` tasks to `.archive/{old-version}/tasks.json`

### Archival Workflow

1. Complete tasks in `tasks.json` (set `passes: true`)
2. When ready for release, bump version in `package.json`
3. Move all `passes: true` tasks to `.archive/{old-version}/tasks.json`
4. Keep pending tasks in `tasks.json` for next version
5. Cancelled tasks: set `"cancelled": true"` or remove manually

## Task File Format

Location: `/tasks.json`

### Simple Task

```json
{
  "id": "015-20260112-short-task-description",
  "description": "Short task description",
  "type": "feature",
  "priority": 5,
  "status": "active",
  "milestone": "v1.1",
  "references": ["003-20260110-related-task"],
  "context": {
    "files": ["src/handlers/MessageHandler.ts", "src/types/webhook.ts"],
    "docs": ["docs/whatsapp/02-api-reference.md"],
    "summary": "MessageHandler processes webhooks, webhook.ts defines payload types"
  },
  "tasks": [
    "Step 1 to complete",
    "Step 2 to complete"
  ],
  "verification": [
    "How to verify the task is complete"
  ],
  "changelog": "Added feature X for improved Y",
  "passes": false
}
```

### Complex Task (With Subtasks)

```json
{
  "id": "016-20260112-complex-feature",
  "description": "Complex feature requiring multiple subtasks",
  "type": "feature",
  "priority": 1,
  "status": "active",
  "milestone": "v1.1",
  "subtasks": [
    {
      "id": "016.1-research",
      "description": "Research existing implementation",
      "context": {
        "files": ["src/index.ts", "package.json"],
        "summary": "Entry point and dependencies"
      },
      "tasks": ["Read current implementation", "Identify extension points"],
      "verification": ["Document findings in task notes"],
      "output": "Understanding of current architecture",
      "passes": false
    },
    {
      "id": "016.2-implement",
      "description": "Implement core functionality",
      "depends_on": ["016.1-research"],
      "context": {
        "files": ["src/handlers/", "src/types/"],
        "prior_output": "016.1-research findings"
      },
      "tasks": ["Create new handler", "Add type definitions"],
      "verification": ["Unit tests pass", "Type check passes"],
      "output": "Working handler with tests",
      "passes": false
    },
    {
      "id": "016.3-integrate",
      "description": "Integrate and document",
      "depends_on": ["016.2-implement"],
      "context": {
        "files": ["src/index.ts", "README.md"],
        "prior_output": "016.2-implement handler"
      },
      "tasks": ["Wire up handler", "Update documentation"],
      "verification": ["Integration test passes", "Docs updated"],
      "passes": false
    }
  ],
  "changelog": "Added complex feature X",
  "passes": false
}
```

## Field Definitions

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier: `{index}-{timestamp}-{slug}` (see Task ID Format) |
| `description` | string | Short (3-10 word) summary of the task |
| `type` | string | Task category (see Task Types below) |
| `tasks` | string[] | Ordered list of specific steps to complete |
| `verification` | string[] | Steps to verify the task is complete |
| `passes` | boolean | `true` when all tasks and verification complete |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `priority` | number \| null | Decimal execution order (1, 2, 2.1, 3). Lower = higher priority. `null` = unprioritized |
| `status` | string | Task state: `active`, `in_progress`, `blocked`, or `cancelled` |
| `milestone` | string | Version or milestone grouping (e.g., `v1.1`, `phase-2`) |
| `scope` | string | Directory scope (e.g., `packages/whatsapp-n8n-nodes`, `n8n-workflows`, `docs`) |
| `changelog` | string | Entry for CHANGELOG.md (if omitted, not added to changelog) |
| `blocked_by` | string | Description of blocker or dependency |
| `references` | string[] | IDs of related tasks (forward-only: new tasks reference old) |
| `context` | object | Files and knowledge needed for this task (see Context Object) |
| `subtasks` | array | Ordered list of subtasks (see Subtask Object) |

### Context Object

The `context` field specifies exactly what information is needed to complete the task within one context window:

| Field | Type | Description |
|-------|------|-------------|
| `files` | string[] | Specific files or glob patterns to read |
| `docs` | string[] | Documentation files for reference |
| `summary` | string | Brief explanation of what's in those files |
| `prior_output` | string | Reference to output from a previous subtask |

### Subtask Object

For complex tasks, `subtasks` breaks work into context-window-sized units:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier: `{parent-index}.{seq}-{slug}` (e.g., `007.1-research`) |
| `description` | string | Short (3-10 word) summary of what this subtask accomplishes |
| `depends_on` | string[] | IDs of subtasks that must complete first |
| `references` | string[] | IDs of related tasks (forward-only references) |
| `context` | object | Context needed for this specific subtask |
| `tasks` | string[] | Ordered list of specific steps to complete |
| `verification` | string[] | How to verify this subtask is done |
| `output` | string | What this subtask produces for subsequent subtasks |
| `passes` | boolean | `true` when this subtask is complete |

## Task Types

| Type | Description | Changelog Section |
|------|-------------|-------------------|
| `fix` | Bug fixes | Fixed |
| `feature` | New functionality | Added |
| `improvement` | Enhancements to existing features | Changed |
| `docs` | Documentation changes | Documentation |
| `refactor` | Code restructuring (no behavior change) | Changed |
| `chore` | Maintenance, dependencies, tooling | Maintenance |
| `security` | Security-related changes | Security |

## Workflow

### Creating New Tasks

1. Read current `tasks.json`
2. Assess complexity: Does this need more than 8 files? Multiple concerns?
3. **Simple task**: Add with `tasks`, `verification`, `context`
4. **Complex task**: Break into `subtasks` with individual contexts
5. Set `type` based on task category
6. Add `changelog` entry if task should appear in CHANGELOG.md
7. Write updated array back to file

### Executing Simple Tasks

1. Find first task where `passes: false` (respect `priority` if set)
2. Read files listed in `context.files` and `context.docs`
3. Execute each item in `tasks` array sequentially
4. Run each item in `verification` array
5. If all verification passes, set `passes: true`
6. Update `tasks.json`
7. If `changelog` field exists, add entry to CHANGELOG.md

### Executing Complex Tasks (Subtasks)

1. Find first task with `subtasks` where parent `passes: false`
2. Find first subtask where `passes: false` and all `depends_on` are complete
3. **Start new context window** (fresh context)
4. Read only files in subtask's `context.files`
5. Read `prior_output` from previous subtask if specified
6. Execute subtask's `tasks` array
7. Run subtask's `verification` array
8. If verification passes:
   - Set subtask `passes: true`
   - Record output in `output` field for next subtask
9. Update `tasks.json`
10. If all subtasks pass, set parent task `passes: true`

### Starting a New Subtask

When beginning a subtask in a fresh context:

1. Read the subtask definition from `tasks.json`
2. Load only the files in `context.files`
3. If `prior_output` exists, that's your starting point
4. Execute tasks without loading unrelated context
5. Record what you produced in `output` for the next subtask

### Task Approval Flow

1. Describe task with `tasks` and `verification` arrays
2. For complex tasks, present subtask breakdown for approval
3. Wait for user approval before execution
4. Execute task/subtask steps
5. Run verification
6. Mark `passes: true` only after user confirms success

## Task Execution Order

Tasks execute in this order:

1. **Resolve dependencies first** - If task A depends on task B, B executes before A regardless of priority
2. **Sort by priority ascending** - Among independent tasks, lower numbers execute first (1 before 2.1 before 3)
3. **Null priorities last** - Unprioritized tasks (`priority: null`) execute after all prioritized tasks
4. **No automatic tie-breaking** - Two tasks with identical priority is a planning error; manually assign unique values

Example execution order for:
```json
[
  { "id": "A", "priority": 3 },
  { "id": "B", "priority": 1, "depends_on": ["C"] },
  { "id": "C", "priority": 5 },
  { "id": "D", "priority": 2.1 },
  { "id": "E", "priority": null }
]
```

Execution: C → B → D → A → E
(C first due to dependency, then B, then D/A by priority, E last as unprioritized)

## Status Values

| Status | Meaning | When to Use |
|--------|---------|-------------|
| `active` | Task is ready to start | Default for new tasks, not yet begun |
| `in_progress` | Currently being worked on | **Resume point** - new conversations continue here |
| `blocked` | Waiting on external factor | Dependencies, user decision, external system |
| `cancelled` | Task abandoned | Requirements changed, no longer needed |

**Conversation Continuity**: When resuming work in a new context window, look for tasks with `status: "in_progress"` to identify where to continue. Only one task (or subtask) should be `in_progress` at a time.

Status is independent of `passes`:
- `active` + `passes: false` = ready to start
- `in_progress` + `passes: false` = actively being worked on
- `active` + `passes: true` = completed (status should update to reflect completion)

## Rules

1. **Never skip verification** - All verification steps must pass before marking `passes: true`
2. **Atomic updates** - Update `tasks.json` after each task completion, not in batches
3. **Archive on release** - Move completed tasks to `.archive/{version}/` on version bump
4. **Immutable archives** - Never edit files in `.archive/` once created
5. **Forward references only** - New tasks reference old tasks, not vice versa
6. **User confirmation** - For tasks affecting external systems, confirm with user before marking complete
7. **Failure handling** - If verification fails, do not mark `passes: true`; document the failure
8. **Type and ID required** - Every task must have `type` and `id` fields
9. **Changelog discipline** - Only significant changes get `changelog` entries

## CHANGELOG.md Integration

### Format

The changelog follows [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

### Added
- New feature description

### Changed
- Improvement or refactor description

### Fixed
- Bug fix description

### Documentation
- Documentation change description

## [v1.0.0] - 2026-01-10

### Added
- Initial release features
```

### Rules

1. **Update on completion** - When a task with `changelog` field passes, add entry to CHANGELOG.md
2. **Use Unreleased section** - New entries go under `[Unreleased]` until release
3. **Group by type** - Entries grouped by task type (Added, Changed, Fixed, etc.)
4. **Summarize** - Changelog entries should be user-facing summaries, not technical details
5. **Release process** - When releasing, move `[Unreleased]` items to new version section

### Mapping Task Types to Changelog Sections

```
fix        → ### Fixed
feature    → ### Added
improvement → ### Changed
docs       → ### Documentation
refactor   → ### Changed
chore      → ### Maintenance
security   → ### Security
```

## Integration with Documentation

When tasks are completed:
1. Add learnings to relevant documentation in `docs/`
2. Update `docs/guides/` if new debugging patterns discovered
3. Archive completed tasks to `.archive/{version}/` on release (see Archive System)
4. Update CHANGELOG.md if `changelog` field exists

## Example Usage

### Simple Feature Task

```json
{
  "description": "Add WhatsApp echo reply bot",
  "type": "feature",
  "priority": 1,
  "status": "active",
  "milestone": "v1.1",
  "context": {
    "files": ["n8n-workflows/echo-bot.json"],
    "docs": ["docs/n8n/01-n8n-integration-v2.md"],
    "summary": "n8n workflow JSON format, webhook trigger and HTTP Request node patterns"
  },
  "tasks": [
    "Create n8n workflow with webhook trigger",
    "Add Code node for data extraction",
    "Add IF node to filter incoming messages",
    "Add HTTP Request node for echo reply"
  ],
  "verification": [
    "Send WhatsApp message to bot number",
    "Receive echo reply within 5 seconds",
    "Check n8n execution logs show success",
    "docs/n8n/ updated with echo bot workflow documentation"
  ],
  "changelog": "Added WhatsApp echo reply bot with n8n integration",
  "passes": false
}
```

### Bug Fix Task

```json
{
  "description": "Fix duplicate message responses",
  "type": "fix",
  "priority": 1,
  "status": "active",
  "context": {
    "files": ["n8n-workflows/echo-bot.json"],
    "summary": "IF node condition needs fromMe filter"
  },
  "tasks": [
    "Add fromMe filter to IF node",
    "Update condition to check message_create AND fromMe === false"
  ],
  "verification": [
    "Send message to bot",
    "Receive exactly 1 reply (not 2)",
    "docs/guides/ updated with fromMe filter debugging pattern"
  ],
  "changelog": "Fixed duplicate message responses in echo bot",
  "passes": false
}
```

### Complex Feature Task (With Subtasks)

```json
{
  "description": "Add group message handler with admin commands",
  "type": "feature",
  "priority": 1,
  "status": "active",
  "milestone": "v1.2",
  "scope": "packages/whatsapp-service",
  "subtasks": [
    {
      "id": "1-research",
      "description": "Research group message structure",
      "context": {
        "files": ["packages/whatsapp-service/src/types/WhatsApp.ts"],
        "docs": ["docs/whatsapp/02-api-reference.md"],
        "summary": "Understand group message payload structure"
      },
      "tasks": [
        "Read WhatsApp type definitions",
        "Identify group-specific fields (isGroupMsg, groupMetadata)",
        "Document message flow for groups vs DMs"
      ],
      "verification": ["Can explain group message structure"],
      "output": "Group messages have isGroupMsg=true, author field for sender, groupMetadata for group info",
      "passes": false
    },
    {
      "id": "2-types",
      "description": "Define group handler types",
      "depends_on": ["1-research"],
      "context": {
        "files": ["packages/whatsapp-service/src/types/webhook.ts"],
        "prior_output": "Group message structure from 1-research"
      },
      "tasks": [
        "Add GroupMessageData interface",
        "Add AdminCommand type union",
        "Add GroupHandlerConfig interface"
      ],
      "verification": ["npm run type-check passes"],
      "output": "Types in webhook.ts: GroupMessageData, AdminCommand, GroupHandlerConfig",
      "passes": false
    },
    {
      "id": "3-handler",
      "description": "Implement group message handler",
      "depends_on": ["2-types"],
      "context": {
        "files": [
          "packages/whatsapp-service/src/handlers/MessageHandler.ts",
          "packages/whatsapp-service/src/types/webhook.ts"
        ],
        "prior_output": "Types from 2-types"
      },
      "tasks": [
        "Create GroupHandler class",
        "Add isGroupMessage() guard",
        "Implement handleAdminCommand() for /kick, /ban, /mute"
      ],
      "verification": ["Unit tests pass", "Type check passes"],
      "output": "GroupHandler with admin command support",
      "passes": false
    },
    {
      "id": "4-integrate",
      "description": "Wire up and document",
      "depends_on": ["3-handler"],
      "context": {
        "files": [
          "packages/whatsapp-service/src/index.ts",
          "docs/whatsapp/02-api-reference.md"
        ],
        "prior_output": "GroupHandler from 3-handler"
      },
      "tasks": [
        "Register GroupHandler in Express routes",
        "Add configuration for enabling/disabling",
        "Document admin commands in API reference"
      ],
      "verification": [
        "Send /kick command in group",
        "Bot responds appropriately",
        "docs/whatsapp/ updated with admin command documentation"
      ],
      "passes": false
    }
  ],
  "changelog": "Added group message handler with admin commands (/kick, /ban, /mute)",
  "passes": false
}
```

### Documentation Task (No Changelog)

```json
{
  "description": "Update API documentation",
  "type": "docs",
  "context": {
    "files": ["docs/whatsapp/02-api-reference.md"],
    "summary": "Main API reference file"
  },
  "tasks": [
    "Add new endpoint documentation",
    "Update examples with correct payload format"
  ],
  "verification": [
    "All code examples are valid",
    "No broken links in documentation"
  ],
  "passes": false
}
```

### Improvement Task

```json
{
  "description": "Reorganize docs with indexed filenames",
  "type": "improvement",
  "milestone": "v1.1",
  "context": {
    "files": ["docs/"],
    "summary": "Documentation directory structure"
  },
  "tasks": [
    "Rename docs files with index prefixes",
    "Update all cross-references",
    "Update docs/README.md index"
  ],
  "verification": [
    "All links resolve correctly",
    "Index numbers reflect reading order"
  ],
  "changelog": "Reorganized documentation with indexed file naming convention",
  "passes": false
}
```

## Subtask Design Principles

### What is a Subtask?

A subtask is a self-contained unit of work completable within a single context window. Each subtask:

1. **Has explicit context** - `context.files` and `context.docs` list exactly what to read
2. **Produces a clear output** - `output` field describes what the next subtask can use
3. **Is independently verifiable** - `verification` array confirms completion
4. **Minimizes context switching** - Focuses on one concern

### Subtask Sizing Guidelines

| Complexity | Files | Typical Tasks | Example |
|------------|-------|---------------|---------|
| **Small** | 1-3 files | Single change, fix, or addition | Add validation to one handler |
| **Medium** | 4-8 files | Feature in one module | New endpoint with types and tests |
| **Large** | 8+ files | Cross-cutting change | Requires breaking into subtasks |

**Rule of thumb**: If you need to read more than 8 files, break into subtasks.

### Breaking Down Complex Tasks

1. **Identify natural boundaries** - Research → Design → Implement → Test → Document
2. **Define outputs** - What does each subtask produce that the next needs?
3. **Minimize overlap** - Each subtask should touch different files when possible
4. **Front-load context** - First subtask gathers information, later subtasks execute

### Standard Subtask Breakdown Pattern

For complex features, use this proven pattern:

| Subtask | context.files | output | verification |
|---------|--------------|--------|--------------|
| **1-research** | Architecture docs, existing code | Understanding, extension points | Can explain approach |
| **2-types** | Existing types, 1-research output | New type definitions | `npm run type-check` passes |
| **3-implement** | Types from 2-types, target files | Working code | Unit tests pass |
| **4-integrate** | Implementation from 3, docs | Wired up and documented | E2E test passes, docs updated |

### Context Handoff Between Subtasks

The `output` field serves as the handoff. When starting a new subtask:

1. Read the `prior_output` reference from context
2. This tells you what the previous subtask produced
3. Continue from that point without re-reading all previous context

Example subtask context:
```json
{
  "context": {
    "files": ["src/handlers/NewHandler.ts"],
    "prior_output": "2-types created NewHandler with sendMessage method",
    "summary": "Add error handling to existing handler"
  }
}
```

## Task Patterns

### Debugging Tasks (type: fix)
Structure as: Diagnose → Test → Fix → Document

For complex bugs, use subtasks:
```json
{
  "subtasks": [
    { "id": "1-reproduce", "description": "Reproduce and isolate bug", "output": "Minimal reproduction steps" },
    { "id": "2-diagnose", "description": "Find root cause", "output": "Root cause identified" },
    { "id": "3-fix", "description": "Implement fix", "output": "Fix applied" },
    { "id": "4-verify", "description": "Verify fix and add regression test", "output": "Test added" }
  ]
}
```

### Deployment Tasks (type: chore)
Include verification that confirms actual system behavior, not just deployment success.

### Multi-System Integration Tasks (type: feature)
Verify each system independently before testing the integration path.

Break into per-system subtasks:
```json
{
  "subtasks": [
    { "id": "1-api", "description": "Implement API changes", "output": "API endpoint ready" },
    { "id": "2-frontend", "description": "Implement frontend changes", "output": "UI connected to API" },
    { "id": "3-integration", "description": "E2E integration testing", "output": "Integration verified" }
  ]
}
```

### Documentation Tasks (type: docs)
Usually no changelog entry unless it's a significant documentation milestone.

### Feature Tasks (type: feature)
Standard feature breakdown:
```json
{
  "subtasks": [
    { "id": "1-research", "description": "Research existing patterns", "output": "Approach documented" },
    { "id": "2-types", "description": "Define types and interfaces", "output": "Types created" },
    { "id": "3-core", "description": "Implement core logic", "output": "Core functionality working" },
    { "id": "4-tests", "description": "Add test coverage", "output": "Tests passing" },
    { "id": "5-docs", "description": "Update documentation", "output": "Docs updated" }
  ]
}
```

## Verification Best Practices

1. **User-facing verification** - Include a step the user can verify themselves
2. **Specific commands** - Include exact curl/CLI commands when applicable
3. **Expected outcomes** - State what success looks like (e.g., "Receive exactly 1 reply, not 2")
4. **Log checks** - Include log verification for backend changes

## Documentation Verification

Every task that introduces user-facing changes should include a verification step for documentation in the `docs/` folder.

### Required For

| Type | Doc Verification Required? | Target Folder |
|------|---------------------------|---------------|
| `feature` | **Yes** | Relevant `docs/` subfolder |
| `fix` | If new debugging pattern discovered | `docs/guides/` |
| `improvement` | If user-facing | Relevant `docs/` subfolder |
| `refactor` | If architectural changes | `docs/architecture/` |
| `docs` | Self-verifying | Target folder |
| `chore` | Usually no | Only if tooling/setup |
| `security` | Yes | `docs/` security section |

### Exempt

- `chore` tasks (internal tooling) - unless they affect setup/configuration docs
- Pure refactors with no behavior change
- Internal-only fixes

### Format

Include the docs folder path in verification:

```json
"verification": [
  "Feature works correctly",
  "docs/n8n/ updated with new operation examples"
]
```

### Validation Query

```bash
# List feature tasks without doc verification (review manually)
jq '[.[] | select(.type == "feature" and ([.verification[] | select(startswith("docs/"))] | length == 0))] | .[].id' tasks.json
```

## Priority Guidelines

| Range | When to Use | Example |
|-------|-------------|---------|
| 1-10 | Blocking issues, critical bugs, user-requested features | `"priority": 1` |
| 11-50 | Standard feature work, improvements | `"priority": 25` |
| 51-100 | Nice-to-have, future enhancements, tech debt | `"priority": 75` |
| `null` | Backlog, unprioritized | `"priority": null` |

**Insertion example**: To insert an urgent task between priorities 2 and 3, use `"priority": 2.5`

## Querying Tasks

### Find pending tasks by priority
```bash
jq '[.[] | select(.passes == false)] | sort_by(.priority)' tasks.json
```

### Find tasks by type
```bash
jq '[.[] | select(.type == "fix")]' tasks.json
```

### Find tasks for a milestone
```bash
jq '[.[] | select(.milestone == "v1.1")]' tasks.json
```

### Find tasks by scope
```bash
jq '[.[] | select(.scope == "packages/whatsapp-n8n-nodes")]' tasks.json
```

### Find resume point (in_progress tasks)
```bash
jq '.[] | select(.status == "in_progress")' tasks.json
```

### Find tasks by status
```bash
jq '[.[] | select(.status == "blocked")]' tasks.json
```

### Generate changelog entries from completed tasks
```bash
jq '[.[] | select(.passes == true and .changelog != null)] | .[].changelog' tasks.json
```

### Find next subtask to execute
```bash
jq '
  .[] | select(.passes == false and .subtasks) |
  .subtasks[] | select(.passes == false) |
  select(
    (.depends_on == null) or
    (all(.depends_on[]; . as $dep | any(input.subtasks[]; .id == $dep and .passes == true)))
  ) | limit(1; .)
' tasks.json
```

### List all pending subtasks for a task
```bash
jq '.[] | select(.description == "Your task description") | .subtasks[] | select(.passes == false)' tasks.json
```

### Get context files for next subtask
```bash
jq '
  .[] | select(.passes == false) |
  if .subtasks then
    .subtasks[] | select(.passes == false) | .context.files
  else
    .context.files
  end
' tasks.json
```

### View subtask progress
```bash
jq '
  .[] | select(.subtasks) |
  {
    description,
    total: (.subtasks | length),
    completed: ([.subtasks[] | select(.passes == true)] | length),
    remaining: ([.subtasks[] | select(.passes == false)] | length)
  }
' tasks.json
```

## Querying Archives

### Find task by ID prefix (across all archives)
```bash
jq '.[] | select(.id | startswith("003-"))' .archive/*/tasks.json tasks.json
```

### Search by keyword in descriptions
```bash
grep -r "webhook" .archive/ tasks.json
```

### Find tasks referencing another task
```bash
jq '.[] | select(.references[]? | contains("003-"))' .archive/*/tasks.json tasks.json
```

### List all tasks for a milestone
```bash
jq '.[].id' .archive/v0.1.0/tasks.json
```

### Get next available index
```bash
jq -s 'flatten | map(.id | split("-")[0] | tonumber) | max + 1' .archive/*/tasks.json tasks.json 2>/dev/null || echo "1"
```

### View all completed tasks across milestones
```bash
jq -s 'flatten | sort_by(.id)' .archive/*/tasks.json
```
