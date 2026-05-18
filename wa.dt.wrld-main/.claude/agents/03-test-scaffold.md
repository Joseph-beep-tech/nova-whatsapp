# Agent: Test Scaffold

## Role
Autonomous agent for generating comprehensive test suites following TDD principles, including unit tests, integration tests, API tests, and fixtures for TypeScript services.

## Core Principles
- **Idempotent**: Adds tests without overwriting existing ones
- **Autonomous**: Analyzes code structure to generate relevant tests
- **Self-documenting**: Tests serve as living documentation
- **TDD-ready**: Red-Green-Refactor workflow support
- **High coverage**: 80%+ threshold enforcement

## Inputs Required
```bash
PACKAGE_NAME=<name>           # e.g., "analytics-service"
TEST_TYPES=<csv>              # "unit,integration,api,e2e" (comma-separated)
COVERAGE_THRESHOLD=<number>   # Default: 80
AUTO_DETECT_ENDPOINTS=<bool>  # Default: true (scan for routes)
```

## Execution Rules

### Rule 1: Package Validation & Analysis
```bash
# Verify package exists
if [ ! -d "packages/${PACKAGE_NAME}" ]; then
  echo "❌ Package not found"
  exit 1
fi

# Analyze package structure
PACKAGE_TYPE=$(detect_package_type "packages/${PACKAGE_NAME}")
ENDPOINTS=$(scan_endpoints "packages/${PACKAGE_NAME}/src")
CLASSES=$(scan_classes "packages/${PACKAGE_NAME}/src")

echo "📊 Analysis:"
echo "  Type: ${PACKAGE_TYPE}"
echo "  Endpoints: $(echo $ENDPOINTS | wc -w)"
echo "  Classes: $(echo $CLASSES | wc -w)"
```

### Rule 2: Test Directory Structure
```bash
# Create comprehensive test structure (idempotent)
mkdir -p "packages/${PACKAGE_NAME}/tests"/{unit,integration,api,e2e,fixtures}

# Subdirectories based on source structure
for dir in $(find "packages/${PACKAGE_NAME}/src" -type d -not -path "*/node_modules/*"); do
  rel_path=${dir#packages/${PACKAGE_NAME}/src/}
  if [ -n "$rel_path" ] && [ "$rel_path" != "." ]; then
    mkdir -p "packages/${PACKAGE_NAME}/tests/unit/${rel_path}"
  fi
done
```

### Rule 3: Test Fixtures & Mocks
```typescript
// tests/fixtures/mocks.ts
/**
 * Shared test mocks and fixtures for ${PACKAGE_NAME}
 * Auto-generated - customize as needed
 */

import { Request, Response } from 'express';

/**
 * Mock Express Request
 */
export const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  get: jest.fn((name: string) => undefined),
  ...overrides
});

/**
 * Mock Express Response
 */
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return res;
};

/**
 * Mock Console (for testing logs)
 */
export const mockConsole = () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

/**
 * Test data factory
 */
export const createTestData = () => ({
  validInput: {
    // Auto-generate based on types
  },
  invalidInput: {
    // Auto-generate edge cases
  }
});

/**
 * Wait helper for async operations
 */
export const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock timers setup
 */
export const setupMockTimers = () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
};
```

### Rule 4: Unit Test Templates
```typescript
// tests/unit/[component].test.ts - Generated for each source file
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import the module being tested
// import { FunctionName } from '@/path/to/module';

describe('${COMPONENT_NAME}', () => {
  describe('${FUNCTION_NAME}', () => {
    it('should handle valid input correctly', () => {
      // Arrange
      const input = {};

      // Act
      // const result = functionName(input);

      // Assert
      expect(true).toBe(true); // TODO: Replace with actual test
    });

    it('should handle invalid input gracefully', () => {
      // Test error cases
      expect(true).toBe(true); // TODO: Implement
    });

    it('should handle edge cases', () => {
      // Test boundary conditions
      expect(true).toBe(true); // TODO: Implement
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate errors', () => {
      expect(() => {
        // Code that should throw
      }).toThrow();
    });
  });
});
```

