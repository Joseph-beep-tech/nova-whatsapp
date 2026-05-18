# ERPNext Setup for WhatsApp + Voice Integration

> **This file will move to `ai-ops-platform/docs/erpnext/ERP_SETUP_WA.md`** once the parent workspace is set up. It lives here temporarily for review.

## Overview

ERPNext serves as the shared operational layer between:
- **ai-ops-platform** (control plane — prompt design, signals, experiments)
- **wa.dt.wrld** (WhatsApp execution — message routing, LLM, RAG)
- **Voice/SIP service** (call handling, transcription, structured output)

This document is the ERPNext configuration roadmap: what to set up, in what order, and how each system connects.

---

## Phase E0: ERPNext Instance Setup

### E0.1 — Stand up ERPNext

- [ ] Deploy ERPNext v15 (LTS) via Docker or Frappe Cloud
- [ ] Configure site: `erp.dater.world`
- [ ] Install modules: CRM, Projects (optional), HR (optional)
- [ ] Create Administrator API key + secret for service-to-service auth
- **Verify:** `curl -H "Authorization: token key:secret" https://erp.dater.world/api/method/frappe.auth.get_logged_user` returns `Administrator`

### E0.2 — Company Setup (Multi-Tenant)

Each organisation is an ERPNext Company:

- [ ] Create Company: **Azizi Africa** (platform admin org)
- [ ] Create Company: **SOMO** (first client org — or use Azizi Africa initially)
- [ ] Configure Company-level permission isolation:
  - User Role Profile per company
  - Restrict "Website User" role to their company's documents
- **Verify:** User in Company A cannot see Company B's Contacts or Campaigns

### E0.3 — API User for wa.dt.wrld

- [ ] Create user: `whatsapp-service@dater.world` (type: System User)
- [ ] Assign roles: `System Manager` (or scoped custom role with DocType permissions)
- [ ] Generate API key + secret
- [ ] Store in wa.dt.wrld env: `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET`
- **Verify:** wa.dt.wrld can `GET /api/resource/Contact?limit_page_length=1`

### E0.4 — API User for ai-ops-platform

- [ ] Create user: `ai-ops@dater.world` (type: System User)
- [ ] Assign roles: appropriate scoped role
- [ ] Generate API key + secret
- [ ] Store in ai-ops env or MCP tool config
- **Verify:** ai-ops MCP ERPNext tools can read/write Campaigns

---

## Phase E1: Custom DocType Fields

### E1.1 — Contact Custom Fields (WhatsApp User)

Add to Contact DocType via Customize Form:

| Field Label | Fieldname | Type | Options | Section |
|---|---|---|---|---|
| WhatsApp Platform | `custom_wa_platform` | Select | `c.us\ng.us\nlid` | WhatsApp |
| WhatsApp Tags | `custom_wa_tags` | Table MultiSelect | Campaign | WhatsApp |
| Lifecycle Stage | `custom_wa_lifecycle_stage` | Select | `Pending\nEnrolled\nActive\nCompleted\nAlumni\nChurned` | WhatsApp |
| Last Message At | `custom_wa_last_message_at` | Datetime | | WhatsApp |
| Session Count | `custom_wa_session_count` | Int | | WhatsApp |
| Voice Session Count | `custom_wa_voice_session_count` | Int | | Voice |
| Last Voice Session | `custom_wa_last_voice_session_at` | Datetime | | Voice |

**Verify:** Create a Contact via API with custom fields → fields appear in desk

### E1.2 — Campaign Custom Fields (Initiative/Tag)

Add to Campaign DocType via Customize Form:

