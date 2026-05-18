# Spec 16: ERPNext Integration — Shared Schema for wa.dt.wrld

## Summary

Replace planned Postgres tenancy (task 035) with an ERPNext sync adapter. ERPNext becomes the source of truth for organisational data (users, campaigns/initiatives, lifecycle). wa.dt.wrld keeps MongoDB for fast operational state and syncs to/from ERPNext asynchronously.

## Architecture

```
wa.dt.wrld (fast path)              ERPNext (org data)
─────────────────────               ──────────────────
MongoDB                             MariaDB/Postgres
  users (cached)          ◄──sync── Contact
  tagConfigs (cached)     ◄──sync── Campaign (custom fields)
  progress                ──sync──► Communication / Custom DocType
  messages (owned)                   Communication (log)
  sessions (owned)

Sync direction:
  ERPNext → wa.dt.wrld:  webhooks (Contact created, Campaign updated)
  wa.dt.wrld → ERPNext:  REST API (user registered, progress updated, message logged)
```

## ERPNext DocType Mapping

### Contact → wa.dt.wrld User

ERPNext Contact fields (standard + custom):

| ERPNext Field | Type | Maps to wa.dt.wrld | Notes |
|---|---|---|---|
| `name` | Auto | (internal ID) | ERPNext auto-generated |
| `first_name` | Data | — | Display name |
| `last_name` | Data | — | Display name |
| `company_name` | Link → Company | (tenant scope) | Organisation/tenant |
| `phone` | Data | `identifier` | Primary phone number |
| `mobile_no` | Data | `identifier` (alt) | Mobile number |
| `email_id` | Data | — | Optional |
| `status` | Select | — | Lead/Open/Replied/etc. |
| **`custom_wa_platform`** | Select | `platform` | `c.us`, `g.us`, `lid` |
| **`custom_wa_tags`** | Table MultiSelect | `tags[]` | Links to Campaign |
| **`custom_wa_lifecycle_stage`** | Select | user state | Enrolled/Active/Completed/Churned |
| **`custom_wa_last_message_at`** | Datetime | — | Last interaction timestamp |
| **`custom_wa_session_count`** | Int | — | Total sessions |

### Campaign → wa.dt.wrld Tag/TagConfig

ERPNext Campaign fields (standard + custom):

| ERPNext Field | Type | Maps to wa.dt.wrld | Notes |
|---|---|---|---|
| `name` | Auto | — | ERPNext ID |
| `campaign_name` | Data | `tag` | e.g. "SOMO", "HELLO_TRACTOR" |
| `company` | Link → Company | (tenant scope) | Organisation |
| `status` | Select | `tagConfig.enabled` | Active/Inactive |
| **`custom_wa_tag`** | Data | `tag` (uppercase) | Exact tag string for wa.dt.wrld |
| **`custom_wa_display_name`** | Data | `tagConfig.displayName` | Human-readable name |
| **`custom_wa_routing_targets`** | JSON | `tagConfig.targets[]` | `qdrant_rag`, `n8n_webhook`, etc. |
| **`custom_wa_system_prompt`** | Long Text | Qdrant system prompt | Per-tag LLM instructions |
| **`custom_wa_welcome_messages`** | JSON | welcome config | Array of welcome message items |
| **`custom_wa_regex_pattern`** | Data | messageRouter regex | Auto-detection pattern |
| **`custom_wa_voice_prompt_number`** | Data | — | For ai-ops voice routing |

### Communication → Message/Session Log

ERPNext Communication fields (standard):

| ERPNext Field | Type | Source | Notes |
|---|---|---|---|
| `communication_type` | Select | `"Chat"` | Always Chat for WhatsApp |
| `communication_medium` | Select | `"WhatsApp"` | Channel identifier |
| `subject` | Data | tag or "Direct" | Context |
| `content` | Long Text | message body | Message content |
| `sender` | Data | phone number | From |
| `recipients` | Data | phone number | To |
| `reference_doctype` | Data | `"Campaign"` | Link to initiative |
| `reference_name` | Data | campaign name | Which initiative |
| `sent_or_received` | Select | "Received"/"Sent" | Direction |
| `communication_date` | Datetime | event timestamp | When |

