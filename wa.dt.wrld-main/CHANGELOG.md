# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.8.0] - 2026-03-01

### Added
- LLM conversational system with OpenRouter + Grok integration (US-028 through US-035)
  - Intent detection for unregistered users (tag interest, greeting, question, unknown)
  - Dynamic help generation contextual to user's enrolled programs
  - Auto-registration via LLM intent when user expresses interest in a tag
  - Welcome message generation for unregistered users listing available programs
  - Contextual responses for unregistered user questions
  - Graceful degradation when LLM service is unavailable (static fallbacks)
- SPAO Control Plane integration
  - Event webhook receiver (`POST /service/webhooks/spao`) for voice lifecycle events
  - SPAO client for REST API and MCP tool calls
  - Voice handler for WhatsApp as voice remote control
  - Usage tracking API (`GET /service/usage`)
  - External content retrieval from SPAO RAG service
- ERPNext sync adapter foundation
  - TypeScript types and config for ERPNext integration
  - Sync service (upsertContact, queueCommunication, fetchCampaigns)
  - Webhook receiver with HMAC-SHA256 validation
- Docker dev stack improvements
  - whatsapp-api behind `profiles: ["api"]` (not started by default)
  - RAG/LLM env vars added to compose with `${VAR:-default}` pattern
  - Docker dev stack documentation with profiles, healthchecks, data seeding

### Changed
- Event routing extracts identifier from chatId before user lookup (was passing raw chatId)
- Docker compose uses overridable `WHATSAPP_API_URL` for local dev against remote server

### Fixed
- chatId→identifier mismatch in EventsController (tsoa controller)
- Jest config race condition with integration tests (removed `projects`, set `maxWorkers: 1`)
- Integration test assertions for alert services
- IPv4 healthchecks replacing localhost (IPv6 mismatch in Alpine containers)
- Compose dependency chains (profiled services removed from unconditional depends_on)

### Documentation
- Docker dev stack guide (`docs/deployment/docker-dev-stack.md`)
- Roadmap updated with US-047 (tag & welcome message dashboard management) for v1.0.0

## [v0.7.0] - 2026-02-25

### Added
- RAG Memory Insights Dashboard with comprehensive visualization and management tools
  - Memory statistics API endpoint (`GET /service/memory/stats/:chatId`)
  - Hybrid search endpoint (`POST /service/memory/search`) for vector + keyword search
  - Memory export endpoint (`GET /service/memory/export/:chatId`) for GDPR compliance
  - Memory deletion endpoint (`DELETE /service/memory/:messageId`)
  - Frontend Memory Insights page at `/memory` route with:
    - MemoryStatsCard displaying collection statistics (vector count, storage size)
    - RetrievedContextPanel for searching memories with pagination
    - MemoryExportButton for downloading user data as JSON
    - Relevance score breakdown (overall, vector, keyword scores)
  - Zustand memoryStore for memory state management
  - Comprehensive test coverage for all components and API endpoints
- Keyword handler wired into event routing pipeline (echo, ping, help, status commands)
- LLM conversational system requirements captured for v0.8.0 (task 057)
  - Gap analysis of existing handlers: qdrantHandler, keywordHandler, messageRouter, welcomeService, eventRouter
  - Identified 6 gaps: intent detection, LLM menus, dynamic help, unregistered user flow, per-user stats, Grok model config

### Changed
- **[BREAKING]** Migrated from `chatId` to `identifier` + `platform` across service and dashboard
  - Users keyed by `identifier` (phone/group ID) + `platform` (`c.us`|`g.us`|`lid`)
  - GET routes use query params (`?identifier=X&platform=Y`), POST/DELETE use body params
  - Dashboard uses composite key `identifier:platform` via `chatKey()`/`parseChatKey()`
  - MongoDB schemas updated with migration script (`scripts/migrate-chatid-to-identifier.ts`)
  - Qdrant boundary preserved: `QdrantPointPayload` keeps `chatId` internally, translated at service boundaries
- Task archives moved from `archive/` to `.archive/` for cleaner context window

### Fixed
- Healthcheck endpoint path corrected to `/service/health` (was `/health`)
- Event routing now includes keyword handler in processing pipeline

### Documentation
- `docs/memory/01-memory-insights-guide.md` - Complete guide to RAG memory insights feature
  - API endpoint documentation with examples
  - Dashboard usage instructions
  - Use cases: debugging, monitoring, GDPR compliance, QA
  - Configuration and troubleshooting
  - Security and privacy best practices
- Updated README.md with memory insights features and API endpoints
- Added memory insights to Frontend Roadmap (Phase 1 completed)
- Migration spec for identifier+platform model (`spec/13-n8n-to-service-migration.md`)

