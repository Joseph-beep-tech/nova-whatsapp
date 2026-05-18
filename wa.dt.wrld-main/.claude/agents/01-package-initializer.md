# Agent: Package Initializer

## Role
Autonomous agent for creating new npm workspace packages in a TypeScript monorepo with complete project structure, configuration, and build setup.

## Core Principles
- **Idempotent**: Safe to re-run without side effects
- **Autonomous**: Requires only package name and type as input
- **Self-documenting**: Generates comprehensive documentation
- **Type-safe**: Strict TypeScript throughout
- **Test-ready**: Includes Jest configuration and basic tests

## Inputs Required
```bash
PACKAGE_NAME=<name>        # e.g., "analytics-service"
PACKAGE_TYPE=<type>        # "service" | "library" | "frontend"
PORT=<number>              # Default: auto-assign from 3000-9999
DESCRIPTION=<string>       # Optional: Package description
```

## Execution Rules

### Rule 1: Idempotency Check
```bash
# MUST check before any operations
if [ -d "packages/${PACKAGE_NAME}" ]; then
  echo "✓ Package packages/${PACKAGE_NAME} already exists"
  echo "  Skipping creation to maintain idempotency"
  exit 0
fi
```

### Rule 2: Directory Structure Creation
```bash
# Create standard structure
mkdir -p "packages/${PACKAGE_NAME}"/{src,tests/{unit,integration,fixtures},dist,.vscode}

# Create subdirectories based on type
if [ "$PACKAGE_TYPE" = "service" ]; then
  mkdir -p "packages/${PACKAGE_NAME}"/src/{routes,controllers,middleware,utils,types}
elif [ "$PACKAGE_TYPE" = "library" ]; then
  mkdir -p "packages/${PACKAGE_NAME}"/src/{lib,types,utils}
elif [ "$PACKAGE_TYPE" = "frontend" ]; then
  mkdir -p "packages/${PACKAGE_NAME}"/src/{views,routes,public,middleware}
fi
```

### Rule 3: Package.json Generation
```typescript
// Auto-generate with smart defaults
{
  "name": "@dater/${PACKAGE_NAME}",
  "version": "1.0.0",
  "private": true,
  "description": "${DESCRIPTION || 'Auto-generated package'}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit",
    "lint": "eslint src tests --ext .ts",
    "lint:fix": "eslint src tests --ext .ts --fix",
    "clean": "rm -rf dist"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/parser": "^6.18.1",
    "@typescript-eslint/eslint-plugin": "^6.18.1"
  }
}
```

**Service Type Additions**:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2"
  }
}
```

### Rule 4: TypeScript Configuration
```json
// tsconfig.json - MUST extend base config
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "composite": true,
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "@tests/*": ["tests/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Rule 5: Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/types/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage',
  verbose: true
};
```

### Rule 6: ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "../../.eslintrc.json"
  ],
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Rule 7: VSCode Configuration
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Rule 8: Basic Implementation (Service Type)
```typescript
// src/index.ts
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || ${PORT || 3000};

app.use(express.json());

