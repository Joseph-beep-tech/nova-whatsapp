# PRD: WhatsApp Orchestration Dashboard & Human-in-the-Loop Interface

## Executive Summary

**Problem:** The current `whatsapp-service` is a "black box" for business users and support agents. There is no visibility into real-time message flows, session health, or n8n workflow executions without accessing server logs or the n8n execution history.

**Solution:** Transform the service into a **Centralized Management Dashboard**. This dashboard will provide real-time observability, session orchestration, and a Human-in-the-Loop (HITL) interface for monitoring and intervening in WhatsApp conversations.

---

## Background

As the integration stack grows to support multiple WhatsApp accounts and complex n8n workflows, business users need a dedicated interface that bridges the gap between the technical infrastructure (Docker/API) and the business operations (Customer Support/Automation).

### Target Personas
1. **System Admin:** Manages Docker containers, session connectivity, and API keys.
2. **Support Agent:** Monitors bot conversations, intervenes when the bot fails, and views message history.
3. **Automation Engineer:** Tracks n8n workflow triggers and execution status for WhatsApp events.
4. **Creator Admin (Platform Owner):** Owns the overall platform (tenants, keys, limits, SLAs), needs global visibility, auditability, and safe operations tooling.

### User Jobs (Concise)
- **Automation Engineer (builder):** Create WhatsApp-triggered workflows, verify routing/filters, debug failures quickly, and roll out changes safely across multiple sessions.
- **Support Agent (operator):** Follow live conversations, understand what automation is doing, take over when needed, and resolve customer issues without needing n8n access.
- **System Admin (infra):** Keep sessions online, diagnose disconnects, rotate keys, manage networks, and monitor health across all components.
- **Creator Admin (platform):** Provision tenants/sessions, enforce policies (rate limits, approvals), observe cross-tenant health/costs, and audit human actions.

---

## Goals & Non-Goals

### Goals
- **Real-time Observability:** Live log streaming and message event monitoring via WebSockets.
- **Session Orchestration:** Single UI to view QR codes, connection status, and device telemetry.
- **HITL Interface:** Conversation viewer allowing humans to see "what the bot is doing" and take control.
- **Workflow Visibility:** Linking WhatsApp messages to their respective n8n execution IDs.
- **Multi-tenant Support:** Scoped views for different sessions and tenants.
- **Safe Operations:** Actions are gated, audited, and reversible where possible (e.g. session logout, webhook routing changes).

### Non-Goals
- **Building a full CRM:** We are not replacing Salesforce or Zendesk; we are providing a low-level "Bot Control Room."
- **N8N Workflow Editor:** Workflows are still edited in n8n; we only provide visibility into their triggers/results.
- **Mobile App:** The interface will be web-based (mobile-responsive).

---

## Feature Specifications

### 1. Unified Health & Session Dashboard
- **Real-time Status:** Circular indicators for `whatsapp-api` and `n8n` connectivity.
- **QR Code Gallery:** For unauthenticated sessions, show the QR code with auto-refresh.
- **Device Telemetry:** Display battery percentage, signal strength, and hardware info (if available from wwebjs).
- **Session Actions:** Buttons to `Restart`, `Logout`, or `Delete` sessions directly from the UI.
- **Session Timeline:** Recent lifecycle events per session (created → QR shown → authenticated → ready → disconnected → recovered).
- **Policy Visibility:** Show per-session limits (rate limits, group message policy, allowlist/denylist).

### 2. Real-time System Logs & Event Stream
- **WebSocket Streaming:** "Matrix-style" scrolling logs showing every incoming webhook and outgoing API call.
- **Event Filtering:** Filter by Level (Info/Error), Session ID, or Event Type (`message`, `ack`, `ready`).
- **CLI Command Output:** Real-time visibility into background tasks like deployment scripts or health checks.
- **Structured Events:** Toggle between raw logs and structured event cards (inbound webhook, routed targets, n8n execution link, outbound send result).
- **Redaction:** Mask secrets (API keys, auth headers), optionally mask message bodies for sensitive tenants.

