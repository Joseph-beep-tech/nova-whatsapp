# Agent: Documentation Agent

## Role
Autonomous agent for generating comprehensive, living documentation including README files, API docs, architecture diagrams, and inline code documentation following best practices.

## Core Principles
- **Idempotent**: Updates documentation without losing manual edits
- **Autonomous**: Analyzes code to extract documentation
- **Self-documenting**: Documentation as code
- **Living**: Auto-updates from code comments and types
- **Multi-format**: Markdown, JSDoc, OpenAPI, Mermaid diagrams

## Inputs Required
```bash
PACKAGE_NAME=<name>           # e.g., "analytics-service"
DOC_TYPES=<csv>               # "readme,api,architecture,jsdoc" (comma-separated)
INCLUDE_DIAGRAMS=<bool>       # Default: true (Mermaid diagrams)
INCLUDE_EXAMPLES=<bool>       # Default: true (Code examples)
OUTPUT_FORMAT=<format>        # "markdown" | "html" | "both" (default: markdown)
```

## Execution Rules

### Rule 1: Documentation Structure Setup
```bash
# Create documentation directories (idempotent)
mkdir -p "packages/${PACKAGE_NAME}"/{docs/{api,architecture,guides},examples}

# Create assets directory for diagrams
mkdir -p "packages/${PACKAGE_NAME}/docs/assets"
```

### Rule 2: README.md Generation
```markdown
# ${PACKAGE_NAME}

> Auto-generated documentation - Last updated: ${TIMESTAMP}

## Overview

${PACKAGE_DESCRIPTION}

## Features

${AUTO_DETECT_FEATURES}

- ✅ RESTful API with ${ENDPOINT_COUNT} endpoints
- ✅ TypeScript with strict type checking
- ✅ Comprehensive test coverage (${COVERAGE}%)
- ✅ Docker containerization
- ✅ OpenAPI documentation
- ✅ Health check monitoring

## Quick Start

### Installation

\`\`\`bash
# Install dependencies (from monorepo root)
npm install

# Install package dependencies only
npm install -w packages/${PACKAGE_NAME}
\`\`\`

### Development

\`\`\`bash
# Start development server
npm run dev:${PACKAGE_NAME}

# Run tests in watch mode
npm run test:watch -w packages/${PACKAGE_NAME}

# Type checking
npm run type-check -w packages/${PACKAGE_NAME}
\`\`\`

### Production Build

\`\`\`bash
# Build the package
npm run build:${PACKAGE_NAME}

# Build Docker image
cd packages/${PACKAGE_NAME}
./docker-build.sh
\`\`\`

## API Documentation

### Base URL
\`\`\`
${BASE_URL}${BASE_PATH}
\`\`\`

### Authentication
${AUTH_DESCRIPTION}

### Endpoints

${ENDPOINTS.map(ep => `
#### ${ep.method} ${ep.path}

${ep.description}

**Request:**
\`\`\`json
${JSON.stringify(ep.requestExample, null, 2)}
\`\`\`

**Response (${ep.successCode}):**
\`\`\`json
${JSON.stringify(ep.responseExample, null, 2)}
\`\`\`

**Error Codes:**
- \`400\` - Validation error
- \`401\` - Authentication required
- \`404\` - Resource not found
- \`500\` - Internal server error
`).join('\n\n')}

### Interactive Documentation

Visit [\`/api-docs\`](http://localhost:${PORT}/api-docs) for interactive Swagger UI.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
${ENV_VARS.map(v => `| \`${v.name}\` | ${v.required ? '✅' : '❌'} | \`${v.default || '-'}\` | ${v.description} |`).join('\n')}

### Example Configuration

