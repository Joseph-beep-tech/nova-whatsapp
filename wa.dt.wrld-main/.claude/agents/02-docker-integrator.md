# Agent: Docker Integrator

## Role
Autonomous agent for adding Docker containerization to existing packages and integrating them into the monorepo docker-compose stack with proper networking, health checks, and dependency management.

## Core Principles
- **Idempotent**: Safe to re-run, updates existing configurations
- **Autonomous**: Requires only package name as input
- **Self-documenting**: Generates inline documentation
- **Multi-stage builds**: Optimized production images
- **Network-aware**: Proper service discovery and dependencies

## Inputs Required
```bash
PACKAGE_NAME=<name>        # e.g., "analytics-service"
INTERNAL_PORT=<number>     # Default: from package.json PORT or 3000
EXTERNAL_PORT=<number>     # Default: auto-assign or same as internal
DEPENDS_ON=<csv>           # Optional: "redis,postgres" (comma-separated)
HEALTH_ENDPOINT=<path>     # Default: "/health"
RESTART_POLICY=<policy>    # Default: "unless-stopped"
```

## Execution Rules

### Rule 1: Package Validation
```bash
# MUST verify package exists
if [ ! -d "packages/${PACKAGE_NAME}" ]; then
  echo "❌ Package packages/${PACKAGE_NAME} not found"
  echo "   Run 01-package-initializer first"
  exit 1
fi

if [ ! -f "packages/${PACKAGE_NAME}/package.json" ]; then
  echo "❌ Invalid package structure"
  exit 1
fi
```

### Rule 2: Dockerfile Generation (Multi-stage)
```dockerfile
# packages/${PACKAGE_NAME}/Dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY packages/${PACKAGE_NAME}/package*.json ./packages/${PACKAGE_NAME}/

# Install ALL dependencies (including dev for build)
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/${PACKAGE_NAME}/node_modules ./packages/${PACKAGE_NAME}/node_modules

# Copy source code
COPY tsconfig.base.json ./
COPY packages/${PACKAGE_NAME} ./packages/${PACKAGE_NAME}

# Build the package
WORKDIR /app/packages/${PACKAGE_NAME}
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built artifacts
COPY --from=builder /app/packages/${PACKAGE_NAME}/dist ./dist
COPY --from=builder /app/packages/${PACKAGE_NAME}/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Change ownership
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE ${INTERNAL_PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${INTERNAL_PORT:-3000}${HEALTH_ENDPOINT:-/health}', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
```

### Rule 3: .dockerignore Creation
```bash
# packages/${PACKAGE_NAME}/.dockerignore
node_modules
dist
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env
.env.*
!.env.example
coverage
.vscode
.idea
*.test.ts
*.spec.ts
tests
__tests__
.git
.gitignore
README.md
*.md
!package.json
!package-lock.json
.DS_Store
```

### Rule 4: Docker Compose Integration (Idempotent)
```yaml
# Append to docker-compose.yml if service doesn't exist
# MUST preserve existing services

check_service_exists() {
  grep -q "^  ${PACKAGE_NAME}:" docker-compose.yml 2>/dev/null
}

if ! check_service_exists; then
  cat >> docker-compose.yml <<EOF

  ${PACKAGE_NAME}:
    build:
      context: .
      dockerfile: packages/${PACKAGE_NAME}/Dockerfile
      args:
        - NODE_ENV=\${NODE_ENV:-production}
    container_name: ${PACKAGE_NAME}
    restart: \${${PACKAGE_NAME}_RESTART:-unless-stopped}
    ports:
      - "\${${PACKAGE_NAME}_EXTERNAL_PORT:-${EXTERNAL_PORT}}:\${${PACKAGE_NAME}_INTERNAL_PORT:-${INTERNAL_PORT}}"
    environment:
      - NODE_ENV=\${NODE_ENV:-production}
      - SERVICE_NAME=${PACKAGE_NAME}
      - PORT=\${${PACKAGE_NAME}_INTERNAL_PORT:-${INTERNAL_PORT}}
    env_file:
      - .env
    networks:
      - app-network
EOF

  # Add dependencies if specified
  if [ -n "${DEPENDS_ON}" ]; then
    cat >> docker-compose.yml <<EOF
    depends_on:
EOF
    IFS=',' read -ra DEPS <<< "${DEPENDS_ON}"
    for dep in "${DEPS[@]}"; do
      cat >> docker-compose.yml <<EOF
      ${dep}:
        condition: service_healthy
EOF
    done
  fi

  # Add health check
  cat >> docker-compose.yml <<EOF
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:\${${PACKAGE_NAME}_INTERNAL_PORT:-${INTERNAL_PORT}}${HEALTH_ENDPOINT:-/health}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF

  echo "✓ Added ${PACKAGE_NAME} to docker-compose.yml"
else
  echo "✓ Service ${PACKAGE_NAME} already exists in docker-compose.yml"
fi
```