### 3. Human-in-the-Loop (HITL) Conversation Viewer
- **Live Chat View:** A list of recent chats with the last message preview.
- **Bot/Human Distinction:** Visual markers showing which messages were sent by the bot (n8n) and which by a human.
- **Execution Linking:** Click a bot message to jump to the specific n8n execution that sent it.
- **Agent Takeover:** A simple text box to send a manual message, bypassing the n8n logic if the bot is stuck.
- **Conversation Controls:** Assign conversation to an agent, add internal notes, and set status (open/pending/closed).
- **Guardrails:** Optional “approval required” mode where n8n proposes a message and a human must approve/edit before sending.

### 4. n8n Integration Visibility
- **Trigger Logs:** See exactly which n8n webhook URL was triggered for a specific incoming message.
- **Error Tracking:** If n8n returns a 500 or timeout, highlight it in red in the dashboard with the error payload.
- **Registration Manager:** UI to see all "Dynamic Registrations" from n8n workflows (referencing Phase 2 of Webhook Routing).
- **Execution Lookup:** For a message/event, show associated execution status (running/success/error), timestamps, and (optionally) a link to n8n UI execution.

### 5. Audit, Access, and Multi-Tenant Administration
- **RBAC:** Roles such as `creator_admin`, `tenant_admin`, `agent`, `automation_engineer`, `read_only`.
- **Audit Log:** Immutable record of operator actions (manual sends, takeovers, session deletes, routing edits, key rotations).
- **Tenant Controls:** Per-tenant session quotas, rate limits, message redaction policies, and allowed target endpoints for webhooks.
 - **Authentication (Keycloak):** Dashboard operators authenticate via Keycloak (OIDC/SSO). Authorization is enforced via Keycloak roles/claims + tenant scoping rules in the service.
 - **Operator Action Keys (PATs):** Support revocable Personal Access Tokens (PATs) for “service actions as user” from scripts/CLI (inherits user RBAC; audited), in addition to browser sessions.
 - **Integration API Keys (n8n):** Keep API keys for machine-to-machine integrations (n8n → service; service → whatsapp-api). These keys are tenant-scoped and independently rotatable from user PATs.

### 6. Payload Compatibility & Normalization (WhatsApp → n8n → UI)
- **Event type normalization:** Support and normalize variations observed in the stack (e.g. `dataType: "message"` vs `message_create`) so routing and filters are stable.
- **Shape normalization:** Produce a consistent internal event format for UI and routing regardless of upstream payload nesting differences (e.g. n8n 2.x `$json.body` vs `$json` patterns).
- **Idempotency keys:** Derive a stable `eventId` from WhatsApp message IDs when available to prevent double-processing across retries/fanout.
- **Redaction policy application:** Apply tenant-level redaction rules at ingest time (store raw only when permitted; otherwise store masked payload + a hash).

### 7. Alerts, Incidents, and Operator Notifications
- **Session disconnect alerts:** Notify System Admin / Creator Admin when sessions disconnect, QR required, or recovery loops are detected.
- **Routing failure alerts:** Notify on sustained n8n webhook failures (timeouts/5xx) or external handoff failures.
- **Delivery anomaly detection:** Highlight spikes in duplicate events, high latency, or high error rate per session/tenant.
- **Notification channels:** Email/Slack/webhook targets per tenant (configurable).

---

## Architecture & Technology Stack

### Container Topology & Data Flow (Single Docker Network)

Assumption: `whatsapp-api` (wwebjs-api fork), `whatsapp-service`, and `n8n` are attached to the same Docker network and can resolve each other by container name.

**Inbound (WhatsApp → n8n):**
1. **WhatsApp event** arrives at `whatsapp-api`.
2. `whatsapp-api` POSTs the event to the service:
   - `BASE_WEBHOOK_URL=http://whatsapp-service:<port>/webhook/inbound` (or existing `/events/:sessionId?` endpoint if used as inbound).
3. `whatsapp-service` validates auth, normalizes payload, assigns a correlation ID, then routes/fans out to one or more **n8n webhook URLs**.

**Outbound (n8n → WhatsApp):**
1. n8n workflow calls `whatsapp-service` action endpoints (or directly calls `whatsapp-api`, but preferred via service for consistency/observability).
2. `whatsapp-service` forwards to `whatsapp-api` endpoints with correct auth headers (`x-api-key`) and session targeting.
3. Result is returned to n8n and also streamed to the dashboard as an event (success/failure).

