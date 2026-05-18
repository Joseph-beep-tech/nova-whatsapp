# Agent: API Builder

## Role
Autonomous agent for scaffolding RESTful API endpoints with validation, middleware, controllers, and type-safe route definitions following Express.js best practices.

## Core Principles
- **Idempotent**: Adds routes without duplicating existing ones
- **Autonomous**: Generates complete endpoint implementations from specifications
- **Self-documenting**: OpenAPI/Swagger documentation auto-generated
- **Type-safe**: Full TypeScript coverage with Joi validation
- **Testable**: Includes test cases for each endpoint

## Inputs Required
```bash
PACKAGE_NAME=<name>           # e.g., "analytics-service"
API_SPEC=<file|json>          # API specification (OpenAPI, custom JSON, or auto-detect)
BASE_PATH=<path>              # Default: "/api/v1"
AUTH_REQUIRED=<bool>          # Default: true
GENERATE_DOCS=<bool>          # Default: true (Swagger UI)
```

## Execution Rules

### Rule 1: API Specification Analysis
```bash
# Parse API specification (JSON, YAML, or auto-detect from routes)
if [ -f "${API_SPEC}" ]; then
  ENDPOINTS=$(parse_api_spec "${API_SPEC}")
else
  # Auto-detect from existing routes
  ENDPOINTS=$(scan_existing_routes "packages/${PACKAGE_NAME}/src/routes")
fi

echo "📋 Detected ${ENDPOINTS_COUNT} endpoints"
```

### Rule 2: Directory Structure
```bash
# Create API structure (idempotent)
mkdir -p "packages/${PACKAGE_NAME}/src"/{routes,controllers,middleware,validators,types}

# API-specific subdirectories
mkdir -p "packages/${PACKAGE_NAME}/src/middleware"/{auth,validation,error}
```

### Rule 3: Type Definitions
```typescript
// src/types/api.ts - Auto-generated from spec
/**
 * API Type Definitions for ${PACKAGE_NAME}
 * Auto-generated - modify with care
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Extended Request with type-safe body, params, query
 */
export interface TypedRequest<
  TBody = any,
  TParams = any,
  TQuery = any
> extends Request {
  body: TBody;
  params: TParams;
  query: TQuery;
  user?: AuthUser;
}

/**
 * Authenticated user context
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

/**
 * Standard API Response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API Error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

/**
 * Response metadata (pagination, etc.)
 */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Controller method signature
 */
export type ControllerMethod = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// Auto-generated endpoint-specific types
${ENDPOINTS.map(ep => `
/**
 * ${ep.method} ${ep.path}
 * ${ep.description}
 */
export interface ${ep.requestTypeName} {
  ${ep.requestFields.map(f => `${f.name}${f.required ? '' : '?'}: ${f.type};`).join('\n  ')}
}

export interface ${ep.responseTypeName} {
  ${ep.responseFields.map(f => `${f.name}: ${f.type};`).join('\n  ')}
}
`).join('\n')}
```

### Rule 4: Validation Schemas (Joi)
```typescript
// src/validators/[resource].validator.ts
import Joi from 'joi';

/**
 * Validation schemas for ${RESOURCE} endpoints
 */
export const ${RESOURCE}Validators = {
  ${ENDPOINTS.map(ep => `
  /**
   * Validator for ${ep.method} ${ep.path}
   */
  ${ep.validatorName}: {
    body: Joi.object({
      ${ep.bodyFields.map(f => `
      ${f.name}: Joi.${f.joiType}()${f.required ? '.required()' : '.optional()'}${f.validation ? `.${f.validation}` : ''}
        .description('${f.description}'),
      `).join('')}
    }).unknown(false),

    params: Joi.object({
      ${ep.paramFields.map(f => `
      ${f.name}: Joi.${f.joiType}().required()
        .description('${f.description}'),
      `).join('')}
    }),

    query: Joi.object({
      ${ep.queryFields.map(f => `
      ${f.name}: Joi.${f.joiType}()${f.required ? '.required()' : '.optional()'}
        .description('${f.description}'),
      `).join('')}
    })
  },
  `).join('\n')}
};
```

### Rule 5: Validation Middleware
```typescript
// src/middleware/validation/validate.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '@/types/api';

/**
 * Generic validation middleware factory
 */
export const validate = (schemas: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, any> = {};

    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });
      if (error) {
        errors.body = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }));
      } else {
        req.body = value;
      }
    }

    // Validate params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false
      });
      if (error) {
        errors.params = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }));
      } else {
        req.params = value;
      }
    }

    // Validate query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });
      if (error) {
        errors.query = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }));
      } else {
        req.query = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      };
      res.status(400).json(response);
      return;
    }

    next();
  };
};
```