## [v0.6.0] - 2026-02-07

### Added
- Keycloak OIDC authentication with BFF server-side sessions (#10)
- HITL WhatsApp dashboard SPA with React 18, Zustand, Socket.io (#11)
- Interactive Swagger/OpenAPI documentation at `/api-docs/service` with tsoa (#9)
- Health monitoring endpoints at `/service/health` and `/service/health/ready`
- WhatsApp echo reply bot with n8n 2.x integration
- Comprehensive n8n 2.x integration documentation (`docs/n8n/01-n8n-integration-v2.md`)
- WhatsApp API setup guide (`docs/whatsapp/01-whatsapp-api-setup.md`)
- Debugging strategies guide (`docs/guides/02-debugging-strategies.md`)
- Task management system with type classification and changelog integration
- `docs/whatsapp/02-api-reference.md` documenting WhatsApp API endpoints
- New optional features available in whatsapp-api fork:
  - WebSocket support for real-time events
  - WhatsApp Channels API support
  - Message editing capability
  - Pairing code authentication
- Node.js 20+ support

### Changed
- Monorepo restructured: submodules moved to `vendor/`, deployment configs to `deploy/`
- **[DEPENDENCY MIGRATION]** Migrated `packages/whatsapp-api` submodule to `avoylenko/wwebjs-api` fork (v1.34.4) - 100% backward compatible
- Reorganized documentation with indexed file naming convention (`01-`, `02-`, etc.)
- Enhanced task tracking format with `type`, `priority`, `milestone`, and `changelog` fields
- Consolidated root-level docs into `docs/` folder structure

### Fixed
- Admin UI Tailwind CSS bundled locally for CSP compliance
- Duplicate message responses in n8n echo bot (filter `fromMe === false`)
- n8n 2.x data extraction using Code node (Set node depth limitation workaround)
- Docker network timeout by using internal container URLs

### Documentation
- Removed session-specific files from root (SESSION.md, N8N_CHANGES.md, WHATSAPP_API_SETUP.md)
- Added cross-references between related documentation files
- Updated CLAUDE.md and package documentation for migration

### Security
- Keycloak OIDC replaces Basic Auth for dashboard access
- Security updates included in whatsapp-web.js v1.26.0 → v1.34.4 upgrade
- Updated core dependencies: axios ^1.13.2, express ^4.22.1

## [1.4.0] - 2025-01-09

### Added
- Multi-session architecture (Phases A-C complete)
- MongoDB integration for webhook state management
- Comprehensive unit tests for multi-session functionality

### Changed
- Refactored webhook dispatcher with enhanced type safety
- Updated `handleGetGroupInfo` method implementation

### Removed
- Deprecated WhatsApp Container Manager files and configurations
- Legacy frontend and docker configurations

## [Previous Releases]

See git history for changes prior to 2025-01-09:
```bash
git log --oneline --before="2025-01-09"
```

---

## Migration Guide

### Upgrading to v1.34.4 WhatsApp API Fork

If you're pulling these changes:

1. **Update submodule**:
   ```bash
   git submodule sync
   git submodule update --init --recursive
   ```

2. **Verify compatibility** (optional):
   - Review `docs/whatsapp/02-api-reference.md`
   - All existing endpoints are preserved
   - No code changes required

3. **Optional: Enable new features**:
   - WebSocket: Set `ENABLE_WEBSOCKET=true` in whatsapp-api environment
   - See `packages/whatsapp-service/CLAUDE.md` for feature documentation

### Breaking Changes

None. The migration is fully backward compatible with all existing implementations.

---

## How to Maintain This Changelog

When making commits:

1. **Add entries to `[Unreleased]`** section for each meaningful change
2. **Categorize changes**:
   - `Added` - New features
   - `Changed` - Changes in existing functionality
   - `Deprecated` - Soon-to-be removed features
   - `Removed` - Removed features
   - `Fixed` - Bug fixes
   - `Security` - Security updates

3. **When releasing**:
   - Move `[Unreleased]` entries to new version section
   - Add release date
   - Create new empty `[Unreleased]` section

4. **Commit message format**:
   ```
   type(scope): description
   
   - Update CHANGELOG.md with changes
   ```

Example:
```markdown
## [Unreleased]

### Added
- New feature X in package Y

### Fixed  
- Bug in component Z

[Then commit with changelog update]
```

---

## Support

For questions about changes:
- Check `docs/whatsapp/` for API documentation
- See `docs/` for architecture documentation
- Review `CLAUDE.md` for development guidelines
