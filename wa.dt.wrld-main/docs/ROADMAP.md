# Product Roadmap

Last updated: 2026-03-01 | Current version: **v0.8.0** | Next: **v0.9.0**

---

## Milestone Summary

| Version | Theme | Status |
|---------|-------|--------|
| v0.1.0 | n8n Integration & Foundation | Done |
| v0.1.1 | wwebjs-api Stability | Done |
| v0.2.0 | Multi-Session Architecture | Done |
| v0.2.1 | Router Stability | Done |
| v0.3.0 | Qdrant RAG & Media Proxy | Done |
| v0.4.x | Bug Fixes & Deployment | Done |
| v0.5.0 | Dashboard, Auth, Monorepo | Done |
| v0.6.0 | Identifier Migration, Memory Insights | Done |
| v0.7.0 | Keyword Handler, LLM Gap Analysis | Done |
| v0.8.0 | LLM Conversational System | Done |
| v0.9.0 | ERPNext Sync Adapter + API Verification | Planned |
| v1.0.0 | Conversation State & HITL | Planned |
| v1.1.0 | Realtime, Observability, Polish | Planned |

---

## Completed Milestones

### v0.1.0 - n8n Integration & Foundation

- [x] **US-001**: As a developer, I can send a WhatsApp message and receive an echo reply within 5 seconds
  - *Verify*: Send any message to bot number → receive echo back
- [x] **US-002**: As a developer, I can deploy n8n nodes that call wwebjs-api directly with x-api-key auth
  - *Verify*: `npm run deploy:nodes` installs nodes into n8n
- [x] **US-003**: As a developer, I can filter n8n triggers by toNumber/fromNumber
  - *Verify*: Configure trigger node with phone filter → only matching messages fire
- [x] **US-004**: As a developer, I have indexed documentation with cross-references
  - *Verify*: All docs follow `01-`, `02-` naming convention
- [x] **US-005**: As a developer, I can track tasks with types, priorities, and changelog integration
  - *Verify*: `tasks.json` has `type`, `priority`, `changelog` fields

*12 tasks completed. Archive: `.archive/v0.1.0/tasks.json`*

### v0.1.1 - wwebjs-api Stability

- [x] **US-006**: As a bot user, I can send messages without getting `markedUnread` errors
  - *Verify*: `sendSeen: false` patch applied → no console errors on sendMessage

*1 task completed. Archive: `.archive/v0.1.1/tasks.json`*

### v0.2.0 - Multi-Session Architecture

- [x] **US-007**: As an operator, I can manage multiple WhatsApp sessions from one service instance
  - *Verify*: `GET /session/status/:sessionId` returns per-session status
- [x] **US-008**: As a developer, I have typed multi-session management (types, core classes, API layer, handler integration)
  - *Verify*: `npm run type-check` passes with `SessionConfig`, `SessionMetadata` types

*4 tasks completed (full A1-A3 phase). Archive: `.archive/v0.2.0/tasks.json`*

### v0.2.1 - Router Stability

- [x] **US-009**: As a bot user, I do not receive duplicate replies from the bot
  - *Verify*: Send message → receive exactly 1 reply (dedup + fromMe filter)

*1 task completed. Archive: `.archive/v0.2.1/tasks.json`*

### v0.3.0 - Qdrant RAG & Media Proxy

- [x] **US-010**: As a developer, I have documented Qdrant vector database setup and integration
  - *Verify*: `docs/architecture/` contains Qdrant setup guide
- [x] **US-011**: As a developer, I can proxy external media through the service to bypass base64 bugs
  - *Verify*: `POST /service/media/proxy` caches and serves media → `GET /service/media/cache/:id`

*2 parent tasks (4 subtasks for media proxy). Archive: `.archive/v0.3.0/tasks.json`*

### v0.4.x - Bug Fixes & Deployment

- [x] **US-012**: As an operator, the router workflow does not time out on non-existent targets
  - *Verify*: Router handles missing Bot Trigger without timeout

*1 task completed. Archive: `.archive/v0.4.2/tasks.json`*