## Frappe REST API Patterns

### Authentication

wa.dt.wrld authenticates to ERPNext using API key + secret:

```typescript
// Header format
const headers = {
  'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
  'Content-Type': 'application/json',
};
```

### Create Contact (on user registration)

```
POST /api/resource/Contact
{
  "first_name": "WhatsApp User",
  "mobile_no": "254712345678",
  "company_name": "Azizi Africa",
  "custom_wa_platform": "c.us",
  "custom_wa_tags": [{"campaign": "SOMO"}],
  "custom_wa_lifecycle_stage": "Enrolled"
}
```

### Read Contact (on first message from unknown user)

```
GET /api/resource/Contact?filters=[["mobile_no","=","254712345678"]]&fields=["name","mobile_no","custom_wa_platform","custom_wa_tags","custom_wa_lifecycle_stage"]
```

### Update Contact (on progress change)

```
PUT /api/resource/Contact/{name}
{
  "custom_wa_lifecycle_stage": "Active",
  "custom_wa_last_message_at": "2026-02-25T10:30:00",
  "custom_wa_session_count": 5
}
```

### Read Campaign configs (on startup / cache refresh)

```
GET /api/resource/Campaign?filters=[["status","=","Active"]]&fields=["campaign_name","custom_wa_tag","custom_wa_display_name","custom_wa_routing_targets","custom_wa_system_prompt","custom_wa_welcome_messages","custom_wa_regex_pattern","company"]
```

### Log Communication (async, after message processed)

```
POST /api/resource/Communication
{
  "communication_type": "Chat",
  "communication_medium": "WhatsApp",
  "subject": "SOMO",
  "content": "User asked about Module 3",
  "sender": "254712345678",
  "sent_or_received": "Received",
  "reference_doctype": "Campaign",
  "reference_name": "SOMO"
}
```

## ERPNext Webhook Configuration

ERPNext fires webhooks to wa.dt.wrld on document events:

| DocType | Event | wa.dt.wrld Endpoint | Purpose |
|---|---|---|---|
| Contact | after_insert | `POST /service/webhooks/erpnext/contact` | New user added in ERPNext → cache in MongoDB |
| Contact | on_update | `POST /service/webhooks/erpnext/contact` | Lifecycle/tag change → update cache |
| Contact | on_trash | `POST /service/webhooks/erpnext/contact` | User removed → remove from cache |
| Campaign | after_insert | `POST /service/webhooks/erpnext/campaign` | New initiative → create tagConfig |
| Campaign | on_update | `POST /service/webhooks/erpnext/campaign` | Config change → update tagConfig |
| Campaign | on_trash | `POST /service/webhooks/erpnext/campaign` | Initiative removed → disable tagConfig |

### Webhook Payload Structure

ERPNext sends the full document as JSON:

```json
{
  "event": "after_insert",
  "doctype": "Contact",
  "name": "CONT-00042",
  "data": {
    "first_name": "Jane",
    "mobile_no": "254712345678",
    "company_name": "Azizi Africa",
    "custom_wa_platform": "c.us",
    "custom_wa_tags": [{"campaign": "SOMO"}],
    "custom_wa_lifecycle_stage": "Enrolled"
  }
}
```

### Webhook Security

ERPNext webhook includes a secret header for verification:

```
X-Frappe-Webhook-Secret: <shared-secret>
```

wa.dt.wrld validates this header before processing.

## wa.dt.wrld Sync Adapter

### New Files

```
src/services/
  erpnextSync.ts          # ERPNext sync adapter
src/routes/
  erpnextWebhooks.ts      # Webhook receiver endpoints
src/types/
  erpnext.ts              # ERPNext document type interfaces
```

### Interface: ERPNextSyncService

