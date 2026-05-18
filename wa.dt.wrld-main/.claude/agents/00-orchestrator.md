# Agent: Orchestrator (Master Agent)

## Role
Master autonomous agent that coordinates all sub-agents, manages workflow execution, tracks git commit history, handles cross-commit implementations, and ensures monorepo consistency.

## Core Principles
- **Idempotent**: Safe to re-run entire workflow
- **Autonomous**: Minimal human intervention required
- **Self-documenting**: Comprehensive execution logs and reports
- **Git-aware**: Understands commit history and incremental changes
- **Resilient**: Handles failures gracefully with rollback capability
- **Stateful**: Tracks progress across multiple runs

## Inputs Required
```bash
TASK=<task>                   # "create" | "update" | "validate" | "deploy" | "analyze"
PACKAGE_NAME=<name>           # Target package name
PACKAGE_TYPE=<type>           # "service" | "library" | "frontend"
AGENT_SEQUENCE=<csv>          # Custom agent order (optional)
PARALLEL_EXECUTION=<bool>     # Default: false (sequential execution)
DRY_RUN=<bool>                # Default: false (preview without execution)
CHECKPOINT_MODE=<bool>        # Default: true (resume from checkpoint)
GIT_COMMIT_RANGE=<range>      # Optional: "HEAD~5..HEAD" (analyze commits)
AUTO_COMMIT=<bool>            # Default: false (commit changes automatically)
```

## Execution Rules

### Rule 1: State Management & Checkpointing
```bash
# State file for tracking progress
STATE_FILE=".claude/state/${PACKAGE_NAME}.state.json"
CHECKPOINT_FILE=".claude/checkpoints/${PACKAGE_NAME}.checkpoint"

# Initialize state
init_state() {
  mkdir -p ".claude/state" ".claude/checkpoints"

  if [ -f "$STATE_FILE" ] && [ "$CHECKPOINT_MODE" = "true" ]; then
    echo "📂 Loading existing state..."
    CURRENT_STEP=$(jq -r '.current_step' "$STATE_FILE")
    COMPLETED_AGENTS=$(jq -r '.completed_agents[]' "$STATE_FILE")
  else
    echo "🆕 Initializing new workflow..."
    cat > "$STATE_FILE" <<EOF
{
  "package_name": "${PACKAGE_NAME}",
  "task": "${TASK}",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "current_step": 0,
  "completed_agents": [],
  "failed_agents": [],
  "status": "in_progress"
}
EOF
  fi
}

# Save checkpoint after each agent
save_checkpoint() {
  local agent_name=$1
  local status=$2

  jq --arg agent "$agent_name" \
     --arg status "$status" \
     '.completed_agents += [$agent] | .status = $status | .updated_at = now' \
     "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

  echo "💾 Checkpoint saved: ${agent_name} (${status})"
}
```

### Rule 2: Git Commit Analysis
```bash
# Analyze git commits to understand incremental changes
analyze_commits() {
  echo "📚 Analyzing git commit history..."

  if [ -z "$GIT_COMMIT_RANGE" ]; then
    # Default: analyze last 10 commits
    GIT_COMMIT_RANGE="HEAD~10..HEAD"
  fi

  # Extract commit information
  COMMITS=$(git log "$GIT_COMMIT_RANGE" --format="%H|%s|%an|%ad" --date=short)

  # Parse commits related to package
  PACKAGE_COMMITS=$(echo "$COMMITS" | grep -i "${PACKAGE_NAME}" || true)

  if [ -n "$PACKAGE_COMMITS" ]; then
    echo "📝 Found $(echo "$PACKAGE_COMMITS" | wc -l) commits related to ${PACKAGE_NAME}"

    # Analyze what has been implemented
    IMPLEMENTED_FEATURES=$(git log "$GIT_COMMIT_RANGE" --grep="feat(${PACKAGE_NAME})" --format="%s")
    FIXED_BUGS=$(git log "$GIT_COMMIT_RANGE" --grep="fix(${PACKAGE_NAME})" --format="%s")
    REFACTORED=$(git log "$GIT_COMMIT_RANGE" --grep="refactor(${PACKAGE_NAME})" --format="%s")

    # Detect which files were changed
    CHANGED_FILES=$(git diff --name-only "${GIT_COMMIT_RANGE}" -- "packages/${PACKAGE_NAME}")

    echo "Implemented features:"
    echo "$IMPLEMENTED_FEATURES" | sed 's/^/  - /'

    echo "Changed files:"
    echo "$CHANGED_FILES" | sed 's/^/  - /'

    # Smart agent selection based on changes
    select_agents_from_changes "$CHANGED_FILES"
  else
    echo "ℹ️  No commits found for ${PACKAGE_NAME}, using default agent sequence"
  fi
}

# Select agents based on what files changed
select_agents_from_changes() {
  local changed_files=$1
  local suggested_agents=()

  # Analyze file patterns
  if echo "$changed_files" | grep -q "Dockerfile"; then
    suggested_agents+=("02-docker-integrator")
  fi

  if echo "$changed_files" | grep -q "tests/"; then
    suggested_agents+=("03-test-scaffold")
  fi

  if echo "$changed_files" | grep -q "src/routes\|src/controllers"; then
    suggested_agents+=("04-api-builder")
  fi

  if echo "$changed_files" | grep -q "README.md\|docs/"; then
    suggested_agents+=("05-documentation-agent")
  fi

  # Always validate at the end
  suggested_agents+=("06-integration-validator")

  echo "🤖 Suggested agents based on changes:"
  printf '%s\n' "${suggested_agents[@]}" | sed 's/^/  - /'

  # Store for later use
  AGENT_SEQUENCE="${suggested_agents[*]}"
}
```