### v0.5.0 - Dashboard, Auth, Monorepo

- [x] **US-013**: As an operator, I can view WhatsApp sessions, logs, and events in a dashboard
  - *Verify*: Navigate to `/dashboard` → see Sessions, Logs+Events tabs with data
- [x] **US-014**: As an agent, I can view and respond to conversations in a 3-column HITL UI
  - *Verify*: Navigate to Conversations tab → chat list, message thread, contact panel
- [x] **US-015**: As an admin, I can manage API keys and view audit logs
  - *Verify*: Navigate to Admin tab → key management and audit viewer
- [x] **US-016**: As an admin, I log in via Keycloak OIDC with server-side sessions (no tokens in browser)
  - *Verify*: `GET /service/auth/login` → Keycloak redirect → session cookie → `GET /service/auth/me`
- [x] **US-017**: As a developer, I can view interactive API documentation
  - *Verify*: Navigate to `/api-docs/service` → Swagger UI with all endpoints
- [x] **US-018**: As a developer, the monorepo separates vendor submodules from custom packages
  - *Verify*: `vendor/whatsapp-api/` (submodule), `packages/` (custom code), `deploy/` (configs)
- [x] **US-019**: As a developer, I have health monitoring endpoints
  - *Verify*: `curl /service/health` → JSON with service status, `curl /service/health/ready` → readiness

*8 tasks completed (3 cancelled: group resource, comprehensive testing, orchestration dashboard). Archive: `.archive/v0.5.0/tasks.json`*

### v0.6.0 - Identifier Migration, Memory Insights

- [x] **US-020**: As a developer, users are keyed by `identifier` + `platform` instead of `chatId`
  - *Verify*: `GET /service/users?identifier=254...&platform=c.us` → user data
  - *Verify*: `scripts/migrate-chatid-to-identifier.ts` migrates existing MongoDB data
- [x] **US-021**: As a developer, I can search RAG memories with hybrid vector+keyword search
  - *Verify*: `POST /service/memory/search` → results with relevance scores
- [x] **US-022**: As an operator, I can view memory statistics, search memories, and export user data
  - *Verify*: Dashboard `/memory` route → stats card, search panel, export button
- [x] **US-023**: As a developer, I can delete individual memories for GDPR compliance
  - *Verify*: `DELETE /service/memory/:messageId` → memory removed from Qdrant

*Archived 19 completed tasks to `.archive/v0.6.0/tasks.json`*

### v0.7.0 - Keyword Handler, LLM Gap Analysis (current release)

- [x] **US-024**: As a bot user, I can type `help`, `ping`, `echo`, `status` and get responses
  - *Verify*: Send "help" → command list. Send "ping" → "pong". Send "status" (admin only) → service info
- [x] **US-025**: As a developer, I have a gap analysis of what's needed for the LLM conversational system
  - *Verify*: Task 057.1 output documents 6 gaps with code locations
- [x] **US-026**: As a developer, event routing includes keyword handler in the processing pipeline
  - *Verify*: `npm test` → keywordHandler tests pass within eventRouter flow
- [x] **US-027**: As a developer, task archives use `.archive/` prefix for cleaner context windows
  - *Verify*: `ls .archive/` → v0.1.0 through v0.6.0 directories

---

### v0.8.0 - LLM Conversational System

- [x] **US-028**: As a developer, I can configure OpenRouter with Grok model via environment variables
  - *Verify*: Set `ENABLE_LLM=true`, `LLM_MODEL=x-ai/grok-2`, `OPENROUTER_API_KEY=sk-or-...` → service logs "LLM service initialized"
  - *Test*: `npm test llmService.test.ts` → "should be enabled after initialization" passes
  - *Files*: `src/shared/config.ts` (llmConfig), `src/services/llmService.ts` (initialize)

- [x] **US-029**: As an unregistered user, the bot detects my intent from free-text messages
  - *Verify*: Send "Tell me about SOMO" → intent classified as `tag_interest` with tag `SOMO`
  - *Verify*: Send "Hello" → intent classified as `greeting`
  - *Test*: `npm test llmService.test.ts` → 7 intent detection tests pass (all types, malformed JSON, code fences, API errors)
  - *Files*: `src/services/llmService.ts` (detectIntent), `src/types/llm.ts` (IntentDetectionResult)

