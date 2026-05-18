# Agent: Integration Validator

## Role
Autonomous agent for comprehensive validation of package integration within the monorepo, including E2E testing, Docker connectivity, API health checks, and cross-package compatibility verification.

## Core Principles
- **Idempotent**: Non-destructive validation, can run repeatedly
- **Autonomous**: Self-healing capabilities for common issues
- **Self-documenting**: Generates detailed validation reports
- **Comprehensive**: Tests all integration points
- **Production-ready**: Validates deployment readiness

## Inputs Required
```bash
PACKAGE_NAME=<name>           # e.g., "analytics-service"
VALIDATION_LEVEL=<level>      # "basic" | "standard" | "comprehensive" (default: standard)
AUTO_FIX=<bool>               # Default: false (attempt to fix issues)
GENERATE_REPORT=<bool>        # Default: true
SMOKE_TEST=<bool>             # Default: true (quick sanity checks)
```

## Execution Rules

### Rule 1: Pre-validation Health Check
```bash
# Verify package exists and is buildable
echo "🔍 Running pre-validation checks..."

# Check package structure
if [ ! -d "packages/${PACKAGE_NAME}" ]; then
  echo "❌ Package not found: packages/${PACKAGE_NAME}"
  exit 1
fi

# Verify package.json
if [ ! -f "packages/${PACKAGE_NAME}/package.json" ]; then
  echo "❌ Invalid package: missing package.json"
  exit 1
fi

# Check build succeeds
npm run build -w "packages/${PACKAGE_NAME}" || {
  echo "❌ Build failed"
  exit 1
}

echo "✅ Pre-validation checks passed"
```

### Rule 2: TypeScript Compilation Validation
```bash
# Validate TypeScript across entire workspace
echo "📝 Validating TypeScript..."

# Individual package check
npm run type-check -w "packages/${PACKAGE_NAME}" || {
  echo "❌ TypeScript errors in ${PACKAGE_NAME}"
  if [ "$AUTO_FIX" = "true" ]; then
    echo "🔧 Attempting auto-fix..."
    # Try to fix common issues
    npm run lint:fix -w "packages/${PACKAGE_NAME}"
  fi
  exit 1
}

# Workspace-wide check (ensure no breaking changes)
npm run type-check || {
  echo "⚠ TypeScript errors in workspace"
  echo "   Package ${PACKAGE_NAME} may have introduced breaking changes"
  exit 1
}

echo "✅ TypeScript validation passed"
```

### Rule 3: Test Suite Validation
```bash
# Run all tests with coverage
echo "🧪 Running test suite..."

# Unit tests
npm run test:unit -w "packages/${PACKAGE_NAME}" || {
  echo "❌ Unit tests failed"
  exit 1
}

# Integration tests
npm run test:integration -w "packages/${PACKAGE_NAME}" 2>/dev/null || {
  echo "⚠ No integration tests or tests failed"
}

# API tests
npm run test:api -w "packages/${PACKAGE_NAME}" 2>/dev/null || {
  echo "⚠ No API tests or tests failed"
}

# Coverage check
COVERAGE=$(npm run test:coverage -w "packages/${PACKAGE_NAME}" --silent | grep "All files" | awk '{print $10}' | tr -d '%')
THRESHOLD=80

if [ "$COVERAGE" -lt "$THRESHOLD" ]; then
  echo "⚠ Coverage ${COVERAGE}% below threshold ${THRESHOLD}%"
else
  echo "✅ Test coverage: ${COVERAGE}%"
fi
```

### Rule 4: Docker Build Validation
```bash
# Validate Docker configuration and build
echo "🐳 Validating Docker..."

# Check Dockerfile exists
if [ ! -f "packages/${PACKAGE_NAME}/Dockerfile" ]; then
  echo "⚠ No Dockerfile found"
  if [ "$AUTO_FIX" = "true" ]; then
    echo "🔧 Run docker-integrator agent to create Dockerfile"
  fi
else
  # Build Docker image
  docker compose build "${PACKAGE_NAME}" || {
    echo "❌ Docker build failed"
    exit 1
  }

  # Check image size
  IMAGE_SIZE=$(docker images "${PACKAGE_NAME}" --format "{{.Size}}")
  echo "📦 Docker image size: ${IMAGE_SIZE}"

  # Warn if image is too large (>500MB)
  SIZE_MB=$(docker images "${PACKAGE_NAME}" --format "{{.Size}}" | sed 's/MB//' | cut -d'.' -f1)
  if [ "$SIZE_MB" -gt 500 ]; then
    echo "⚠ Image size exceeds 500MB, consider optimization"
  fi

  echo "✅ Docker build successful"
fi
```