\`\`\`bash
# .env
${ENV_VARS.map(v => `${v.name}=${v.exampleValue}`).join('\n')}
\`\`\`

## Architecture

### System Overview

\`\`\`mermaid
graph TB
    Client[Client] -->|HTTP| API[API Layer]
    API -->|Validates| Validator[Validation Layer]
    Validator -->|Processes| Controller[Controller Layer]
    Controller -->|Business Logic| Service[Service Layer]
    Service -->|Persistence| DB[(Database)]
    Service -->|Events| Queue[Message Queue]

    style API fill:#4a90e2
    style Controller fill:#50c878
    style Service fill:#ff6b6b
\`\`\`

### Component Architecture

\`\`\`mermaid
graph LR
    Routes[Routes] -->|Uses| Middleware[Middleware]
    Middleware -->|Validates| Validators[Validators]
    Validators -->|Calls| Controllers[Controllers]
    Controllers -->|Uses| Services[Services]
    Services -->|Uses| Models[Models]
    Services -->|Uses| Utils[Utilities]

    style Routes fill:#667eea
    style Controllers fill:#764ba2
    style Services fill:#f093fb
\`\`\`

### Request Flow

\`\`\`mermaid
sequenceDiagram
    participant C as Client
    participant R as Router
    participant A as Auth Middleware
    participant V as Validator
    participant Ctrl as Controller
    participant S as Service
    participant DB as Database

    C->>R: HTTP Request
    R->>A: Authenticate
    A-->>R: Authorized
    R->>V: Validate Request
    V-->>R: Valid
    R->>Ctrl: Handle Request
    Ctrl->>S: Business Logic
    S->>DB: Query/Update
    DB-->>S: Result
    S-->>Ctrl: Processed Data
    Ctrl-->>R: Response
    R-->>C: HTTP Response
\`\`\`

## Project Structure

\`\`\`
packages/${PACKAGE_NAME}/
├── src/
│   ├── controllers/      # Request handlers
│   ├── routes/          # API route definitions
│   ├── middleware/      # Express middleware
│   │   ├── auth/       # Authentication
│   │   ├── validation/ # Request validation
│   │   └── error/      # Error handling
│   ├── validators/     # Joi schemas
│   ├── services/       # Business logic
│   ├── models/         # Data models
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── api/           # API endpoint tests
│   └── fixtures/      # Test utilities
├── docs/              # Documentation
├── examples/          # Usage examples
├── Dockerfile         # Container definition
├── jest.config.js     # Test configuration
├── tsconfig.json      # TypeScript config
└── package.json       # Package metadata
\`\`\`

## Testing

### Running Tests

\`\`\`bash
# All tests
npm test -w packages/${PACKAGE_NAME}

# Watch mode (TDD)
npm run test:watch -w packages/${PACKAGE_NAME}

# Coverage report
npm run test:coverage -w packages/${PACKAGE_NAME}

# Specific test file
npm test -w packages/${PACKAGE_NAME} -- tests/unit/controller.test.ts
\`\`\`

### Test Coverage

Current coverage: **${COVERAGE}%**

\`\`\`
Statements   : ${COVERAGE_STATEMENTS}%
Branches     : ${COVERAGE_BRANCHES}%
Functions    : ${COVERAGE_FUNCTIONS}%
Lines        : ${COVERAGE_LINES}%
\`\`\`

### Writing Tests

\`\`\`typescript
import request from 'supertest';
import app from '@/index';

describe('Example Test', () => {
  it('should test endpoint', async () => {
    const response = await request(app)
      .get('/api/v1/resource')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object)
    });
  });
});
\`\`\`

## Docker

### Build Image

\`\`\`bash
# From package directory
cd packages/${PACKAGE_NAME}
./docker-build.sh

# Or from monorepo root
docker compose build ${PACKAGE_NAME}
\`\`\`

### Run Container

\`\`\`bash
# Using docker-compose
docker compose up ${PACKAGE_NAME}

# Standalone
docker run -p ${PORT}:${PORT} --env-file .env ${PACKAGE_NAME}
\`\`\`

### Docker Commands

\`\`\`bash
# View logs
docker compose logs -f ${PACKAGE_NAME}

# Shell access
docker compose exec ${PACKAGE_NAME} sh

# Stop service
docker compose stop ${PACKAGE_NAME}

# Remove container
docker compose down ${PACKAGE_NAME}
\`\`\`

## Development

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced on commit
- **Formatting**: Prettier (auto-format on save)
- **Naming**: camelCase for variables, PascalCase for classes

### Git Workflow

\`\`\`bash
# Feature branch
git checkout -b feature/${PACKAGE_NAME}-new-feature

# Commit changes
git add .
git commit -m "feat(${PACKAGE_NAME}): add new feature"

# Run tests before push
npm test -w packages/${PACKAGE_NAME}

# Push changes
git push origin feature/${PACKAGE_NAME}-new-feature
\`\`\`

### Adding New Endpoints

1. Define types in \`src/types/api.ts\`
2. Create validator in \`src/validators/\`
3. Implement controller in \`src/controllers/\`
4. Add route in \`src/routes/\`
5. Write tests in \`tests/api/\`
6. Update documentation

## Troubleshooting

### Common Issues

#### Port Already in Use
\`\`\`bash
# Find process using port
lsof -i :${PORT}

# Kill process
kill -9 <PID>
\`\`\`

#### TypeScript Errors
\`\`\`bash
# Clean build artifacts
npm run clean -w packages/${PACKAGE_NAME}

# Rebuild
npm run build -w packages/${PACKAGE_NAME}
\`\`\`

#### Test Failures
\`\`\`bash
# Run tests with verbose output
npm test -w packages/${PACKAGE_NAME} -- --verbose

# Clear Jest cache
npm test -w packages/${PACKAGE_NAME} -- --clearCache
\`\`\`

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

${LICENSE}

## Related Packages

${RELATED_PACKAGES.map(p => `- [${p.name}](../${p.name}/README.md) - ${p.description}`).join('\n')}

## Support

- **Issues**: [GitHub Issues](../../issues)
- **Documentation**: [Full Docs](./docs/)
- **API Docs**: [Swagger UI](http://localhost:${PORT}/api-docs)

---

**Auto-generated by Documentation Agent v1.0.0**
**Last Updated**: ${TIMESTAMP}
```