- [x] **US-030**: As an unregistered user expressing interest in a tag, I am auto-registered and get a welcome message
  - *Verify*: Unregistered user sends "I want to join SOMO" → LLM detects `tag_interest` → auto-register with SOMO tag → receive tag-specific welcome
  - *Test*: Unit tests for `handleUnregisteredUser()` in eventRouter
  - *Files*: `src/services/eventRouter.ts` (handleUnregisteredUser)

- [x] **US-031**: As an unregistered user, I receive a friendly welcome listing available programs
  - *Verify*: Send "Hi" (no tag match) → receive "Welcome to Azizi Africa! Available programs: SOMO, ..."
  - *Test*: `npm test llmService.test.ts` → "should generate welcome via LLM" and "should fall back to static welcome on API error" pass
  - *Files*: `src/services/llmService.ts` (generateWelcome, fallbackWelcome)

- [x] **US-032**: As an unregistered user asking a question, I get a contextual response mentioning available programs
  - *Verify*: Send "What learning programs do you have?" → contextual answer referencing available tags
  - *Test*: `npm test llmService.test.ts` → "should generate contextual response" passes
  - *Files*: `src/services/llmService.ts` (generateUnregisteredResponse)

- [x] **US-033**: As a registered user, I can type "help" and get LLM-generated context-aware help
  - *Verify*: Registered SOMO user sends "help" → dynamic help mentioning SOMO features + available commands
  - *Test*: `npm test llmService.test.ts` → "should generate dynamic help via LLM" and "should fall back to static help on API error" pass
  - *Files*: `src/handlers/keywordHandler.ts` (generateHelpText), `src/services/llmService.ts` (generateHelp)

- [x] **US-034**: As a developer, every LLM feature degrades gracefully when the service is unavailable
  - *Verify*: Set `ENABLE_LLM=false` → help returns static keyword list, unregistered users fall through to legacy flow
  - *Test*: `npm test llmService.test.ts` → 3 "when disabled" tests pass (unknown intent, fallback welcome, fallback help)
  - *Files*: All LLM methods have static fallbacks

- [x] **US-035**: As a developer, existing tag keyword detection (SOMO regex) still works for unregistered users
  - *Verify*: Unregistered user sends "SOMO" → regex detects tag → auto-register (LLM not called)
  - *Test*: Existing messageRouter tests pass unchanged
  - *Files*: `src/handlers/messageRouter.ts` (tag detection runs BEFORE LLM)

*E2E verified 2026-03-01: tag detection → welcome → RAG routing → LLM response → delivery via wa-im.aziziafrica.com*

---

## v0.9.0 - ERPNext Sync Adapter + API Verification (Planned)

**Architectural pivot**: ERPNext replaces planned Postgres tenancy (task 035) as the shared schema layer. See [spec/16-erpnext-integration.md](../spec/16-erpnext-integration.md) and [docs/erpnext/ERP_SETUP_WA.md](erpnext/ERP_SETUP_WA.md).

### ERPNext Sync Adapter

- [ ] **US-036**: As a developer, wa.dt.wrld syncs user registrations to ERPNext Contact on tag assignment
  - *Verify*: User sends "SOMO" → registered in MongoDB → Contact created in ERPNext with `custom_wa_platform`, `custom_wa_tags`
  - *Test*: Mock ERPNext API → `erpnextSync.syncUserRegistration()` called with correct payload
  - *Files*: `src/services/erpnextSync.ts`, `src/types/erpnext.ts`

- [ ] **US-037**: As a developer, wa.dt.wrld receives ERPNext webhooks when Contacts or Campaigns change
  - *Verify*: Add Contact in ERPNext desk → webhook fires → wa.dt.wrld updates MongoDB cache within 5s
  - *Test*: `POST /service/webhooks/erpnext/contact` with mock payload → user cache updated
  - *Files*: `src/routes/erpnextWebhooks.ts`