```typescript
interface ERPNextSyncService {
  // Startup: load all active Campaigns → tagConfigs, Contacts → users
  initialize(): Promise<void>;

  // User sync (wa.dt.wrld → ERPNext)
  syncUserRegistration(identifier: string, platform: string, tags: string[]): Promise<void>;
  syncUserProgress(identifier: string, tag: string, progress: Record<string, unknown>): Promise<void>;
  syncLifecycleStage(identifier: string, stage: string): Promise<void>;

  // Message logging (wa.dt.wrld → ERPNext, async/batched)
  logCommunication(message: CommunicationLog): Promise<void>;

  // Cache refresh (ERPNext → wa.dt.wrld)
  refreshContactCache(): Promise<void>;
  refreshCampaignCache(): Promise<void>;

  // Webhook handlers (ERPNext → wa.dt.wrld, real-time)
  handleContactWebhook(event: string, data: ERPNextContact): Promise<void>;
  handleCampaignWebhook(event: string, data: ERPNextCampaign): Promise<void>;
}
```

### Configuration

```bash
# Required (enables ERPNext sync)
ENABLE_ERPNEXT_SYNC=true
ERPNEXT_URL=https://erp.dater.world
ERPNEXT_API_KEY=<api-key>
ERPNEXT_API_SECRET=<api-secret>
ERPNEXT_WEBHOOK_SECRET=<shared-secret>

# Optional
ERPNEXT_SYNC_INTERVAL_MS=300000       # Cache refresh every 5 min
ERPNEXT_BATCH_LOG_INTERVAL_MS=10000   # Batch communication logs every 10s
ERPNEXT_COMPANY=Azizi Africa          # Default company filter
```

### Sync Rules

1. **Never block message routing on ERPNext.** All reads come from MongoDB cache. ERPNext sync is async.
2. **Write-through on registration.** When wa.dt.wrld registers a user, it writes to MongoDB immediately and queues an ERPNext sync.
3. **Webhook for real-time updates.** When ERPNext Contact/Campaign changes, webhook updates MongoDB cache within seconds.
4. **Periodic reconciliation.** Every 5 minutes, refresh full Contact and Campaign cache from ERPNext to catch missed webhooks.
5. **Graceful degradation.** If ERPNext is unreachable, wa.dt.wrld continues with cached data. Queued syncs retry with backoff.

## Testing Without ERPNext

For unit and integration tests, the sync adapter uses an interface that can be mocked:

```typescript
// Test: mock ERPNext responses
const mockSync = {
  syncUserRegistration: jest.fn(),
  syncUserProgress: jest.fn(),
  logCommunication: jest.fn(),
  handleContactWebhook: jest.fn(),
  handleCampaignWebhook: jest.fn(),
};
eventRouter.setErpnextSync(mockSync);
```

For schema validation tests, mirror ERPNext DocType schemas as TypeScript interfaces in `src/types/erpnext.ts`. These serve as the contract — if ERPNext custom fields change, the TypeScript compiler catches the mismatch.

## Migration Path

### From current state (MongoDB-only)

1. Stand up ERPNext, configure Company + custom fields
2. Deploy wa.dt.wrld with `ENABLE_ERPNEXT_SYNC=false` (no change)
3. Run one-time migration: export MongoDB users → ERPNext Contacts, tagConfigs → Campaigns
4. Enable sync: `ENABLE_ERPNEXT_SYNC=true`
5. Verify: ERPNext Contact list matches MongoDB user list
6. Remove task 035 (Postgres tenancy) — no longer needed

### Tasks replaced

| Old Task | Replacement |
|---|---|
| 035 - Postgres tenancy foundation | ERPNext sync adapter + webhook handlers |
| 038 - RBAC + audit | ERPNext role permissions + Activity Log |
| 039 - Alerts | ERPNext Notification DocType |
| 040 - Retention + indexing | ERPNext data retention per DocType |
| 044 - API keys + PATs | Frappe API key system |