**Read/Refresh (Service → n8n / whatsapp-api):**
- Service polls or subscribes to session state (e.g. `/session/getSessions`, `/session/status/:id`, `/client/getInfo/:id`) for dashboard cards.
- Service optionally queries n8n for execution details to enrich “execution linking”.

### Requirements for Container-to-Container Interaction
- **Docker DNS:** Use container hostnames (e.g. `http://n8n:5678`, `http://wwebjs-api:3000`, `http://whatsapp-service:3001`).
- **Consistent Auth:** All service endpoints should be protected (API key and/or basic auth session). When the service calls `whatsapp-api`, it must set `x-api-key`.
- **Timeouts & Retries:** Forwarding to n8n webhooks must have configurable timeouts; errors must degrade gracefully (no global 500 if one target fails).
- **Correlation/Tracing:** The service should generate and propagate:
  - `x-correlation-id` on all forwarded HTTP calls
  - stable `eventId` per inbound WhatsApp event (derived from message id when available)
- **Network Safety:** Restrict which webhook target URLs are allowed (SSRF protection), especially in multi-tenant mode.

### Operational Requirements (n8n + whatsapp-api + service)
- **Webhook registration lifecycle (n8n):** webhook URLs must be *actually registered* by activating workflows (UI toggle or `publish:workflow`). Imported workflows that are not properly activated may not register webhooks.
- **Single inbound source of truth:** `whatsapp-api` must send events to exactly one inbound URL (service inbound), and the service handles fanout.
- **Environment/config:** minimally define:
  - `BASE_WEBHOOK_URL` on `whatsapp-api` pointing to the service inbound route
  - `API_KEY` / auth for service endpoints
  - `WHATSAPP_API_URL` (service → whatsapp-api base URL)
  - `N8N_URL` (service → n8n base URL) and optional n8n API auth if doing execution lookups
  - forward timeouts and retry limits for both directions
- **Same-network expectations:** if all three containers share a Docker network, prefer internal HTTP (`http://n8n:5678/...`) instead of public domains to avoid outbound connectivity issues.

### Frontend
- **Dashboard Package:** A dedicated dashboard frontend package (React 18 + TypeScript + Tailwind) built once and served by the service under `/dashboard` to avoid a second deployable.
  - Rationale: Keycloak auth + real-time split-pane UI is easier to maintain as a modern SPA than as static HTML.
  - Constraint: Keep navigation minimal and rely on tabbed/split layouts instead of many pages.
- **State Management:** Simple store (no heavy framework requirement) for session status, selection state, and stream filters.
- **Communication:** WebSockets (`socket.io-client` or equivalent) for live logs/events/messages; REST for historical queries and mutations (send/takeover/admin).

### Backend (`whatsapp-service`)
- **Real-time Engine:** `Socket.io` integrated into the Express server.
- **Event Bus:** Node.js `EventEmitter` to capture logs and webhook events internally and broadcast them to the dashboard.
- **Log Aggregator:** A simple in-memory circular buffer (e.g., last 1000 lines) for new dashboard connections.
- **Persistence (Recommended):** Store minimal event history + audit log in durable storage (so page refresh does not lose context). Retention policies should be configurable.

### Authentication & Authorization (Dashboard vs Automation)
- **Dashboard (Humans):** Keycloak OIDC login; service maintains a secure session (BFF pattern) and enforces RBAC.
- **Automation (n8n):** Integration API keys (Bearer or `x-api-key`) scoped to tenant/session and allowed webhook targets.
- **Scripts as User:** Revocable PATs issued to a Keycloak user; requests are attributed to that user in `audit_log`.

### Minimal Navigation & Side-by-Side UX (Required)
Keep the UI to as few routes as possible:
- `/dashboard`: Operations (tabs: Overview, Sessions, Logs+Events)
- `/dashboard/conversations`: HITL (3-column)
- `/dashboard/admin`: Tenants/Keys/Audit/Policies

Layouts:
- **Sessions (2-column):** left = sessions grid; right = selected session details + timeline + filtered events/logs.
- **Logs+Events (2-column):** left = filters; right = stream with raw/structured toggle.
- **Conversations (3-column):** left = chat list; center = chat thread + takeover box; right = automation metadata (routing decision + n8n execution link + delivery/ack).