- [ ] **US-038**: As a developer, wa.dt.wrld loads Campaign configs from ERPNext on startup
  - *Verify*: ERPNext has Campaign "SOMO" with `custom_wa_tag`, `custom_wa_routing_targets` → wa.dt.wrld reads on boot → tagConfig populated
  - *Test*: Mock ERPNext Campaign API response → tagConfigs populated correctly
  - *Files*: `src/services/erpnextSync.ts` (initialize)

- [ ] **US-039**: As a developer, message logs are batched and synced to ERPNext Communication asynchronously
  - *Verify*: 10 messages processed → 10 Communication docs appear in ERPNext within 30s (batched, not per-message)
  - *Test*: Queue 5 messages → batch flush → single API call with correct payloads

- [ ] **US-040**: As a developer, wa.dt.wrld continues operating when ERPNext is unreachable
  - *Verify*: Stop ERPNext → send WhatsApp messages → bot responds normally from cache. Restart ERPNext → queued syncs complete
  - *Test*: Mock ERPNext returning 503 → operations continue → retry succeeds

### API Verification (carried forward)

- [ ] **US-041**: As a developer, I can send media (images, video, documents) via the bot
  - *Verify*: `POST /client/sendMessage/:sessionId` with `contentType: MessageMedia` → media delivered
  - *Task*: 013-20260112-verify-send-media-api

- [ ] **US-042**: As a developer, all webhook callback types fire correctly
  - *Verify*: Each event type (`message_create`, `message_ack`, `group_join`, etc.) triggers webhook
  - *Task*: 017-20260112-verify-webhook-callbacks

---

## v1.0.0 - Conversation State & HITL (Planned)

Depends on: v0.9.0 (ERPNext sync). Tenant isolation provided by ERPNext Company-level permissions.

- [ ] **US-043**: As an agent, I can view conversation state (open/waiting/resolved) and take over a conversation
  - *Verify*: `POST /service/handoff/start` → agent assigned. `POST /service/handoff/complete` → returned to bot
  - *ERPNext*: Handoff creates ERPNext Issue linked to Contact and Campaign
  - *Task*: 036-20260121-conversation-state-and-handoff

- [ ] **US-044**: As an agent, I can chat with WhatsApp users through the HITL dashboard in real time
  - *Verify*: Agent sends message in dashboard → user receives on WhatsApp → user replies → appears in dashboard
  - *Task*: 046-20260122-hitl-conversations-and-agent-takeover

- [ ] **US-045**: As a developer, I can serve the dashboard SPA from the service under `/dashboard`
  - *Verify*: `curl /dashboard` → HTML page. `curl /dashboard/assets/index.js` → bundled JS
  - *Task*: 050-20260122-serve-dashboard-and-minimal-nav

- [ ] **US-046**: As a developer, incoming events are normalized and deduplicated at the service layer
  - *Verify*: Duplicate `message_create` events → only 1 processed. Payloads follow canonical schema
  - *Task*: 037-20260121-normalization-dedupe-correlation

- [ ] **US-047**: As an admin, I can manage tag configurations and welcome messages from the dashboard
  - *Verify*: Navigate to Admin → Tags → SOMO → edit welcome messages, routing targets, regex pattern
  - *Includes*: Tag config CRUD, welcome message editor (multi-message sequences, content types: text/media/location), preview/test flow
  - *API*: Existing `GET/POST/DELETE /service/tags/:tag/config` and `/service/welcome-messages/:tag`

---

## v1.1.0 - Realtime, Observability, Polish (Planned)

RBAC, audit, alerts, retention now handled by ERPNext natively. Remaining wa.dt.wrld work is realtime and operational polish.

- [ ] **US-048**: As an operator, I can stream real-time events via WebSocket with tenant/session filtering
  - *Verify*: Connect to `/ws/events` → receive live message_create events filtered by ERPNext Company
  - *Task*: 045-20260122-realtime-stream-and-observability-api

