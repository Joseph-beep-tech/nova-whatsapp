# WhatsApp Bot with n8n Integration

A production-ready WhatsApp bot built with TypeScript and whatsapp-web.js, featuring seamless n8n workflow integration, Docker deployment, and comprehensive API endpoints.

## Quick Start

### Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

3. **Start development servers**
   ```bash
   npm run dev:all
   ```

4. **Authenticate WhatsApp**
   - Visit http://localhost:3001/login
   - Use credentials from .env (QR_AUTH_USERNAME/QR_AUTH_PASSWORD)
   - Navigate to QR page and scan code with WhatsApp mobile app

5. **Develop n8n nodes (optional)**
   ```bash
   npm run dev:nodes
   ```

### Production Deployment

#### nginx-proxy Setup (Recommended)

This project is configured to work with [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) and [acme-companion](https://github.com/nginx-proxy/acme-companion) for automatic SSL certificates.

1. **Set up nginx-proxy (if not already running)**
   ```bash
   docker network create proxy
   docker run -d \
     --name nginx-proxy \
     --net proxy \
     -p 80:80 -p 443:443 \
     -v /var/run/docker.sock:/tmp/docker.sock:ro \
     nginxproxy/nginx-proxy
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Update the following nginx-proxy variables:
   # WHATSAPP_SERVICE_VIRTUAL_HOST=wa.your-domain.com
   # WHATSAPP_SERVICE_LETSENCRYPT_HOST=wa.your-domain.com
   # WHATSAPP_FRONTEND_VIRTUAL_HOST=frontend.your-domain.com
   # WHATSAPP_FRONTEND_LETSENCRYPT_HOST=frontend.your-domain.com
   # WHATSAPP_SERVICE_LETSENCRYPT_EMAIL=your-email@domain.com
   # WHATSAPP_FRONTEND_LETSENCRYPT_EMAIL=your-email@domain.com
   ```

3. **Deploy services**
   ```bash
   docker compose up -d
   ```

4. **Verify deployment**
   ```bash
   # Check health endpoints
   curl https://wa.your-domain.com/health
   curl https://frontend.your-domain.com/health
   
   # Authenticate via frontend
   # Visit https://frontend.your-domain.com/login
   ```

#### Alternative Deployment (without nginx-proxy)

1. Configure environment: `cp .env.example .env` (update with production values)  
2. Deploy with Docker: `docker compose up -d`
3. Configure your reverse proxy to route to exposed ports
4. Check health: `curl https://your-domain.com/health`
5. Authenticate: Visit your frontend URL

## API Endpoints

**WhatsApp n8n Service (port 3001):**
- GET /service/health - Service health status
- POST /service/webhook - n8n integration (API key required)
- POST /service/events/:sessionId - Main event receiver from wwebjs-api
- GET/POST /service/users/* - User management endpoints
- GET/POST/DELETE /service/tags/* - Tag routing configuration
- GET/POST/DELETE /service/welcome-messages/* - Welcome message configuration
- **GET /service/memory/stats/:chatId** - Memory statistics (API key required)
- **POST /service/memory/search** - Search memories with hybrid search (API key required)
- **GET /service/memory/export/:chatId** - Export user memories (API key required)
- **DELETE /service/memory/:messageId** - Delete specific memory (API key required)

**WhatsApp Dashboard (port 3002):**
- GET /login - Keycloak OIDC authentication
- GET /chats - Main HITL interface
- GET /sessions - WhatsApp session management
- **GET /memory** - RAG memory insights dashboard
- GET /api-docs/service - Interactive Swagger/OpenAPI documentation

## Features

- Multi-device WhatsApp support with session persistence
- All message types: text, media, documents, voice, location
- Group management and automated responses
- n8n workflow integration with bidirectional webhooks
- **RAG Memory System with Qdrant vector database**
  - Hybrid search (vector similarity + keyword matching)
  - Memory insights dashboard for debugging and monitoring
  - User data export (GDPR compliance)
  - Memory deletion for data management
- HITL Dashboard with React, Zustand, and Socket.io
- Keycloak OIDC authentication with multi-tenant support
- Interactive API documentation (Swagger/OpenAPI)
- Docker containerization with SSL/HTTPS support
- Security with rate limiting and authentication

## Configuration

Environment variables are configured in `.env` file (copy from `.env.example`):

**Required Variables:**
- `SESSION_SECRET` - Secure session secret
- `API_KEY` - API authentication key
- `QR_AUTH_USERNAME` / `QR_AUTH_PASSWORD` - Login UI credentials
- `FRONTEND_PORT` - Frontend server port (default: 3001)
- `WHATSAPP_SERVICE_URL` - WhatsApp n8n service URL for frontend

**URLs (update for your domain):**
- `WEBHOOK_URL` - Your bot's public URL
- `N8N_WEBHOOK_URL` - Your n8n instance URL

**Optional Features:**
- `ENABLE_GROUP_RESPONSES` - Enable bot responses in groups
- `ENABLE_WELCOME_MESSAGE` - Send welcome messages to new group members
- `MAX_GROUP_MEMBERS` - Maximum group size for bot responses
- `REDIS_URL` - Redis connection string

## Frontend Roadmap

### 🎯 Current State (v1.0)
- ✅ **Authentication System**: Modern login interface with session management
- ✅ **QR Code Display**: Real-time WhatsApp QR code viewing and refresh
- ✅ **Responsive Design**: Mobile-friendly Tailwind CSS interface
- ✅ **Security Features**: Rate limiting, CSRF protection, secure sessions

### ✅ Phase 1: Message Dashboard (v1.1 - Completed)
- ✅ **Message History Viewer**: Display recent WhatsApp conversations
- ✅ **Real-time Message Feed**: Live message stream with WebSocket integration
- ✅ **Search & Filter**: Find messages by contact, group, date, or content
- ✅ **RAG Memory Insights**: View retrieved context, storage stats, and relevance scores

### 🔧 Phase 2: Bot Management (v1.2)
- **Contact Management**: View and manage WhatsApp contacts and groups
- **Bot Configuration**: Adjust response settings, group permissions
- **System Health Monitoring**: Service status, memory usage, connection quality
- **Log Viewer**: Structured log display with filtering and search

### 🚀 Phase 3: Advanced Features (v1.3)
- **n8n Workflow Integration**: View and monitor workflow executions
- **Media Gallery**: Browse sent/received images, documents, voice messages
- **Export Tools**: Download conversation history, generate reports
- **User Management**: Multi-user access with role-based permissions

### 🌟 Phase 4: Enterprise Features (v2.0)
- **Analytics Dashboard**: Message trends, response times, user engagement
- **API Management**: Monitor webhook usage, rate limits, API health
- **Backup & Recovery**: Automated data backup, session restoration
- **Progressive Web App**: Offline capabilities, push notifications

### 🛠 Technical Enhancements
- **Performance Optimization**: Lazy loading, caching, database indexing
- **Dark Mode Support**: Theme switcher with user preferences
- **Accessibility**: WCAG 2.1 compliance, keyboard navigation
- **Testing Coverage**: Comprehensive E2E testing with Playwright

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history and change tracking
- **[docs/](docs/)** - Detailed architecture and integration guides
- **[docs/memory/01-memory-insights-guide.md](docs/memory/01-memory-insights-guide.md)** - RAG memory insights guide
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines for contributors

For support, check the [troubleshooting guide](docs/guides/TROUBLESHOOTING.md) or create an issue.