### n8n Execution Visibility (Implementation Options)
- **Option A (Lightweight):** `whatsapp-service` only tracks what it can observe (forwarded webhook URL, response codes, timings). No deep n8n execution introspection.
- **Option B (Full):** Integrate with n8n’s REST API (requires n8n auth token) to fetch execution by ID/status and link directly to n8n UI.
- **Option C (Push model):** Add a small “completion webhook” pattern in workflows: n8n POSTs execution metadata back to `whatsapp-service` for correlation.

### Multi-Tenancy Logic
- **Session Scope:** Dashboard users must provide an API Key.
- **View Filtering:** The UI filters sessions and logs based on the permissions associated with the API Key.
- **Tenant Isolation:** Keys should map to tenants, and tenants map to allowed session IDs + allowed webhook targets.

---

## User Interface Design (Concept)

### Sidebar (Navigation)
- **Dashboard** (tabs inside: Overview / Sessions / Logs+Events)
- **Conversations** (HITL)
- **Admin** (Tenants, keys, audit log, policies)

### Main View (Conversations)
- **Left Pane:** List of active chats, sorted by "Last Message" time.
- **Center Pane:** Chat bubble interface (Standard UI).
- **Right Pane:** "Automation Metadata" – showing which n8n workflow is currently handling this chat.
  - Include: last routing decision, last n8n execution status/link, correlationId, and recent errors for the selected conversation.

---

## User Interaction Model (Read / Write / Refresh)

### Read (visibility)
- **From whatsapp-api:** session list/status, QR, client info, chat/message metadata (as supported by whatsapp-api endpoints).
- **From n8n:** execution status and failure summaries (via API integration or push model).
- **From service:** normalized event stream, routing decisions, audit events, and operator activity.

### Write (actions)
- **To whatsapp-api (via service):** send message/media, mark seen/unseen, session logout/restart (as supported).
- **To n8n (indirect):** triggering workflows via webhook fanout; optionally creating “tickets” or operator tasks through n8n.
- **To service:** route management (static + dynamic), tenant policies, key rotation, approvals/takeover actions.

### Refresh (real-time vs periodic)
- **Real-time (WebSocket):** logs, inbound events, routing outcomes, conversation updates, operator actions.
- **Periodic polling:** upstream health, session status summaries, and n8n execution enrichment (to avoid overloading n8n).

---

## Critical Missing Pieces / Gaps to Address (Comprehensiveness Review)

### Data model & retention
- Define what is stored vs streamed-only: conversations, messages, events, and audit logs.
- Retention settings: per tenant and per data type (logs vs message bodies).
- Search/pagination: “find conversation by phone”, “find by correlationId”, “find by executionId”.

### Security & compliance
- RBAC, audit trails, and secret redaction are mandatory for business operations.
- SSRF protection and allowlists for outbound webhook targets.
- Rate limiting and abuse protection per API key/tenant.

### Reliability & operations
- Backpressure strategy for high message volume (queueing, dropping policies, and UI indicators).
- Health/readiness endpoints and upstream dependency status (“whatsapp-api unreachable”, “n8n unreachable”).
- Idempotency & duplication handling: detect duplicate inbound events and avoid double-forwarding / double-sending.

---

## Implementation Roadmap

### Phase 1: Core Observability (Week 1)
1. Implement `Socket.io` in `whatsapp-service`.
2. Replace simulated logs in `logs.html` with real WebSocket stream.
3. Update `sessions.html` to auto-refresh status using WebSockets.

### Phase 2: HITL Conversation Viewer (Week 2)
1. Add `/api/chats` and `/api/chats/:id/messages` endpoints.
2. Build the basic chat interface in `conversations.html`.
3. Implement the "Manual Send" API for agent takeover.

### Phase 3: n8n & CLI Integration (Week 3)
1. Link outgoing messages to `n8n-execution-id` headers.
2. Capture CLI output from deployment scripts and stream to a "Task Log" view.
3. Add "Execution Link" buttons to the chat interface.

---

## Success Metrics