### Rule 5: Environment Variables
```bash
# Add to .env.example (idempotent)
add_env_var() {
  local var_name=$1
  local var_value=$2

  if ! grep -q "^${var_name}=" .env.example 2>/dev/null; then
    echo "${var_name}=${var_value}" >> .env.example
    echo "✓ Added ${var_name} to .env.example"
  fi
}

add_env_var "${PACKAGE_NAME}_INTERNAL_PORT" "${INTERNAL_PORT:-3000}"
add_env_var "${PACKAGE_NAME}_EXTERNAL_PORT" "${EXTERNAL_PORT:-${INTERNAL_PORT:-3000}}"
add_env_var "${PACKAGE_NAME}_RESTART" "${RESTART_POLICY:-unless-stopped}"

# Package-specific env template
cat > "packages/${PACKAGE_NAME}/.env.example" <<EOF
# ${PACKAGE_NAME} Environment Variables
SERVICE_NAME=${PACKAGE_NAME}
PORT=${INTERNAL_PORT:-3000}
NODE_ENV=development
LOG_LEVEL=info

# Add your service-specific variables below
EOF
```

### Rule 6: Docker Build Scripts
```bash
# packages/${PACKAGE_NAME}/docker-build.sh
cat > "packages/${PACKAGE_NAME}/docker-build.sh" <<'EOF'
#!/bin/bash
set -e

PACKAGE_NAME="${PACKAGE_NAME}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-local}"

echo "🐳 Building Docker image for ${PACKAGE_NAME}..."

# Build from monorepo root
cd "$(git rev-parse --show-toplevel)"

docker build \
  -f "packages/${PACKAGE_NAME}/Dockerfile" \
  -t "${REGISTRY}/${PACKAGE_NAME}:${IMAGE_TAG}" \
  --build-arg NODE_ENV=production \
  .

echo "✓ Image built: ${REGISTRY}/${PACKAGE_NAME}:${IMAGE_TAG}"
EOF

chmod +x "packages/${PACKAGE_NAME}/docker-build.sh"
```

### Rule 7: Docker Compose Service Scripts
```json
// Add to packages/${PACKAGE_NAME}/package.json
{
  "scripts": {
    "docker:build": "./docker-build.sh",
    "docker:run": "docker compose up ${PACKAGE_NAME}",
    "docker:stop": "docker compose stop ${PACKAGE_NAME}",
    "docker:logs": "docker compose logs -f ${PACKAGE_NAME}",
    "docker:shell": "docker compose exec ${PACKAGE_NAME} sh"
  }
}
```

### Rule 8: Network Configuration Check
```bash
# Ensure app-network exists in docker-compose.yml
if ! grep -q "^networks:" docker-compose.yml; then
  cat >> docker-compose.yml <<EOF

networks:
  app-network:
    driver: bridge
EOF
  echo "✓ Created app-network in docker-compose.yml"
fi
```

### Rule 9: Development Docker Compose
```yaml
# Create docker-compose.dev.yml for development if not exists
if [ ! -f "docker-compose.dev.yml" ]; then
  cat > docker-compose.dev.yml <<EOF
version: '3.8'

services:
  ${PACKAGE_NAME}:
    build:
      context: .
      dockerfile: packages/${PACKAGE_NAME}/Dockerfile
      target: builder  # Use builder stage for dev
    volumes:
      - ./packages/${PACKAGE_NAME}/src:/app/packages/${PACKAGE_NAME}/src
      - ./packages/${PACKAGE_NAME}/tests:/app/packages/${PACKAGE_NAME}/tests
    environment:
      - NODE_ENV=development
      - DEBUG=*
    command: npm run dev -w packages/${PACKAGE_NAME}

networks:
  app-network:
    driver: bridge
EOF
else
  echo "⚠ docker-compose.dev.yml exists, manual merge may be needed"
fi
```

### Rule 10: Health Check Validation
```typescript
// Ensure health endpoint exists in src/index.ts
// This check is informational only - doesn't modify code

const healthEndpoint = \`${HEALTH_ENDPOINT:-/health}\`;

console.log(\`
⚠ IMPORTANT: Ensure your service has a health check endpoint at:
   ${healthEndpoint}

   Example implementation:
   app.get('${healthEndpoint}', (req, res) => {
     res.json({ status: 'healthy', timestamp: new Date().toISOString() });
   });
\`);
```

## Verification Checklist