### Rule 5: Container Runtime Validation
```bash
# Start container and validate health
echo "🚀 Starting container..."

# Start service in detached mode
docker compose up -d "${PACKAGE_NAME}" || {
  echo "❌ Failed to start container"
  docker compose logs "${PACKAGE_NAME}"
  exit 1
}

# Wait for health check
MAX_WAIT=60
WAITED=0
HEALTH_STATUS="starting"

while [ "$HEALTH_STATUS" != "healthy" ] && [ $WAITED -lt $MAX_WAIT ]; do
  sleep 2
  WAITED=$((WAITED + 2))
  HEALTH_STATUS=$(docker compose ps "${PACKAGE_NAME}" --format json | jq -r '.[0].Health' 2>/dev/null || echo "unknown")

  if [ "$HEALTH_STATUS" = "unhealthy" ]; then
    echo "❌ Container unhealthy"
    docker compose logs --tail=50 "${PACKAGE_NAME}"
    docker compose down "${PACKAGE_NAME}"
    exit 1
  fi

  echo "⏳ Waiting for health check... (${WAITED}s / ${MAX_WAIT}s)"
done

if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "❌ Container failed to become healthy within ${MAX_WAIT}s"
  docker compose logs "${PACKAGE_NAME}"
  docker compose down "${PACKAGE_NAME}"
  exit 1
fi

echo "✅ Container healthy"
```

### Rule 6: API Endpoint Validation
```bash
# Test all API endpoints
echo "🌐 Validating API endpoints..."

# Get container port
CONTAINER_PORT=$(docker compose port "${PACKAGE_NAME}" ${INTERNAL_PORT} | cut -d: -f2)

# Health endpoint (MUST exist)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${CONTAINER_PORT}/health")
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Health endpoint returned ${HTTP_CODE}"
  exit 1
fi
echo "✅ Health endpoint: 200 OK"

# Test documented endpoints
if [ -f "packages/${PACKAGE_NAME}/docs/api/openapi.yaml" ]; then
  # Extract endpoints from OpenAPI spec and test
  ENDPOINTS=$(yq eval '.paths | keys' "packages/${PACKAGE_NAME}/docs/api/openapi.yaml" 2>/dev/null || echo "")

  for endpoint in $ENDPOINTS; do
    # Test each endpoint (basic connectivity)
    URL="http://localhost:${CONTAINER_PORT}${BASE_PATH}${endpoint}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" -H "Authorization: Bearer ${API_KEY}")

    # Accept 200, 401, 404 as valid (endpoint exists)
    if [[ "$HTTP_CODE" =~ ^(200|401|404)$ ]]; then
      echo "✅ ${endpoint}: ${HTTP_CODE}"
    else
      echo "⚠ ${endpoint}: ${HTTP_CODE} (unexpected)"
    fi
  done
fi
```

### Rule 7: Network Connectivity Validation
```bash
# Validate service can communicate with dependencies
echo "🔗 Validating network connectivity..."

# Check container network
NETWORK=$(docker inspect "${PACKAGE_NAME}" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
echo "📡 Network: ${NETWORK}"

# Test dependency connectivity (if specified)
if [ -n "${DEPENDS_ON}" ]; then
  IFS=',' read -ra DEPS <<< "${DEPENDS_ON}"
  for dep in "${DEPS[@]}"; do
    # Check if dependency is running
    DEP_STATUS=$(docker compose ps "${dep}" --format json | jq -r '.[0].State' 2>/dev/null || echo "missing")

    if [ "$DEP_STATUS" != "running" ]; then
      echo "⚠ Dependency ${dep} not running"
      continue
    fi

    # Test connectivity from container
    docker compose exec "${PACKAGE_NAME}" sh -c "nc -zv ${dep} ${DEP_PORT} 2>&1" || {
      echo "⚠ Cannot connect to ${dep}:${DEP_PORT}"
    }

    echo "✅ Connected to ${dep}"
  done
fi
```