| Metric | Target |
| :--- | :--- |
| **Agent Response Time** | Humans can respond to a "stuck" bot in < 30 seconds. |
| **Observability Latency** | Logs appear in the dashboard < 200ms after the event occurs. |
| **Session Up-time** | Admins are alerted to disconnected sessions < 60 seconds after failure. |
| **Multi-tenancy** | 0% data leakage between different API keys. |

---

## Appendix A: Postgres Data Layer (Migration-Light) + Conversation State

### A1. Why Postgres here
- We already operate Postgres for n8n; adding a second “app DB platform” increases surface area.
- We can minimize migrations by keeping a **stable relational spine** and putting evolving shapes into **JSONB payloads** with versioning.

### A2. Migration strategy (tenancy-focused, low churn)
- **One baseline migration** creates the stable tables below.
- Future changes should be **additive**:
  - Prefer adding keys to JSONB and tolerating optional fields.
  - Avoid renames/deletes; keep backward compatibility until a planned cleanup.
- Use a simple SQL migration tool (raw SQL) and keep the schema small and explicit.

### A3. Core tenancy “spine” tables (stable)
These tables are intentionally boring and rarely changed.

- **`tenants`**
  - `id uuid pk`, `name text`, `status text`, `created_at timestamptz`
- **`api_keys`**
  - `id uuid pk`, `tenant_id uuid fk`, `key_hash text unique`, `role text`, `scopes jsonb`, `status text`, `last_used_at timestamptz`, `created_at timestamptz`
  - Notes:
    - Store only **hashed** keys, never raw.
    - `scopes` controls which sessionIds and endpoints are allowed.
- **`wa_sessions`** (platform metadata, not WhatsApp auth itself)
  - `tenant_id uuid`, `session_id text`, `label text`, `status text`, `created_at timestamptz`
  - Notes:
    - WhatsApp auth state still lives in `whatsapp-api` volume; this table is for tenancy + UI metadata.
- **`webhook_registrations`** (routing targets)
  - `id uuid pk`, `tenant_id uuid`, `session_id text`, `url text`, `events text[]`, `filters jsonb`, `enabled bool`, `source text`, `created_at timestamptz`, `updated_at timestamptz`
  - Constraints:
    - unique `(tenant_id, session_id, url)`
  - Notes:
    - `filters` supports `fromMe`, `isGroup`, keyword rules, etc. without schema churn.
- **`audit_log`** (immutable)
  - `id uuid pk`, `tenant_id uuid`, `actor jsonb`, `action text`, `target jsonb`, `before jsonb`, `after jsonb`, `correlation_id text`, `created_at timestamptz`

### A4. Event + message storage (append-only, JSONB)
These tables power the dashboard timelines, debugging, and correlation across systems.

- **`events`**
  - `id uuid pk`, `tenant_id uuid`, `session_id text`, `event_type text`, `event_id text`, `correlation_id text`, `payload_version int`, `payload jsonb`, `created_at timestamptz`
  - Indexes:
    - `(tenant_id, session_id, created_at desc)`, `(correlation_id)`, `(event_id)`
- **`messages`** (optional but useful for conversation UI)
  - `id uuid pk`, `tenant_id uuid`, `session_id text`, `chat_id text`, `message_id text`, `direction text` (`inbound|outbound`), `source text` (`user|n8n|agent|external`), `payload_version int`, `payload jsonb`, `created_at timestamptz`
  - Notes:
    - Store raw + normalized fields inside `payload` to reduce migrations.

### A5. Conversation state for stateless bots
n8n workflows are stateless; end-users are not. The service provides a durable “conversation brain” that workflows can read/write.

- **`conversation_state`**
  - `tenant_id uuid`, `session_id text`, `chat_id text`
  - `state_version int` (optimistic concurrency)
  - `state jsonb`
  - `updated_at timestamptz`
  - optional: `expires_at timestamptz` (TTL for dead conversations)
  - Constraints:
    - primary key `(tenant_id, session_id, chat_id)`

#### Conversation State API (service endpoints)
These endpoints are designed for n8n and external orchestrators to be simple and safe.

- **GET** `/state/:sessionId/:chatId`
  - Returns: `{ state: object, stateVersion: number }` (or empty state with `stateVersion: 0`)