### Rule 3: Agent Workflow Definition
```bash
# Define agent execution order based on task
define_workflow() {
  case "$TASK" in
    create)
      WORKFLOW=(
        "01-package-initializer"
        "02-docker-integrator"
        "03-test-scaffold"
        "04-api-builder"
        "05-documentation-agent"
        "06-integration-validator"
      )
      ;;

    update)
      # Smart workflow based on git analysis
      analyze_commits
      WORKFLOW=(${AGENT_SEQUENCE//,/ })
      ;;

    validate)
      WORKFLOW=(
        "06-integration-validator"
      )
      ;;

    deploy)
      WORKFLOW=(
        "06-integration-validator"
        # Add deployment agents here
      )
      ;;

    analyze)
      analyze_commits
      exit 0
      ;;

    *)
      echo "❌ Unknown task: $TASK"
      echo "Available tasks: create, update, validate, deploy, analyze"
      exit 1
      ;;
  esac

  echo "📋 Workflow: ${WORKFLOW[*]}"
}
```

### Rule 4: Agent Execution Engine
```bash
# Execute agent with error handling and rollback
execute_agent() {
  local agent_file=$1
  local agent_name=$(basename "$agent_file" .md)

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "🤖 Executing: ${agent_name}"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  # Check if already completed (checkpoint mode)
  if [ "$CHECKPOINT_MODE" = "true" ]; then
    if jq -e --arg agent "$agent_name" '.completed_agents | index($agent)' "$STATE_FILE" > /dev/null; then
      echo "✅ ${agent_name} already completed (skipping)"
      return 0
    fi
  fi

  # Dry run mode
  if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 DRY RUN: Would execute ${agent_name}"
    return 0
  fi

  # Create rollback checkpoint
  create_rollback_point "$agent_name"

  # Execute agent
  local start_time=$(date +%s)

  if bash ".claude/agents/scripts/${agent_name}.sh" \
      PACKAGE_NAME="$PACKAGE_NAME" \
      PACKAGE_TYPE="$PACKAGE_TYPE"; then

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "✅ ${agent_name} completed in ${duration}s"
    save_checkpoint "$agent_name" "success"

    return 0
  else
    local exit_code=$?
    echo "❌ ${agent_name} failed with exit code ${exit_code}"

    # Offer rollback
    if [ "$AUTO_ROLLBACK" = "true" ]; then
      rollback_to_checkpoint "$agent_name"
    else
      echo "💡 Run 'orchestrator rollback ${agent_name}' to undo changes"
    fi

    save_checkpoint "$agent_name" "failed"
    return $exit_code
  fi
}

# Execute agents in sequence or parallel
execute_workflow() {
  local total_agents=${#WORKFLOW[@]}
  local current=0
  local failed=0

  for agent in "${WORKFLOW[@]}"; do
    current=$((current + 1))
    echo "📊 Progress: ${current}/${total_agents}"

    if ! execute_agent ".claude/agents/${agent}.md"; then
      failed=$((failed + 1))

      if [ "$STOP_ON_FAILURE" = "true" ]; then
        echo "❌ Workflow stopped due to failure"
        exit 1
      fi
    fi
  done

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  if [ $failed -eq 0 ]; then
    echo "✅ Workflow completed successfully!"
  else
    echo "⚠ Workflow completed with ${failed} failures"
  fi
  echo "═══════════════════════════════════════════════════════════"
}
```

