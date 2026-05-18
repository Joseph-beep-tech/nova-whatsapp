/**
 * Swagger UI Configuration
 *
 * Sets up Swagger UI for API documentation.
 * Serves both the whatsapp-service API docs and the wwebjs-api reference.
 */

import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load the tsoa-generated OpenAPI spec
 */
function loadServiceSpec(): Record<string, unknown> {
  const specPath = path.join(__dirname, 'generated', 'swagger.json');

  if (!fs.existsSync(specPath)) {
    console.warn('Warning: swagger.json not found. Run "npm run tsoa:spec" to generate it.');
    return {
      openapi: '3.0.0',
      info: {
        title: 'WhatsApp Service API',
        version: '0.5.0',
        description: 'API documentation not yet generated. Run "npm run tsoa:spec" first.',
      },
      paths: {},
    };
  }

  return JSON.parse(fs.readFileSync(specPath, 'utf-8')) as Record<string, unknown>;
}

/**
 * Configure and mount Swagger UI
 */
export function setupSwagger(app: Express): void {
  const serviceSpec = loadServiceSpec();

  // Customize Swagger UI options
  const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
    explorer: true,
    customSiteTitle: 'WhatsApp Service - API Docs',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { font-size: 2em; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
  };

  // Serve the OpenAPI spec as JSON
  app.get('/api-docs/service/swagger.json', (_req: Request, res: Response) => {
    res.json(serviceSpec);
  });

  // Serve Swagger UI for the service API
  app.use(
    '/api-docs/service',
    swaggerUi.serveFiles(serviceSpec, swaggerUiOptions),
    swaggerUi.setup(serviceSpec, swaggerUiOptions)
  );

  // API docs index page
  app.get('/api-docs', (_req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp Bot API Documentation</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            h1 { color: #333; }
            .api-card {
              background: white;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .api-card h2 {
              margin-top: 0;
              color: #25D366;
            }
            .api-card a {
              display: inline-block;
              background: #25D366;
              color: white;
              padding: 10px 20px;
              border-radius: 4px;
              text-decoration: none;
              margin-top: 10px;
            }
            .api-card a:hover {
              background: #128C7E;
            }
            code {
              background: #e9e9e9;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 0.9em;
            }
          </style>
        </head>
        <body>
          <h1>WhatsApp Bot API Documentation</h1>

          <div class="api-card">
            <h2>WhatsApp Service API</h2>
            <p>Event processing, tag-based routing, user management, and webhook integration.</p>
            <p>Base URL: <code>/service</code></p>
            <a href="/api-docs/service">View Documentation</a>
          </div>

          <div class="api-card">
            <h2>wwebjs-api Reference</h2>
            <p>Low-level WhatsApp operations: sending messages, session management, contacts, groups.</p>
            <p>Base URL: <code>http://whatsapp-api:3000</code> (internal) or <code>/</code> (via proxy)</p>
            <p style="color: #666; font-size: 0.9em;">
              See <a href="https://github.com/kulemantu/wwebjs-api" target="_blank">wwebjs-api documentation</a>
              for full endpoint reference.
            </p>
          </div>

          <div class="api-card" style="background: #fff3cd;">
            <h2>Authentication</h2>
            <p>All endpoints (except health checks) require API key authentication.</p>
            <p>Include header: <code>x-api-key: YOUR_API_KEY</code></p>
          </div>
        </body>
      </html>
    `);
  });

  console.log('Swagger UI configured:');
  console.log('  - API Index: /api-docs');
  console.log('  - Service API: /api-docs/service');
  console.log('  - OpenAPI Spec: /api-docs/service/swagger.json');
}