### Rule 6: Controller Templates
```typescript
// src/controllers/[Resource]Controller.ts
import { Request, Response, NextFunction } from 'express';
import { TypedRequest, ApiResponse } from '@/types/api';
// Import types for this controller
${ENDPOINTS.map(ep => `import { ${ep.requestTypeName}, ${ep.responseTypeName} } from '@/types/api';`).join('\n')}

/**
 * Controller for ${RESOURCE} operations
 */
export class ${RESOURCE}Controller {
  ${ENDPOINTS.map(ep => `
  /**
   * ${ep.description}
   * ${ep.method} ${ep.path}
   */
  static async ${ep.methodName}(
    req: TypedRequest<${ep.requestTypeName}, ${ep.paramsTypeName}, ${ep.queryTypeName}>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Implement business logic
      const data: ${ep.responseTypeName} = {
        // Implementation needed
      };

      const response: ApiResponse<${ep.responseTypeName}> = {
        success: true,
        data
      };

      res.status(${ep.successCode}).json(response);
    } catch (error) {
      next(error);
    }
  }
  `).join('\n')}
}
```

### Rule 7: Route Definitions
```typescript
// src/routes/[resource].routes.ts
import { Router } from 'express';
import { ${RESOURCE}Controller } from '@/controllers/${RESOURCE}Controller';
import { ${RESOURCE}Validators } from '@/validators/${RESOURCE}.validator';
import { validate } from '@/middleware/validation/validate';
import { authenticate } from '@/middleware/auth/authenticate';

const router = Router();

${ENDPOINTS.map(ep => `
/**
 * ${ep.description}
 * ${ep.method} ${ep.path}
 */
router.${ep.method.toLowerCase()}(
  '${ep.path}',
  ${ep.authRequired ? 'authenticate,' : '// No auth required'}
  validate(${RESOURCE}Validators.${ep.validatorName}),
  ${RESOURCE}Controller.${ep.methodName}
);
`).join('\n')}

export default router;
```

### Rule 8: Authentication Middleware (if AUTH_REQUIRED)
```typescript
// src/middleware/auth/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/api';

/**
 * Authentication middleware
 * Verifies API key or JWT token
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    };
    res.status(401).json(response);
    return;
  }

  try {
    // Extract token
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Validate token (implement your logic)
    const apiKey = process.env.API_KEY;
    if (token !== apiKey) {
      throw new Error('Invalid token');
    }

    // Attach user to request
    // req.user = decodedUser;

    next();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: 'Authentication failed'
      }
    };
    res.status(401).json(response);
  }
};
```

### Rule 9: Error Handling Middleware
```typescript
// src/middleware/error/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/api';

/**
 * Global error handler
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };

  res.status(500).json(response);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: \`Route \${req.method} \${req.path} not found\`
    }
  };

  res.status(404).json(response);
};
```

### Rule 10: Main Router Integration
```typescript
// src/index.ts - Update to include new routes
import express from 'express';
import ${RESOURCE}Routes from './routes/${RESOURCE}.routes';
import { errorHandler, notFoundHandler } from './middleware/error/errorHandler';

const app = express();

app.use(express.json());

// Mount routes
app.use('${BASE_PATH}/${RESOURCE_PATH}', ${RESOURCE}Routes);

// Error handlers (MUST be last)
app.use(notFoundHandler);
app.use(errorHandler);

// ... rest of server setup
```

### Rule 11: Swagger/OpenAPI Documentation (if GENERATE_DOCS)
```typescript
// src/docs/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '${PACKAGE_NAME} API',
      version: '1.0.0',
      description: 'Auto-generated API documentation'
    },
    servers: [
      {
        url: 'http://localhost:${PORT}${BASE_PATH}',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(\`📚 API Documentation available at /api-docs\`);
};
```