- [ ] **US-049**: As an operator, I can manage WhatsApp sessions from the dashboard
  - *Verify*: Dashboard session controls → start session → scan QR → see "connected" status
  - *Task*: 047-20260122-session-orchestration-dashboard-apis

- [ ] **US-050**: As a developer, SSRF is prevented for webhook targets and PII is redacted in API responses
  - *Verify*: Configure webhook to `http://169.254.169.254` → blocked. Phone numbers masked in GET responses
  - *Task*: 049-20260122-security-guardrails-redaction-ssrf

---

## Tasks Replaced by ERPNext

| Old Task | Was | Now |
|---|---|---|
| 035 - Postgres tenancy foundation | Build full Postgres migration + tenant schemas | **Replaced** by ERPNext Company isolation + sync adapter |
| 038 - RBAC + audit | Build audit log + role system | **Replaced** by ERPNext Activity Log + Role Permissions |
| 039 - Alerts + notifications | Build alert system | **Replaced** by ERPNext Notification DocType |
| 040 - Retention + indexing | Build retention policies | **Replaced** by ERPNext per-DocType retention settings |
| 044 - API keys + PATs | Build key management | **Replaced** by Frappe API key system |
| 056 - Multi-tenant CRM frontend | Build from scratch | **Replaced** by ERPNext desk (admin) + portal frontend (org users) |

---

## Dependency Graph

```
v0.8.0 (LLM)              ✅ Done (2026-03-01)
  │
v0.9.0 (ERPNext sync      ← ERPNext instance setup (Phase E0-E2)
  + API verify)               see docs/erpnext/ERP_SETUP_WA.md
  │
v1.0.0 (HITL + state)     ← 036 (state/handoff), 046 (HITL), 050 (dashboard), US-047 (tag mgmt)
  │
v1.1.0 (Realtime + polish) ← 045 (WebSocket), 047 (sessions), 049 (SSRF)
```

**Critical path simplified**: ERPNext setup (external, parallel) replaces Postgres tenancy build.
wa.dt.wrld focus shifts to: sync adapter → HITL → realtime.

### Cross-Platform Dependency

```
ai-ops-platform                  ERPNext                    wa.dt.wrld
───────────────                  ───────                    ──────────

Phase 0: Security ──────► Phase E0: Instance + Companies ◄── v0.8.0 (parallel)
Phase 1: Initiatives ───► Phase E1: Custom DocTypes      ◄── v0.9.0: Sync adapter
Phase 2-3: Signals/MCP ─► Phase E2: Webhooks             ◄── v1.0.0: HITL
Phase 4-5: Feedback/Ops ► Phase E3-E4: Seed + n8n        ◄── v1.1.0: Realtime
```

See [docs/erpnext/ERP_SETUP_WA.md](erpnext/ERP_SETUP_WA.md) for ERPNext phase details.

---

## Cancelled Tasks

| Task | Reason |
|------|--------|
| 020 - Group resource n8n node | Superseded by direct API approach |
| 033 - Comprehensive testing suite | Replaced by per-feature testing |
| 034 - Orchestration dashboard (original) | Replaced by 042 (modern SPA) + 047 (session APIs) |
| 035 - Postgres tenancy foundation | **Replaced by ERPNext shared schema** (spec/16) |
| 038 - RBAC + audit | **Replaced by ERPNext native features** |
| 039 - Alerts + notifications | **Replaced by ERPNext Notification DocType** |
| 040 - Retention + indexing | **Replaced by ERPNext retention settings** |
| 044 - API keys + PATs | **Replaced by Frappe API key system** |

---

## Statistics

| Metric | Count |
|--------|-------|
| Completed user stories | US-001 through US-035 (35) + SPAO integration |
| Planned user stories | US-036 through US-050 (15) |
| Completed tasks (archived) | ~60 parent tasks across v0.1.0-v0.6.0 |
| Active task | None (v0.8.0 complete, v0.9.0 planned) |
| Planned tasks (v0.9.0+) | ~10 (down from ~16, ERPNext replaces 6) |
| Cancelled/replaced tasks | 8 |