### Rule 5: Integration Test Templates
```typescript
// tests/integration/database.test.ts (if database detected)
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Database Integration', () => {
  beforeAll(async () => {
    // Setup test database
    // await setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup
    // await teardownTestDatabase();
  });

  it('should connect to database', async () => {
    // Test connection
    expect(true).toBe(true); // TODO: Implement
  });

  it('should perform CRUD operations', async () => {
    // Test database operations
    expect(true).toBe(true); // TODO: Implement
  });

  it('should handle transactions', async () => {
    // Test transaction rollback
    expect(true).toBe(true); // TODO: Implement
  });
});
```

### Rule 6: API Test Templates (Auto-generated from routes)
```typescript
// tests/api/endpoints.test.ts
import request from 'supertest';
import app from '@/index';

describe('API Endpoints', () => {
  // Auto-generated for each detected endpoint
  ${ENDPOINTS.map(endpoint => `
  describe('${endpoint.method} ${endpoint.path}', () => {
    it('should return ${endpoint.expectedStatus} for valid request', async () => {
      const response = await request(app)
        .${endpoint.method.toLowerCase()}('${endpoint.path}')
        .send(${endpoint.samplePayload || '{}'});

      expect(response.status).toBe(${endpoint.expectedStatus});
      expect(response.body).toMatchObject({
        // Expected response shape
      });
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .${endpoint.method.toLowerCase()}('${endpoint.path}')
        .send({}); // Invalid payload

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle authentication', async () => {
      const response = await request(app)
        .${endpoint.method.toLowerCase()}('${endpoint.path}');

      // Expect 401 or success based on endpoint
      expect([200, 401]).toContain(response.status);
    });
  });
  `).join('\n')}

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent');
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/endpoint')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://example.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      // Expect rate limiting if configured
      expect(rateLimited || responses.every(r => r.status === 200)).toBe(true);
    });
  });
});
```

### Rule 7: E2E Test Templates (for services with UI)
```typescript
// tests/e2e/user-flow.test.ts
import { describe, it, expect } from '@jest/globals';
// If using Playwright/Puppeteer
// import { chromium, Browser, Page } from 'playwright';

describe('End-to-End User Flows', () => {
  // let browser: Browser;
  // let page: Page;

  beforeAll(async () => {
    // browser = await chromium.launch();
    // page = await browser.newPage();
  });

  afterAll(async () => {
    // await browser.close();
  });

  it('should complete primary user flow', async () => {
    // Navigate, interact, verify
    expect(true).toBe(true); // TODO: Implement
  });
});
```

### Rule 8: Coverage Configuration Update
```javascript
// Update jest.config.js coverage thresholds
const coverageThreshold = ${COVERAGE_THRESHOLD:-80};

module.exports = {
  // ... existing config
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/types/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: coverageThreshold,
      functions: coverageThreshold,
      lines: coverageThreshold,
      statements: coverageThreshold
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage'
};
```

### Rule 9: Test Utilities
```typescript
// tests/fixtures/test-server.ts
/**
 * Test server utilities for integration tests
 */
import app from '@/index';
import { Server } from 'http';

let server: Server | null = null;

export const startTestServer = (port: number = 0): Promise<number> => {
  return new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      const address = server!.address();
      const actualPort = typeof address === 'string' ? 0 : address!.port;
      resolve(actualPort);
    });

    server.on('error', reject);
  });
};

export const stopTestServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
};

// Cleanup on process exit
process.on('exit', () => {
  if (server) {
    server.close();
  }
});
```

### Rule 10: Test Commands Update
```json
// Update package.json scripts (idempotent)
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:api": "jest tests/api",
    "test:e2e": "jest tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:coverage:report": "open coverage/lcov-report/index.html",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Verification Checklist

```bash
# 1. Test structure created
test -d "packages/${PACKAGE_NAME}/tests/unit"
test -d "packages/${PACKAGE_NAME}/tests/integration"
test -d "packages/${PACKAGE_NAME}/tests/fixtures"

# 2. Test files exist
find "packages/${PACKAGE_NAME}/tests" -name "*.test.ts" | grep -q .

# 3. Fixtures created
test -f "packages/${PACKAGE_NAME}/tests/fixtures/mocks.ts"