| Field Label | Fieldname | Type | Options | Section |
|---|---|---|---|---|
| WA Tag | `custom_wa_tag` | Data | | WhatsApp Config |
| Display Name | `custom_wa_display_name` | Data | | WhatsApp Config |
| Routing Targets | `custom_wa_routing_targets` | JSON | | WhatsApp Config |
| System Prompt | `custom_wa_system_prompt` | Long Text | | WhatsApp Config |
| Welcome Messages | `custom_wa_welcome_messages` | JSON | | WhatsApp Config |
| Regex Pattern | `custom_wa_regex_pattern` | Data | | WhatsApp Config |
| Voice Prompt Number | `custom_wa_voice_prompt_number` | Data | | Voice Config |
| Voice System Prompt | `custom_wa_voice_system_prompt` | Long Text | | Voice Config |
| Initiative Objective | `custom_initiative_objective` | Small Text | | Initiative |
| Theory of Change | `custom_theory_of_change` | JSON | | Initiative |
| Success Metrics | `custom_success_metrics` | JSON | | Initiative |
| Target Population | `custom_target_population` | Small Text | | Initiative |

**Verify:** Create Campaign "SOMO" via API with `custom_wa_tag: "SOMO"` → appears in desk with all fields

### E1.3 — Custom DocType: Prompt Config (for ai-ops)

New DocType (not customization of existing):

```
DocType: Prompt Config
Fields:
  - prompt_name (Data, required)
  - campaign (Link → Campaign)
  - version (Int)
  - is_active (Check)
  - role_identity (Long Text)
  - purpose_protocol (Long Text)
  - content_sources (JSON)
  - data_capture_config (JSON)
  - guardrails (Long Text)
  - measurement_schema (JSON)
  - quality_score (Percent)
  - created_by (Link → User)
Naming: format: PC-.####
Permissions: System Manager (full), Website User (read if own company)
```

### E1.4 — Custom DocType: Signal (for ai-ops)

```
DocType: Signal
Fields:
  - signal_name (Data, required)
  - campaign (Link → Campaign)
  - signal_type (Select: Completion/Assessment/Sentiment/Engagement/Custom)
  - extraction_method (Select: Keyword/Structured Output/LLM Analysis)
  - target_value (Float)
  - current_value (Float)
  - trend_data (JSON)
  - last_computed_at (Datetime)
Naming: format: SIG-.####
```

---

## Phase E2: Webhook Configuration

### E2.1 — Webhooks to wa.dt.wrld

Configure in ERPNext: Setup > Integrations > Webhook

| # | DocType | Event | URL | Condition |
|---|---|---|---|---|
| 1 | Contact | after_insert | `https://wa.dater.world/service/webhooks/erpnext/contact` | `doc.custom_wa_platform` is set |
| 2 | Contact | on_update | `https://wa.dater.world/service/webhooks/erpnext/contact` | `doc.custom_wa_platform` is set |
| 3 | Contact | on_trash | `https://wa.dater.world/service/webhooks/erpnext/contact` | |
| 4 | Campaign | after_insert | `https://wa.dater.world/service/webhooks/erpnext/campaign` | `doc.custom_wa_tag` is set |
| 5 | Campaign | on_update | `https://wa.dater.world/service/webhooks/erpnext/campaign` | `doc.custom_wa_tag` is set |

All webhooks:
- Method: POST
- Headers: `X-Frappe-Webhook-Secret: <shared-secret>`, `Content-Type: application/json`
- Data: JSON with full document

### E2.2 — Webhooks to ai-ops-platform

| # | DocType | Event | URL | Purpose |
|---|---|---|---|---|
| 1 | Communication | after_insert | `https://ai-ops.dater.world/api/v1/webhooks/erpnext/communication` | New message → signal extraction |
| 2 | Contact | on_update | `https://ai-ops.dater.world/api/v1/webhooks/erpnext/contact` | Lifecycle change → update portal |

### E2.3 — Webhooks from wa.dt.wrld to ERPNext

wa.dt.wrld calls ERPNext REST API directly (not webhooks). Key write paths:

| Event in wa.dt.wrld | ERPNext API Call | When |
|---|---|---|
| User registered | `POST /api/resource/Contact` | New user sends first message |
| User tagged | `PUT /api/resource/Contact/{name}` (update `custom_wa_tags`) | Tag assigned via regex or LLM |
| Message received | `POST /api/resource/Communication` | After message processed (batched) |
| Progress updated | `PUT /api/resource/Contact/{name}` (update lifecycle, counts) | After session |
| Welcome sent | `POST /api/resource/Communication` | Log outbound message |

---

## Phase E3: Seed Data