- **PUT** `/state/:sessionId/:chatId`
  - Body: `{ state: object, expectedStateVersion?: number, merge?: boolean }`
  - Behavior:
    - If `expectedStateVersion` is provided and mismatched → **409 Conflict**
    - If `merge=true` → shallow merge objects; otherwise replace
  - Returns: `{ stateVersion: number }`
- **DELETE** `/state/:sessionId/:chatId`
  - Clears state (used for “reset conversation”)

### A6. External handoff stages (ordering platforms, MCP-backed flows)
Some conversations will be “owned” by an external system for a period (e.g., an ordering platform with strict stages: `collect_items → confirm_address → payment → status_updates`). The state model must support this without hardcoding every workflow.

#### Add a stable “stage envelope” inside `conversation_state.state`
Store stage and ownership metadata in a predictable shape; keep all stage-specific details in JSON.

Example `state` shape:

```json
{
  "stage": {
    "name": "ordering.collect_items",
    "owner": "external",
    "provider": "acme-orders",
    "startedAt": "2026-01-21T12:00:00Z",
    "expiresAt": null
  },
  "context": {
    "customer": { "name": "..." },
    "cart": { "items": [] }
  },
  "external": {
    "orderId": "ord_123",
    "status": "draft",
    "raw": {}
  }
}
```

#### Stage transition rules (service-level)
- The service does not implement business logic, but it **enforces safety**:
  - Only allowed actors can change `stage.owner` (RBAC + scopes).
  - All transitions write an `audit_log` entry and an `events` entry.
  - Optional allowlist of stage names per tenant (to prevent arbitrary injection).

#### External integration patterns (choose per tenant/workflow)
- **Hard-coded provider adapter**: service has an integration module per provider (ordering API client). Good for stable providers and shared logic.
- **Webhook-based handoff**: service forwards events to external platform; external platform calls back with stage updates (signed).
- **MCP-backed handoff**: service calls an MCP tool to progress stages. Requirements:
  - MCP calls must be auditable (request/response summaries stored in `events.payload`, redacted as needed).
  - Timeouts and retries must be explicit; failures should not corrupt `conversation_state`.

#### Minimal endpoints for handoff
- **POST** `/handoff/:sessionId/:chatId/start`
  - Body: `{ provider, initialStage, context }`
- **POST** `/handoff/:sessionId/:chatId/advance`
  - Body: `{ toStage, patch, expectedStateVersion? }`
- **POST** `/handoff/:sessionId/:chatId/complete`
  - Body: `{ result, expectedStateVersion? }`

These endpoints let n8n (or agents) hand a conversation to an external system while preserving a single source of truth for state and visibility in the dashboard.

---

## Appendix B: Operational Learnings → Product Requirements

### B1. WhatsApp Web volatility (platform risk)
- WhatsApp Web can change without notice; upstream libraries can break message send/read-receipt behavior.
- Product requirement: the platform must support **rapid patching** and **feature flags** for WhatsApp behaviors (e.g. toggles for send-seen/read receipts) and expose these flags in Admin UI with audit logging.

### B2. Single inbound webhook constraint
- `whatsapp-api` supports only one outbound webhook URL; the service must remain the single inbound receiver and provide fanout.
- Product requirement: routing must be observable (why forwarded / why filtered) and safe (SSRF protections + allowlists).

### B3. n8n activation lifecycle affects webhooks
- Imported workflows may not register webhooks unless properly activated.
- Product requirement: Admin UI should surface “registration health” per workflow target (reachable, last success, last error) to avoid silent failures.

---

## Risks & Mitigations (High-Signal)

| Risk | Impact | Mitigation |
| --- | --- | --- |
| WhatsApp Web / whatsapp-web.js breaks behavior | Outbound sends or receipts fail | Keep fork strategy, feature flags, fast deploy path, strong observability + alerts |
| Duplicate processing (fanout + retries) | Double orders / double replies | Idempotency keys (eventId), dedupe windows, optimistic concurrency on state writes |
| Sensitive data exposure in logs/state | Compliance breach | Redaction policies, RBAC, audit log, encrypted secrets, retention controls |
| n8n instability / slow executions | Backlog, delayed replies | Timeouts, fallback routing, operator takeover, alerting on sustained failures |