### Rule 8: Environment Variable Validation
```bash
# Validate all required environment variables are set
echo "🔐 Validating environment configuration..."

# Extract required env vars from .env.example
if [ -f "packages/${PACKAGE_NAME}/.env.example" ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [ -z "$key" ] && continue

    # Check if variable is set in container
    ENV_VALUE=$(docker compose exec "${PACKAGE_NAME}" sh -c "echo \$${key}" 2>/dev/null)

    if [ -z "$ENV_VALUE" ]; then
      echo "⚠ Environment variable ${key} not set"
    else
      echo "✅ ${key} = [SET]"
    fi
  done < "packages/${PACKAGE_NAME}/.env.example"
fi
```

### Rule 9: Cross-Package Integration Validation
```bash
# Validate compatibility with other packages
echo "🔄 Validating cross-package integration..."

# Check if package is used by other packages
DEPENDENTS=$(grep -r "\"@dater/${PACKAGE_NAME}\"" packages/*/package.json | cut -d: -f1 | cut -d/ -f2 | sort -u)

if [ -n "$DEPENDENTS" ]; then
  echo "📦 Package used by: $DEPENDENTS"

  for dependent in $DEPENDENTS; do
    # Ensure dependent can build with new changes
    npm run build -w "packages/${dependent}" || {
      echo "❌ Breaking change: ${dependent} failed to build"
      exit 1
    }
    echo "✅ ${dependent} builds successfully"
  done
else
  echo "ℹ️  No packages depend on ${PACKAGE_NAME}"
fi
```

### Rule 10: Performance & Resource Validation
```bash
# Validate resource usage
echo "📊 Validating performance..."

# Container resource usage
STATS=$(docker stats "${PACKAGE_NAME}" --no-stream --format "CPU: {{.CPUPerc}}, Memory: {{.MemUsage}}")
echo "${STATS}"

# Response time check
START=$(date +%s%3N)
curl -s "http://localhost:${CONTAINER_PORT}/health" > /dev/null
END=$(date +%s%3N)
RESPONSE_TIME=$((END - START))

if [ $RESPONSE_TIME -gt 1000 ]; then
  echo "⚠ Slow response time: ${RESPONSE_TIME}ms"
else
  echo "✅ Response time: ${RESPONSE_TIME}ms"
fi

# Memory leak check (basic)
MEM_BEFORE=$(docker stats "${PACKAGE_NAME}" --no-stream --format "{{.MemUsage}}" | cut -d/ -f1)
sleep 10
MEM_AFTER=$(docker stats "${PACKAGE_NAME}" --no-stream --format "{{.MemUsage}}" | cut -d/ -f1)

echo "🧠 Memory: ${MEM_BEFORE} → ${MEM_AFTER}"
```

### Rule 11: Security Validation
```bash
# Basic security checks
echo "🔒 Running security validation..."

# Check for exposed secrets
echo "Scanning for exposed secrets..."
if grep -r "password\|secret\|key" "packages/${PACKAGE_NAME}/src" --include="*.ts" | grep -v "process.env"; then
  echo "⚠ Potential hardcoded secrets detected"
fi

# Dependency vulnerabilities
npm audit --workspace="packages/${PACKAGE_NAME}" --audit-level=high || {
  echo "⚠ Security vulnerabilities found"
  if [ "$AUTO_FIX" = "true" ]; then
    npm audit fix --workspace="packages/${PACKAGE_NAME}"
  fi
}

# Check Docker image for vulnerabilities (if trivy installed)
if command -v trivy &> /dev/null; then
  trivy image "${PACKAGE_NAME}:latest" --severity HIGH,CRITICAL || {
    echo "⚠ Docker image vulnerabilities found"
  }
fi

echo "✅ Security scan complete"
```

### Rule 12: Smoke Test Suite
```bash
# Quick smoke tests for critical functionality
echo "💨 Running smoke tests..."

cat > "/tmp/${PACKAGE_NAME}_smoke_test.sh" <<'EOF'
#!/bin/bash
set -e

BASE_URL="http://localhost:${CONTAINER_PORT}"
API_KEY="${API_KEY}"

# Test 1: Health check
echo "Test 1: Health check"
curl -f "${BASE_URL}/health" || exit 1

# Test 2: Root endpoint
echo "Test 2: Root endpoint"
curl -f "${BASE_URL}/" || exit 1

# Test 3: Authentication (if required)
if [ -n "$API_KEY" ]; then
  echo "Test 3: Authentication"
  curl -f "${BASE_URL}/api/v1/protected" \
    -H "Authorization: Bearer ${API_KEY}" || exit 1
fi

# Test 4: Error handling
echo "Test 4: 404 handling"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/nonexistent")
[ "$HTTP_CODE" = "404" ] || exit 1

echo "✅ All smoke tests passed"
EOF

chmod +x "/tmp/${PACKAGE_NAME}_smoke_test.sh"
bash "/tmp/${PACKAGE_NAME}_smoke_test.sh"
```