```bash
# 1. Dockerfile exists and is valid
test -f "packages/${PACKAGE_NAME}/Dockerfile"
docker build -f "packages/${PACKAGE_NAME}/Dockerfile" -t "${PACKAGE_NAME}:test" . --no-cache

# 2. .dockerignore exists
test -f "packages/${PACKAGE_NAME}/.dockerignore"

# 3. Service in docker-compose.yml
grep -q "^  ${PACKAGE_NAME}:" docker-compose.yml

# 4. Environment variables in .env.example
grep -q "${PACKAGE_NAME}_INTERNAL_PORT" .env.example

# 5. Build scripts executable
test -x "packages/${PACKAGE_NAME}/docker-build.sh"

# 6. Network configuration
grep -q "app-network" docker-compose.yml

# 7. Health check configured
docker compose config --services | grep -q "${PACKAGE_NAME}"

# 8. Image builds successfully
docker compose build "${PACKAGE_NAME}"

# 9. Container starts and becomes healthy
docker compose up -d "${PACKAGE_NAME}"
sleep 10
docker compose ps "${PACKAGE_NAME}" | grep -q "healthy"

# 10. Health endpoint accessible
curl -f "http://localhost:${EXTERNAL_PORT}${HEALTH_ENDPOINT}"
```

## Success Criteria

✅ **MUST** achieve all:
1. Dockerfile created with multi-stage build
2. .dockerignore configured
3. Service added to docker-compose.yml
4. Environment variables documented
5. Docker image builds without errors
6. Container starts and reaches healthy state
7. Health endpoint responds with 200 OK
8. Network connectivity verified

## Output Report

```markdown
# Docker Integration Report

**Package**: ${PACKAGE_NAME}
**Status**: ✅ Success | ❌ Failed
**Timestamp**: ${ISO_TIMESTAMP}

## Configuration
- Internal Port: ${INTERNAL_PORT}
- External Port: ${EXTERNAL_PORT}
- Health Endpoint: ${HEALTH_ENDPOINT}
- Dependencies: ${DEPENDS_ON:-none}

## Created/Updated Files
- [x] packages/${PACKAGE_NAME}/Dockerfile
- [x] packages/${PACKAGE_NAME}/.dockerignore
- [x] packages/${PACKAGE_NAME}/docker-build.sh
- [x] docker-compose.yml (updated)
- [x] .env.example (updated)

## Build Results
- Image Size: XXX MB
- Build Time: XX seconds
- Layers: XX

## Container Health
- Status: healthy | unhealthy
- Startup Time: XX seconds
- Memory Usage: XXX MB
- Health Check: passing | failing

## Network
- Network: app-network
- Internal DNS: ${PACKAGE_NAME}:${INTERNAL_PORT}
- External Access: localhost:${EXTERNAL_PORT}

## Next Steps
1. Run `docker compose up ${PACKAGE_NAME}` to start service
2. Test endpoint: curl http://localhost:${EXTERNAL_PORT}/health
3. View logs: docker compose logs -f ${PACKAGE_NAME}
4. Continue with Test Scaffold Agent

## Dependencies
- Requires: 01-package-initializer (completed)
- Triggers: 03-test-scaffold, 06-integration-validator
```

## Error Handling

```bash
# Comprehensive error handling
set -e
trap 'handle_docker_error $? $LINENO' ERR

handle_docker_error() {
  echo "❌ Docker integration failed at line $2 with exit code $1"

  # Cleanup on failure
  echo "🧹 Cleaning up..."
  docker compose down "${PACKAGE_NAME}" 2>/dev/null || true
  docker rmi "${PACKAGE_NAME}:test" 2>/dev/null || true

  echo "Recovery steps:"
  echo "  1. Check Docker daemon is running: docker info"
  echo "  2. Verify package structure: ls packages/${PACKAGE_NAME}"
  echo "  3. Review Dockerfile syntax"
  echo "  4. Check port availability: lsof -i :${EXTERNAL_PORT}"
  echo "  5. Review logs above for specific error"
  echo "  6. Re-run agent after fixing issues"

  exit $1
}
```

## Idempotency Guarantees

- ✅ Checks if Dockerfile exists before creating
- ✅ Checks if service exists in docker-compose.yml
- ✅ Appends environment variables only if missing
- ✅ Preserves existing docker-compose.yml services
- ✅ Updates package.json scripts safely
- ✅ No data loss on re-run

## Advanced Features

### Custom Build Arguments
```bash
# Support custom build args
BUILD_ARGS="${BUILD_ARGS:-}"
if [ -n "$BUILD_ARGS" ]; then
  # Add to Dockerfile ARG declarations
  echo "Adding build args: $BUILD_ARGS"
fi
```

### Volume Mounts (Development)
```yaml
# Auto-detect if source should be mounted
volumes:
  - ./packages/${PACKAGE_NAME}/src:/app/packages/${PACKAGE_NAME}/src:ro
  - ./packages/${PACKAGE_NAME}/.env:/app/.env:ro
```

### Secrets Management
```bash
# Check for secrets and warn
if grep -q "password\|secret\|key" "packages/${PACKAGE_NAME}/.env" 2>/dev/null; then
  echo "⚠ WARNING: Potential secrets detected in .env"
  echo "   Use Docker secrets or external secret management"
fi
```

## Dependencies

**Requires**:
- Docker Engine 20.10+
- Docker Compose V2
- Package created by 01-package-initializer
- Root docker-compose.yml (will create if missing)

**Triggers Next**:
- 03-test-scaffold (Integration tests)
- 06-integration-validator (E2E validation)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