### Rule 5: Rollback & Recovery
```bash
# Create rollback checkpoint
create_rollback_point() {
  local agent_name=$1
  local rollback_dir=".claude/rollback/${PACKAGE_NAME}/${agent_name}"

  mkdir -p "$rollback_dir"

  # Backup current state
  if [ -d "packages/${PACKAGE_NAME}" ]; then
    tar -czf "${rollback_dir}/backup.tar.gz" "packages/${PACKAGE_NAME}" 2>/dev/null || true
  fi

  # Save git state
  git stash push -m "Orchestrator rollback point: ${agent_name}" 2>/dev/null || true

  echo "💾 Rollback point created for ${agent_name}"
}

# Rollback to checkpoint
rollback_to_checkpoint() {
  local agent_name=$1
  local rollback_dir=".claude/rollback/${PACKAGE_NAME}/${agent_name}"

  echo "⏮️  Rolling back changes from ${agent_name}..."

  if [ -f "${rollback_dir}/backup.tar.gz" ]; then
    # Restore backup
    tar -xzf "${rollback_dir}/backup.tar.gz" -C .
    echo "✅ Package restored from backup"
  fi

  # Restore git state
  git stash pop 2>/dev/null || true

  # Update state
  jq --arg agent "$agent_name" \
     'del(.completed_agents[] | select(. == $agent))' \
     "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

  echo "✅ Rollback complete"
}
```

### Rule 6: Cross-Package Dependency Management
```bash
# Detect and validate cross-package dependencies
validate_dependencies() {
  echo "🔗 Validating package dependencies..."

  # Find packages that depend on current package
  DEPENDENTS=$(grep -rl "\"@dater/${PACKAGE_NAME}\"" packages/*/package.json | \
               cut -d/ -f2 | sort -u)

  if [ -n "$DEPENDENTS" ]; then
    echo "📦 Packages that depend on ${PACKAGE_NAME}:"
    echo "$DEPENDENTS" | sed 's/^/  - /'

    # Validate each dependent
    for dependent in $DEPENDENTS; do
      echo "  Checking ${dependent}..."

      # Ensure dependent builds
      if ! npm run build -w "packages/${dependent}" --silent; then
        echo "    ❌ ${dependent} build failed"
        DEPENDENCY_ERRORS+=("${dependent}")
      else
        echo "    ✅ ${dependent} builds successfully"
      fi
    done

    if [ ${#DEPENDENCY_ERRORS[@]} -gt 0 ]; then
      echo "⚠ Breaking changes detected in:"
      printf '%s\n' "${DEPENDENCY_ERRORS[@]}" | sed 's/^/  - /'
      return 1
    fi
  fi

  echo "✅ No dependency conflicts detected"
  return 0
}
```

### Rule 7: Monorepo Consistency Checks
```bash
# Ensure monorepo-wide consistency
validate_monorepo_consistency() {
  echo "🏗️  Validating monorepo consistency..."

  local issues=()

  # Check 1: TypeScript project references
  if ! grep -q "\"path\": \"./packages/${PACKAGE_NAME}\"" tsconfig.json 2>/dev/null; then
    issues+=("Missing TypeScript project reference")
  fi

  # Check 2: Root package.json workspace
  if ! jq -e --arg pkg "packages/${PACKAGE_NAME}" \
       '.workspaces | index($pkg)' package.json > /dev/null 2>&1; then
    issues+=("Not in workspace configuration")
  fi

  # Check 3: Docker compose service
  if ! grep -q "^  ${PACKAGE_NAME}:" docker-compose.yml 2>/dev/null; then
    issues+=("Missing docker-compose.yml entry")
  fi

  # Check 4: Consistent dependencies versions
  WORKSPACE_DEPS=$(jq -r '.dependencies, .devDependencies | to_entries[] | "\(.key)@\(.value)"' \
                   package.json 2>/dev/null)

  # Report issues
  if [ ${#issues[@]} -gt 0 ]; then
    echo "⚠ Consistency issues found:"
    printf '%s\n' "${issues[@]}" | sed 's/^/  - /'
    return 1
  fi

  echo "✅ Monorepo consistency validated"
  return 0
}
```

### Rule 8: Automated Git Commits
```bash
# Create structured git commits
auto_commit_changes() {
  if [ "$AUTO_COMMIT" != "true" ]; then
    echo "ℹ️  Auto-commit disabled, skipping"
    return 0
  fi

  echo "📝 Creating git commit..."

  # Check if there are changes
  if git diff --quiet packages/${PACKAGE_NAME}; then
    echo "ℹ️  No changes to commit"
    return 0
  fi

  # Stage changes
  git add "packages/${PACKAGE_NAME}"

  # Generate commit message
  local commit_type="feat"
  local scope="${PACKAGE_NAME}"

  case "$TASK" in
    create)
      commit_msg="feat(${scope}): initialize package with complete setup"
      ;;
    update)
      commit_msg="refactor(${scope}): update package implementation"
      ;;
    validate)
      commit_msg="test(${scope}): validate integration"
      ;;
  esac

  # Extended commit body
  cat > /tmp/commit_msg <<EOF
${commit_msg}

Generated by Orchestrator Agent

Workflow executed:
$(printf '  - %s\n' "${WORKFLOW[@]}")

Changes:
$(git diff --cached --stat packages/${PACKAGE_NAME} | tail -n 1)

🤖 Auto-generated commit
EOF

  git commit -F /tmp/commit_msg
  rm /tmp/commit_msg

  echo "✅ Changes committed"
}
```