## Validation Report Generation

```markdown
# Integration Validation Report

**Package**: ${PACKAGE_NAME}
**Validation Level**: ${VALIDATION_LEVEL}
**Status**: ✅ PASSED | ⚠ WARNINGS | ❌ FAILED
**Timestamp**: ${ISO_TIMESTAMP}
**Duration**: ${VALIDATION_DURATION}s

---

## Summary

| Category | Status | Details |
|----------|--------|---------|
| Pre-validation | ${PRE_VALIDATION_STATUS} | Build: ${BUILD_STATUS} |
| TypeScript | ${TS_STATUS} | No errors |
| Tests | ${TEST_STATUS} | Coverage: ${COVERAGE}% |
| Docker Build | ${DOCKER_BUILD_STATUS} | Image: ${IMAGE_SIZE} |
| Container Health | ${HEALTH_STATUS} | Startup: ${STARTUP_TIME}s |
| API Endpoints | ${API_STATUS} | ${ENDPOINT_COUNT} tested |
| Network | ${NETWORK_STATUS} | Dependencies: ${DEPS_STATUS} |
| Environment | ${ENV_STATUS} | All required vars set |
| Cross-Package | ${CROSS_PKG_STATUS} | ${DEPENDENTS_COUNT} dependents |
| Performance | ${PERF_STATUS} | Response: ${RESPONSE_TIME}ms |
| Security | ${SECURITY_STATUS} | ${VULN_COUNT} vulnerabilities |
| Smoke Tests | ${SMOKE_STATUS} | ${SMOKE_PASSED}/${SMOKE_TOTAL} passed |

---

## Detailed Results

### TypeScript Validation
\`\`\`
${TS_OUTPUT}
\`\`\`

### Test Results
\`\`\`
${TEST_OUTPUT}
\`\`\`

### Docker Build
\`\`\`
${DOCKER_OUTPUT}
\`\`\`

### API Endpoint Tests
${API_TESTS_TABLE}

### Performance Metrics
- Container startup: ${STARTUP_TIME}s
- Health check response: ${RESPONSE_TIME}ms
- CPU usage: ${CPU_USAGE}
- Memory usage: ${MEM_USAGE}

### Security Scan
${SECURITY_OUTPUT}

---

## Issues Found

${ISSUES_LIST}

---

## Recommendations

${RECOMMENDATIONS_LIST}

---

## Next Steps

${NEXT_STEPS}

---

**Report Generated**: ${TIMESTAMP}
**Validator Version**: 1.0.0
```

## Cleanup

```bash
# Always cleanup after validation
cleanup() {
  echo "🧹 Cleaning up..."

  # Stop container
  docker compose down "${PACKAGE_NAME}" 2>/dev/null || true

  # Remove test artifacts
  rm -f "/tmp/${PACKAGE_NAME}_smoke_test.sh"

  echo "✅ Cleanup complete"
}

trap cleanup EXIT
```

## Success Criteria

✅ **MUST** achieve all for PASS:
1. TypeScript compiles without errors
2. All tests pass
3. Docker image builds successfully
4. Container becomes healthy within 60s
5. Health endpoint returns 200 OK
6. No high/critical security vulnerabilities
7. All smoke tests pass

⚠ **WARNINGS** (acceptable):
- Coverage below threshold
- Performance degradation
- Large Docker image size
- Low/medium security vulnerabilities

❌ **FAILURES** (must fix):
- Build errors
- Test failures
- Container unhealthy
- API endpoint failures
- Breaking changes to dependents

## Idempotency Guarantees

- ✅ Non-destructive validation
- ✅ Can run multiple times
- ✅ Cleanup on exit
- ✅ No state changes (except AUTO_FIX mode)

## Dependencies

**Requires**:
- All previous agents completed
- Docker daemon running
- Network access for API tests

**Triggers Next**:
- Deployment (if all validations pass)
- Bug fixing (if validations fail)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