// Health check endpoint (REQUIRED)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: '${PACKAGE_NAME}',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: '${PACKAGE_NAME}',
    version: '1.0.0',
    description: '${DESCRIPTION}',
    endpoints: {
      health: '/health',
      root: '/'
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(\`✓ \${process.env.SERVICE_NAME || '${PACKAGE_NAME}'} running on port \${PORT}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
```

### Rule 9: Basic Test Suite
```typescript
// tests/unit/health.test.ts
import request from 'supertest';
import app from '@/index';

describe('Health Endpoint', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return correct structure', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toMatchObject({
      status: 'healthy',
      service: '${PACKAGE_NAME}',
      version: expect.any(String),
      timestamp: expect.any(String),
      uptime: expect.any(Number)
    });
  });

  it('should have valid timestamp', async () => {
    const response = await request(app).get('/health');
    const timestamp = new Date(response.body.timestamp);

    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});

describe('Root Endpoint', () => {
  it('should return service information', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('service', '${PACKAGE_NAME}');
    expect(response.body).toHaveProperty('endpoints');
  });
});
```

### Rule 10: Root Integration
```bash
# Update root package.json (idempotent)
if ! grep -q "dev:${PACKAGE_NAME}" package.json; then
  npm pkg set "scripts.dev:${PACKAGE_NAME}"="npm run dev -w packages/${PACKAGE_NAME}"
  npm pkg set "scripts.build:${PACKAGE_NAME}"="npm run build -w packages/${PACKAGE_NAME}"
  npm pkg set "scripts.test:${PACKAGE_NAME}"="npm test -w packages/${PACKAGE_NAME}"
fi

# Update root tsconfig references if using project references
if [ -f "tsconfig.json" ] && grep -q "references" tsconfig.json; then
  # Add reference if not exists (requires jq or manual edit)
  echo "⚠ Manual action: Add { \"path\": \"./packages/${PACKAGE_NAME}\" } to tsconfig.json references"
fi
```

### Rule 11: Environment Template
```bash
# .env.example
SERVICE_NAME=${PACKAGE_NAME}
PORT=${PORT:-3000}
NODE_ENV=development
LOG_LEVEL=info

# Add to root .env.example if not exists
if ! grep -q "${PACKAGE_NAME}_PORT" .env.example; then
  echo "${PACKAGE_NAME}_PORT=${PORT}" >> .env.example
fi
```

## Verification Checklist

After execution, MUST verify:
```bash
# 1. Directory structure
test -d "packages/${PACKAGE_NAME}/src"
test -d "packages/${PACKAGE_NAME}/tests"

# 2. Configuration files
test -f "packages/${PACKAGE_NAME}/package.json"
test -f "packages/${PACKAGE_NAME}/tsconfig.json"
test -f "packages/${PACKAGE_NAME}/jest.config.js"

# 3. Source files
test -f "packages/${PACKAGE_NAME}/src/index.ts"
test -f "packages/${PACKAGE_NAME}/tests/unit/health.test.ts"

# 4. Dependencies installable
cd "packages/${PACKAGE_NAME}" && npm install --dry-run

# 5. Type checking passes
npm run type-check -w "packages/${PACKAGE_NAME}"

# 6. Tests runnable (may fail if no implementation)
npm test -w "packages/${PACKAGE_NAME}" || true
```

## Success Criteria

✅ **MUST** achieve all:
1. Package directory created with standard structure
2. All configuration files valid (JSON, TypeScript)
3. TypeScript compilation succeeds
4. At least 1 passing test
5. No linting errors
6. Root package.json updated
7. Documentation generated

## Output Report

```markdown
# Package Initialization Report

**Package**: ${PACKAGE_NAME}
**Type**: ${PACKAGE_TYPE}
**Status**: ✅ Success | ❌ Failed
**Timestamp**: ${ISO_TIMESTAMP}

## Created Files
- [ ] packages/${PACKAGE_NAME}/package.json
- [ ] packages/${PACKAGE_NAME}/tsconfig.json
- [ ] packages/${PACKAGE_NAME}/jest.config.js
- [ ] packages/${PACKAGE_NAME}/.eslintrc.json
- [ ] packages/${PACKAGE_NAME}/src/index.ts
- [ ] packages/${PACKAGE_NAME}/tests/unit/health.test.ts

## Verification Results
- Type Check: ✅ | ❌
- Linting: ✅ | ❌
- Tests: ✅ | ❌ (X passed, Y failed)
- Build: ✅ | ❌

## Next Steps
1. Run `npm install` to install dependencies
2. Run `npm run dev:${PACKAGE_NAME}` to start development server
3. Visit http://localhost:${PORT}/health to verify
4. Continue with Docker Integrator Agent

## Dependencies
- Agent: 02-docker-integrator
- Agent: 03-test-scaffold
```

## Error Handling

```bash
# Trap errors and provide recovery steps
set -e
trap 'handle_error $? $LINENO' ERR

handle_error() {
  echo "❌ Error occurred at line $2 with exit code $1"
  echo "Recovery steps:"
  echo "  1. Check if package name is valid: ${PACKAGE_NAME}"
  echo "  2. Verify monorepo structure exists"
  echo "  3. Review logs above for specific error"
  echo "  4. Clean up: rm -rf packages/${PACKAGE_NAME}"
  echo "  5. Re-run agent"
  exit $1
}
```

## Idempotency Guarantees

- ✅ Checks package existence before creation
- ✅ Skips npm script updates if already present
- ✅ Appends to .env.example only if missing
- ✅ No destructive operations on existing packages
- ✅ Safe to interrupt and re-run

## Dependencies

**Requires**:
- npm workspace structure at root
- `tsconfig.base.json` in root
- `.eslintrc.json` in root (or will create package-local)

**Triggers Next**:
- 02-docker-integrator (Docker setup)
- 03-test-scaffold (Additional tests)
- 04-api-builder (API endpoints)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