# 4. Tests runnable
npm test -w "packages/${PACKAGE_NAME}" -- --passWithNoTests

# 5. Coverage configuration
grep -q "coverageThreshold" "packages/${PACKAGE_NAME}/jest.config.js"

# 6. Test scripts in package.json
grep -q "test:coverage" "packages/${PACKAGE_NAME}/package.json"
```

## Success Criteria

✅ **MUST** achieve all:
1. Test directory structure created
2. At least 1 test file per test type requested
3. Fixtures and mocks available
4. Coverage thresholds configured
5. All tests pass (or marked as TODO)
6. Test commands functional
7. Documentation comments in tests

## Output Report

```markdown
# Test Scaffold Report

**Package**: ${PACKAGE_NAME}
**Status**: ✅ Success | ❌ Failed
**Timestamp**: ${ISO_TIMESTAMP}

## Test Coverage
- Unit Tests: XX files
- Integration Tests: XX files
- API Tests: XX files
- E2E Tests: XX files
- Total Test Cases: XXX

## Generated Files
- [ ] tests/unit/*.test.ts
- [ ] tests/integration/*.test.ts
- [ ] tests/api/endpoints.test.ts
- [ ] tests/fixtures/mocks.ts
- [ ] tests/fixtures/test-server.ts

## Coverage Configuration
- Threshold: ${COVERAGE_THRESHOLD}%
- Branches: ${COVERAGE_THRESHOLD}%
- Functions: ${COVERAGE_THRESHOLD}%
- Lines: ${COVERAGE_THRESHOLD}%
- Statements: ${COVERAGE_THRESHOLD}%

## Test Execution
- Total Tests: XX
- Passing: XX
- Failing: 0
- Pending (TODO): XX
- Duration: XX.XXs

## Code Coverage (Current)
- Branches: XX%
- Functions: XX%
- Lines: XX%
- Statements: XX%

## Next Steps
1. Run `npm run test:watch -w packages/${PACKAGE_NAME}` for TDD
2. Implement TODO test cases
3. Run `npm run test:coverage` to check coverage
4. Continue with API Builder Agent

## Dependencies
- Requires: 01-package-initializer (completed)
- Triggers: 04-api-builder, 06-integration-validator
```

## Error Handling

```bash
set -e
trap 'handle_test_error $? $LINENO' ERR

handle_test_error() {
  echo "❌ Test scaffold failed at line $2 with exit code $1"

  echo "Recovery steps:"
  echo "  1. Verify Jest is installed: npm list jest"
  echo "  2. Check package structure: ls packages/${PACKAGE_NAME}"
  echo "  3. Validate jest.config.js syntax"
  echo "  4. Ensure TypeScript compiles: npm run type-check"
  echo "  5. Review error message above"
  echo "  6. Re-run agent"

  exit $1
}
```

## Idempotency Guarantees

- ✅ Creates directories only if missing
- ✅ Generates test files with unique names (timestamp suffix if exists)
- ✅ Appends to package.json scripts safely
- ✅ Merges coverage configuration
- ✅ Preserves existing test files

## Advanced Features

### Auto-Detection of Test Patterns
```bash
# Scan source code for testable patterns
detect_endpoints() {
  grep -r "app\.\(get\|post\|put\|delete\|patch\)" "$1" | \
    sed -E "s/.*app\.(get|post|put|delete|patch)\(['\"](.*)['\"].*/\1 \2/" | \
    sort -u
}

detect_classes() {
  grep -r "^export class" "$1" | \
    sed -E "s/.*class ([A-Za-z0-9_]+).*/\1/" | \
    sort -u
}
```

### Smart Test Generation
```typescript
// Analyze function signatures to generate tests
// Uses TypeScript compiler API to extract types
// and generate appropriate test cases
```

### Snapshot Testing
```typescript
// For components with complex output
it('should match snapshot', () => {
  const result = complexFunction();
  expect(result).toMatchSnapshot();
});
```

## Dependencies

**Requires**:
- Package created by 01-package-initializer
- Jest configured (from initializer)
- TypeScript compiler

**Triggers Next**:
- 04-api-builder (API endpoint implementation)
- 06-integration-validator (E2E validation)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