### Rule 12: API Tests Generation
```typescript
// tests/api/[resource].test.ts
import request from 'supertest';
import app from '@/index';

describe('${RESOURCE} API', () => {
  ${ENDPOINTS.map(ep => `
  describe('${ep.method} ${ep.path}', () => {
    it('should return ${ep.successCode} for valid request', async () => {
      const response = await request(app)
        .${ep.method.toLowerCase()}('${BASE_PATH}${ep.path}'.replace(/:(\w+)/g, 'test-$1'))
        ${ep.authRequired ? ".set('Authorization', 'Bearer ' + process.env.API_KEY)" : ''}
        .send(${JSON.stringify(ep.sampleBody, null, 2)});

      expect(response.status).toBe(${ep.successCode});
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should return 400 for invalid request', async () => {
      const response = await request(app)
        .${ep.method.toLowerCase()}('${BASE_PATH}${ep.path}'.replace(/:(\w+)/g, 'test-$1'))
        ${ep.authRequired ? ".set('Authorization', 'Bearer ' + process.env.API_KEY)" : ''}
        .send({}); // Invalid payload

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      });
    });

    ${ep.authRequired ? `
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .${ep.method.toLowerCase()}('${BASE_PATH}${ep.path}'.replace(/:(\w+)/g, 'test-$1'))
        .send(${JSON.stringify(ep.sampleBody, null, 2)});

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_REQUIRED'
        })
      });
    });
    ` : ''}
  });
  `).join('\n')}
});
```

## Verification Checklist

```bash
# 1. All files created
test -f "packages/${PACKAGE_NAME}/src/types/api.ts"
test -f "packages/${PACKAGE_NAME}/src/middleware/validation/validate.ts"
test -f "packages/${PACKAGE_NAME}/src/middleware/error/errorHandler.ts"

# 2. Routes registered
grep -q "${RESOURCE}Routes" "packages/${PACKAGE_NAME}/src/index.ts"

# 3. TypeScript compiles
npm run type-check -w "packages/${PACKAGE_NAME}"

# 4. API tests pass
npm test -w "packages/${PACKAGE_NAME}" -- tests/api

# 5. Swagger docs accessible (if enabled)
curl -f http://localhost:${PORT}/api-docs.json

# 6. All endpoints respond
for endpoint in ${ENDPOINTS}; do
  curl -f http://localhost:${PORT}${BASE_PATH}${endpoint} || true
done
```

## Success Criteria

✅ **MUST** achieve all:
1. Type definitions generated for all endpoints
2. Validation schemas created
3. Controllers scaffolded
4. Routes registered
5. Middleware implemented
6. Tests passing
7. Documentation generated (if enabled)
8. TypeScript compilation succeeds

## Output Report

```markdown
# API Builder Report

**Package**: ${PACKAGE_NAME}
**Status**: ✅ Success | ❌ Failed
**Timestamp**: ${ISO_TIMESTAMP}

## API Configuration
- Base Path: ${BASE_PATH}
- Authentication: ${AUTH_REQUIRED ? 'Required' : 'Optional'}
- Documentation: ${GENERATE_DOCS ? 'Enabled' : 'Disabled'}
- Endpoints Generated: XX

## Generated Files
- [x] src/types/api.ts
- [x] src/validators/${RESOURCE}.validator.ts
- [x] src/controllers/${RESOURCE}Controller.ts
- [x] src/routes/${RESOURCE}.routes.ts
- [x] src/middleware/validation/validate.ts
- [x] src/middleware/auth/authenticate.ts
- [x] src/middleware/error/errorHandler.ts
- [x] tests/api/${RESOURCE}.test.ts

## Endpoints Summary
${ENDPOINTS.map(ep => `- ${ep.method} ${BASE_PATH}${ep.path} - ${ep.description}`).join('\n')}

## Documentation
${GENERATE_DOCS ? `- Swagger UI: http://localhost:${PORT}/api-docs
- OpenAPI Spec: http://localhost:${PORT}/api-docs.json` : '- Not generated'}

## Next Steps
1. Implement business logic in controllers
2. Run `npm run dev:${PACKAGE_NAME}` to start server
3. Test endpoints: curl http://localhost:${PORT}${BASE_PATH}
4. View docs: http://localhost:${PORT}/api-docs
5. Continue with Documentation Agent

## Dependencies
- Requires: 01-package-initializer, 03-test-scaffold
- Triggers: 05-documentation-agent, 06-integration-validator
```

## Idempotency Guarantees

- ✅ Checks for existing routes before adding
- ✅ Merges validators instead of overwriting
- ✅ Preserves existing controller methods
- ✅ Appends to main router safely
- ✅ No duplicate test generation

## Dependencies

**Requires**:
- Package created by 01-package-initializer
- Test structure from 03-test-scaffold
- `joi` for validation
- `swagger-jsdoc` and `swagger-ui-express` (if docs enabled)

**Triggers Next**:
- 05-documentation-agent (API docs)
- 06-integration-validator (E2E testing)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Maintainer**: Monorepo Team