### Rule 3: API Documentation (OpenAPI/Swagger)
```yaml
# docs/api/openapi.yaml
openapi: 3.0.0
info:
  title: ${PACKAGE_NAME} API
  version: 1.0.0
  description: ${PACKAGE_DESCRIPTION}
  contact:
    name: API Support
    email: support@example.com

servers:
  - url: http://localhost:${PORT}${BASE_PATH}
    description: Development server
  - url: https://api.production.com${BASE_PATH}
    description: Production server

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    ${TYPES.map(type => `
    ${type.name}:
      type: object
      properties:
        ${type.properties.map(p => `
        ${p.name}:
          type: ${p.type}
          description: ${p.description}
          ${p.required ? 'required: true' : ''}
        `).join('\n')}
    `).join('\n')}

    ApiResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
        error:
          $ref: '#/components/schemas/ApiError'

    ApiError:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

paths:
  ${ENDPOINTS.map(ep => `
  ${ep.path}:
    ${ep.method.toLowerCase()}:
      summary: ${ep.summary}
      description: ${ep.description}
      tags:
        - ${ep.tag}
      ${ep.authRequired ? 'security:\n        - bearerAuth: []' : ''}
      parameters:
        ${ep.params.map(p => `
        - name: ${p.name}
          in: ${p.in}
          required: ${p.required}
          schema:
            type: ${p.type}
          description: ${p.description}
        `).join('\n')}
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/${ep.requestSchema}'
      responses:
        '${ep.successCode}':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResponse'
        '400':
          description: Validation error
        '401':
          description: Unauthorized
        '500':
          description: Internal server error
  `).join('\n')}
```

### Rule 4: Architecture Documentation
```markdown
# docs/architecture/ARCHITECTURE.md

# ${PACKAGE_NAME} Architecture

## System Design

### High-Level Overview

${PACKAGE_NAME} is designed as a modular, scalable microservice following clean architecture principles.

### Design Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Type Safety**: Strict TypeScript throughout
4. **Testability**: All components are unit-testable
5. **Scalability**: Horizontal scaling via Docker containers

### Layer Architecture

\`\`\`
┌─────────────────────────────────────┐
│         Presentation Layer          │
│     (Routes, Middleware, DTOs)      │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│         Application Layer           │
│       (Controllers, Validators)     │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│          Business Layer             │
│      (Services, Domain Logic)       │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│         Data Access Layer           │
│      (Repositories, Models)         │
└─────────────────────────────────────┘
\`\`\`

## Data Flow

1. **Request Reception**: Express router receives HTTP request
2. **Authentication**: Auth middleware validates credentials
3. **Validation**: Joi schemas validate request structure
4. **Controller**: Maps request to service call
5. **Service**: Executes business logic
6. **Repository**: Performs data operations
7. **Response**: Standardized API response returned

## Technologies

- **Runtime**: Node.js 20
- **Language**: TypeScript 5.3+
- **Framework**: Express.js 4
- **Validation**: Joi
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker

## Scalability Considerations

- Stateless design for horizontal scaling
- Database connection pooling
- Caching strategy (Redis)
- Rate limiting per client
- Load balancing ready

## Security

- API key authentication
- Input validation on all endpoints
- CORS configuration
- Helmet.js security headers
- SQL injection prevention
- XSS protection

---

**Last Updated**: ${TIMESTAMP}
```