### E3.1 — Seed existing wa.dt.wrld data into ERPNext

One-time migration script:

```bash
# Export from wa.dt.wrld MongoDB
node scripts/export-users-for-erpnext.ts > /tmp/contacts.json
node scripts/export-tagconfigs-for-erpnext.ts > /tmp/campaigns.json

# Import to ERPNext via Data Import or REST API
python scripts/import-contacts-to-erpnext.py /tmp/contacts.json
python scripts/import-campaigns-to-erpnext.py /tmp/campaigns.json
```

### E3.2 — Seed Campaign configs

Create Campaign entries for existing tags:

```json
[
  {
    "campaign_name": "SOMO Learning Program",
    "company": "Azizi Africa",
    "status": "Active",
    "custom_wa_tag": "SOMO",
    "custom_wa_display_name": "SOMO Learning",
    "custom_wa_routing_targets": [{"type": "qdrant_rag", "collection": "somo"}],
    "custom_wa_regex_pattern": "\\bSOMO\\b",
    "custom_wa_system_prompt": "You are a learning coach for the SOMO program..."
  },
  {
    "campaign_name": "Hello Tractor",
    "company": "Azizi Africa",
    "status": "Active",
    "custom_wa_tag": "HELLO_TRACTOR",
    "custom_wa_display_name": "Hello Tractor",
    "custom_wa_routing_targets": [{"type": "qdrant_rag", "collection": "hello_tractor"}],
    "custom_wa_regex_pattern": "\\bHELLO.?TRACTOR\\b"
  }
]
```

---

## Phase E4: n8n Bridge Workflows (Optional)

For complex sync scenarios, n8n workflows can orchestrate between systems:

| Workflow | Trigger | Action |
|---|---|---|
| Bulk whitelist sync | Schedule (hourly) | Read Google Sheet → Create/Update ERPNext Contacts → Sync to wa.dt.wrld |
| Progress report | Schedule (daily) | Read ERPNext Communications → Aggregate signals → Update Signal DocType |
| Nudge engine | Schedule (daily) | Query Contacts where `last_message_at` > 7 days → Send WhatsApp via wa.dt.wrld |
| Escalation | wa.dt.wrld webhook | HITL handoff event → Create ERPNext Issue → Notify agent |

---

## Verification Checklist

### ERPNext side
- [ ] ERPNext instance accessible at `erp.dater.world`
- [ ] Company "Azizi Africa" exists with user isolation
- [ ] Contact custom fields created and visible in desk
- [ ] Campaign custom fields created and visible in desk
- [ ] Prompt Config DocType created (for ai-ops)
- [ ] Signal DocType created (for ai-ops)
- [ ] API user for wa.dt.wrld with correct permissions
- [ ] API user for ai-ops with correct permissions
- [ ] Webhooks configured for Contact and Campaign events
- [ ] Seed data imported (Contacts from MongoDB, Campaigns from tagConfigs)

### wa.dt.wrld side
- [ ] `ENABLE_ERPNEXT_SYNC=true` in env
- [ ] Webhook receiver endpoints at `/service/webhooks/erpnext/*`
- [ ] ERPNext sync adapter reads Campaigns on startup
- [ ] User registration writes through to ERPNext Contact
- [ ] Communication logging batches to ERPNext (async)
- [ ] Cache refresh runs every 5 minutes
- [ ] Graceful degradation: ERPNext down → service continues with cache

### ai-ops-platform side
- [ ] MCP ERPNext tools configured with ai-ops API key
- [ ] Initiative creation writes to ERPNext Campaign
- [ ] Whitelist management writes to ERPNext Contact
- [ ] Signal extraction reads from ERPNext Communication
- [ ] Portal frontend reads from ERPNext API (via MCP or direct)

---

## Security

| Concern | Mitigation |
|---|---|
| API key exposure | Keys in env vars only, never in code or logs |
| Webhook forgery | `X-Frappe-Webhook-Secret` header validation |
| Cross-tenant data | ERPNext Company-level permission isolation |
| PII in Communication | Redact phone numbers in Communication content (log sanitised summary) |
| ERPNext admin access | Separate API users per service with minimal role permissions |