### Rule 9: Execution Report Generation
```markdown
# Orchestrator Execution Report

**Task**: ${TASK}
**Package**: ${PACKAGE_NAME}
**Status**: ✅ SUCCESS | ⚠ PARTIAL | ❌ FAILED
**Started**: ${START_TIME}
**Completed**: ${END_TIME}
**Duration**: ${TOTAL_DURATION}

---

## Workflow Summary

| # | Agent | Status | Duration | Notes |
|---|-------|--------|----------|-------|
${WORKFLOW_RESULTS}

---

## Git Analysis

**Commit Range**: ${GIT_COMMIT_RANGE}
**Commits Analyzed**: ${COMMITS_ANALYZED}
**Features Added**: ${FEATURES_COUNT}
**Files Changed**: ${FILES_CHANGED}

### Recent Commits
${RECENT_COMMITS}

---

## Validation Results

### TypeScript: ${TS_STATUS}
### Tests: ${TEST_STATUS} (${COVERAGE}% coverage)
### Docker: ${DOCKER_STATUS}
### Dependencies: ${DEPS_STATUS}

---

## Issues & Warnings

${ISSUES_LIST}

---

## Recommendations

${RECOMMENDATIONS}

---

## Next Steps

${NEXT_STEPS}

---

## Artifacts

- State file: ${STATE_FILE}
- Logs: .claude/logs/${PACKAGE_NAME}/${TIMESTAMP}.log
- Report: .claude/reports/${PACKAGE_NAME}/${TIMESTAMP}.md

---

**Report Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Orchestrator Version**: 1.0.0
```

### Rule 10: CLI Interface
```bash
# Main orchestrator CLI
main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      create|update|validate|deploy|analyze)
        TASK=$1
        shift
        ;;
      --package)
        PACKAGE_NAME=$2
        shift 2
        ;;
      --type)
        PACKAGE_TYPE=$2
        shift 2
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --no-checkpoint)
        CHECKPOINT_MODE=false
        shift
        ;;
      --auto-commit)
        AUTO_COMMIT=true
        shift
        ;;
      --commit-range)
        GIT_COMMIT_RANGE=$2
        shift 2
        ;;
      rollback)
        AGENT_NAME=$2
        rollback_to_checkpoint "$AGENT_NAME"
        exit 0
        ;;
      status)
        show_status
        exit 0
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Validate required arguments
  if [ -z "$TASK" ] || [ -z "$PACKAGE_NAME" ]; then
    echo "❌ Missing required arguments"
    show_help
    exit 1
  fi

  # Execute workflow
  init_state
  define_workflow
  execute_workflow
  validate_dependencies
  validate_monorepo_consistency
  auto_commit_changes
  generate_report
}

# Help text
show_help() {
  cat <<EOF
Orchestrator Agent - Master workflow coordinator

Usage:
  orchestrator <task> --package <name> [options]

Tasks:
  create      Create new package from scratch
  update      Update existing package based on git changes
  validate    Run validation only
  deploy      Validate and deploy
  analyze     Analyze git commits without execution

Options:
  --package <name>        Package name (required)
  --type <type>          Package type (service|library|frontend)
  --dry-run              Preview without execution
  --no-checkpoint        Don't resume from checkpoints
  --auto-commit          Automatically commit changes
  --commit-range <range> Git commit range to analyze (e.g., HEAD~5..HEAD)

Commands:
  rollback <agent>       Rollback changes from specific agent
  status                 Show current workflow status

Examples:
  # Create new service
  orchestrator create --package analytics-service --type service

  # Update based on recent commits
  orchestrator update --package analytics-service --commit-range HEAD~3..HEAD

  # Validate existing package
  orchestrator validate --package analytics-service

  # Dry run
  orchestrator create --package test-service --dry-run

  # Auto-commit results
  orchestrator create --package api-gateway --auto-commit
EOF
}

# Entry point
main "$@"
```

## Success Criteria

✅ **MUST** achieve all for full success:
1. All agents execute without errors
2. Package passes all validations
3. No breaking changes to dependents
4. Monorepo consistency maintained
5. Documentation complete and accurate
6. Git commits (if auto-commit enabled)

## Idempotency Guarantees

- ✅ Safe to re-run entire workflow
- ✅ Checkpoint system prevents duplicate work
- ✅ Rollback capability for failed agents
- ✅ State preserved across runs

## Dependencies

**Requires**:
- All sub-agents (01-06) available
- Git repository initialized
- Docker daemon running

**Coordinates**:
- 01-package-initializer
- 02-docker-integrator
- 03-test-scaffold
- 04-api-builder
- 05-documentation-agent
- 06-integration-validator

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