### Rule 5: JSDoc Generation
```bash
# Generate TypeDoc documentation
if ! grep -q "typedoc" "packages/${PACKAGE_NAME}/package.json"; then
  cd "packages/${PACKAGE_NAME}"
  npm install --save-dev typedoc

  # Add script
  npm pkg set "scripts.docs:generate"="typedoc --out docs/api src/index.ts"
  npm pkg set "scripts.docs:serve"="npx http-server docs/api -p 8080"

  # Generate
  npm run docs:generate
fi
```

### Rule 6: Usage Examples
```typescript
// examples/basic-usage.ts
/**
 * Basic Usage Examples for ${PACKAGE_NAME}
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:${PORT}${BASE_PATH}';
const API_KEY = process.env.API_KEY;

/**
 * Example 1: Simple GET request
 */
async function exampleGet() {
  try {
    const response = await axios.get(\`\${API_BASE_URL}/resource\`, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`
      }
    });

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

/**
 * Example 2: POST request with validation
 */
async function examplePost() {
  try {
    const response = await axios.post(
      \`\${API_BASE_URL}/resource\`,
      {
        name: 'Test Resource',
        value: 42
      },
      {
        headers: {
          'Authorization': \`Bearer \${API_KEY}\`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Created:', response.data);
  } catch (error) {
    console.error('Validation error:', error.response?.data?.error);
  }
}

/**
 * Example 3: Error handling
 */
async function exampleErrorHandling() {
  try {
    await axios.get(\`\${API_BASE_URL}/nonexistent\`);
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.log('Error Code:', error.response.data.error.code);
      console.log('Error Message:', error.response.data.error.message);
    } else if (error.request) {
      // No response received
      console.error('No response from server');
    } else {
      // Request setup error
      console.error('Error:', error.message);
    }
  }
}

// Run examples
(async () => {
  await exampleGet();
  await examplePost();
  await exampleErrorHandling();
})();
```

### Rule 7: Changelog Generation
```markdown
# CHANGELOG.md

# Changelog

All notable changes to ${PACKAGE_NAME} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - ${DATE}

### Added
- Initial release
- RESTful API with ${ENDPOINT_COUNT} endpoints
- Docker containerization
- Comprehensive test suite (${COVERAGE}% coverage)
- OpenAPI documentation
- Health check monitoring

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- API key authentication
- Input validation

---

[Unreleased]: https://github.com/org/repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/org/repo/releases/tag/v1.0.0
```

## Verification Checklist

```bash
# 1. README exists and is valid
test -f "packages/${PACKAGE_NAME}/README.md"
grep -q "## Quick Start" "packages/${PACKAGE_NAME}/README.md"

# 2. API docs generated
test -f "packages/${PACKAGE_NAME}/docs/api/openapi.yaml"

# 3. Architecture docs exist
test -f "packages/${PACKAGE_NAME}/docs/architecture/ARCHITECTURE.md"

# 4. Examples provided
test -d "packages/${PACKAGE_NAME}/examples"

# 5. Changelog present
test -f "packages/${PACKAGE_NAME}/CHANGELOG.md"

# 6. Mermaid diagrams render
grep -q "```mermaid" "packages/${PACKAGE_NAME}/README.md"

# 7. Links are valid (basic check)
grep -o 'http[s]\?://[^)]*' "packages/${PACKAGE_NAME}/README.md" | while read url; do
  curl -f -I "$url" 2>/dev/null || echo "⚠ Broken link: $url"
done
```

## Success Criteria

✅ **MUST** achieve all:
1. README.md comprehensive and accurate
2. API documentation complete
3. Architecture diagrams included
4. Code examples provided
5. Changelog initialized
6. JSDoc comments added
7. All links valid
8. Documentation builds without errors

## Idempotency Guarantees

- ✅ Preserves manual edits in README
- ✅ Appends to CHANGELOG without overwriting
- ✅ Updates generated sections only
- ✅ Keeps custom examples
- ✅ Merges OpenAPI specs

## Dependencies

**Requires**:
- Package with implemented code
- API endpoints from 04-api-builder
- Test coverage data

**Triggers Next**:
- 06-integration-validator (Final validation)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
