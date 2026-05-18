# n8n 2.x Integration Guide

This guide covers integrating n8n 2.x with WhatsApp API (wwebjs-api), including critical differences from n8n 1.x and common pitfalls.

## Overview

n8n 2.x introduces significant changes to webhook handling, workflow versioning, and expression evaluation that affect WhatsApp integrations.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ WhatsApp User   │────▶│   wwebjs-api    │────▶│ n8n Webhook  │
└─────────────────┘     │   (container)   │     │ (container)  │
                        └─────────────────┘     └──────┬───────┘
                              ▲                        │
                              │                        ▼
                        ┌─────┴─────┐          ┌──────────────┐
                        │ Internal  │◀─────────│ HTTP Request │
                        │ Docker    │          │    Node      │
                        │ Network   │          └──────────────┘
                        └───────────┘
```

**Key Point:** Use internal Docker network URLs between containers, not external URLs.

## Critical Differences: n8n 1.x vs 2.x

### 1. Webhook Body Location

| Version | POST Body Access |
|---------|------------------|
| n8n 1.x | `$json.dataType` |
| n8n 2.x | `$json.body.dataType` |

```javascript
// n8n 1.x - POST body directly in $json
$json.dataType        // "message_create"
$json.data.from       // "1234567890@c.us"

// n8n 2.x - POST body under $json.body
$json.body.dataType   // "message_create"
$json.body.data.from  // "1234567890@c.us"

// Full webhook output in n8n 2.x:
{
  "headers": {...},
  "params": {},
  "query": {},
  "body": {
    "dataType": "message_create",
    "sessionId": "mysession",
    "data": {...}
  },
  "webhookUrl": "https://...",
  "executionMode": "production"
}
```

### 2. Set Node Expression Depth Limitation

**Critical:** The Set node (typeVersion 3.4) cannot resolve paths deeper than ~2 levels.

```javascript
// WORKS (2 levels)
$json.body.dataType
$json.body.sessionId

// FAILS - returns null (4 levels)
$json.body.data.message.from
$json.body.data.message.body
```

**Solution:** Use Code node for nested data extraction.

### 3. IF Node Changes

The IF node v2 requires:
- `typeValidation: "loose"` for flexible comparisons
- Different condition structure

```json
{
  "parameters": {
    "options": {
      "typeValidation": "loose"
    },
    "conditions": {
      "combinator": "and",
      "conditions": [
        {
          "leftValue": "={{ $json.dataType }}",
          "rightValue": "message_create",
          "operator": {"type": "string", "operation": "equals"}
        }
      ]
    }
  }
}
```

## Workflow Versioning System

n8n 2.x uses a version-based workflow system. Simply updating `workflow_entity` does NOT reload the workflow.

### Required Tables

| Table | Purpose | Required |
|-------|---------|----------|
| `workflow_entity` | Current workflow definition | Yes |
| `workflow_history` | Version snapshots | Yes (for activation) |
| `shared_workflow` | Project association | Yes (for UI visibility) |

### Database Update Pattern

```sql
-- Step 1: Generate new version UUID
-- Use: SELECT gen_random_uuid();

-- Step 2: INSERT into workflow_history FIRST
INSERT INTO workflow_history (
  "versionId", "workflowId", nodes, connections,
  "createdAt", "updatedAt", authors
)
VALUES (
  'NEW_UUID',
  'WORKFLOW_ID',
  $nodes$[...]$nodes$::json,
  $conn${...}$conn$::json,
  NOW(),
  NOW(),
  '[]'
);

-- Step 3: UPDATE workflow_entity (references new version)
UPDATE workflow_entity
SET
  nodes = $nodes$[...]$nodes$::json,
  connections = $conn${...}$conn$::json,
  "versionId" = 'NEW_UUID',
  "activeVersionId" = 'NEW_UUID',
  "updatedAt" = NOW()
WHERE id = 'WORKFLOW_ID';

-- Step 4: Restart n8n
-- docker compose restart n8n
```

**Note:** Use PostgreSQL dollar quoting (`$tag$...$tag$`) to avoid JSON escaping issues.

## Docker Network Isolation

Containers cannot reliably reach external URLs that resolve to the same host. The request goes out through the proxy and may timeout.

### URL Patterns

```javascript
// WRONG - times out from n8n container
"https://wa.yourdomain.com/client/sendMessage/mysession"

// CORRECT - use internal Docker network
"http://wwebjs-api:3000/client/sendMessage/{{ $json.sessionId }}"
```

### Verification

```bash
# Test from n8n container
docker exec n8n wget -q -O- --timeout=5 \
  "http://wwebjs-api:3000/session/status/mysession" \
  --header="x-api-key: YOUR_API_KEY"
```

### Network Requirements

n8n must be on the same Docker networks as the services it calls. Add external networks to `docker-compose.override.yml`:

```yaml
services:
  n8n:
    networks:
      - default
      - proxy
      - whatsapp-service_default  # For user registration
      - wwebjs-api_default             # For sending messages

networks:
  proxy:
    external: true
  whatsapp-service_default:
    external: true
  wwebjs-api_default:
    external: true
```

**Tip:** Use `docker network ls` to find the exact network names created by other services.

## Environment Variables in Workflows

### Enabling `$env.*` Access

n8n 2.x blocks environment variable access in workflow nodes by default. To enable `$env.API_KEY` expressions:

```yaml
# docker-compose.override.yml
services:
  n8n:
    environment:
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Without this, `{{ $env.API_KEY }}` resolves to an empty string, causing silent authentication failures.

### Separate API Keys

Use distinct environment variables for different services:

| Variable | Purpose | Used For |
|----------|---------|----------|
| `API_KEY` | n8n's own API authentication | Webhook auth header check |
| `WHATSAPP_API_KEY` | wwebjs-api authentication | Sending WhatsApp messages |
| `SERVICE_API_KEY` | whatsapp-service auth | User registration, tags |

```yaml
# docker-compose.override.yml
services:
  n8n:
    environment:
      - API_KEY
      - WHATSAPP_API_KEY
      - SERVICE_API_KEY
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

### Usage in HTTP Request Nodes

```json
{
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "={{ $env.SERVICE_API_KEY }}"
      }
    ]
  }
}
```

## Code Node Pattern for Data Extraction

Use this pattern to reliably extract nested data from webhooks:

```javascript
// Extract data from webhook body
// Using Code node because Set node fails for nested paths in n8n 2.x
const input = $input.first();
const webhookData = input.json;
const body = webhookData.body || webhookData;
const data = body.data || {};
const message = data.message || data || {};

return [{
  json: {
    dataType: body.dataType || null,
    sessionId: body.sessionId || null,
    from: message.from || null,
    messageBody: message.body || null,
    fromMe: message.fromMe || false,
    timestamp: message.timestamp || null
  }
}];
```

**Output paths after Code node:**
- `$json.dataType`
- `$json.sessionId`
- `$json.from`
- `$json.messageBody`
- `$json.fromMe`

## Complete Workflow Example

### WhatsApp Echo Reply Workflow

```
WhatsApp Webhook → Extract Data (Code) → Is Incoming Message? (IF)
                                              ↓ true
                                         Echo Reply (HTTP) → Respond OK
                                              ↓ false
                                         Log Other Event → Respond OK
```

### IF Node Condition (Prevent Duplicates)

To prevent duplicate responses:
- Check `dataType === "message_create"`
- Check `fromMe === false` (ignore bot's own messages)

```json
{
  "conditions": {
    "combinator": "and",
    "conditions": [
      {
        "leftValue": "={{ $json.dataType }}",
        "rightValue": "message_create",
        "operator": {"type": "string", "operation": "equals"}
      },
      {
        "leftValue": "={{ $json.fromMe }}",
        "rightValue": false,
        "operator": {"type": "boolean", "operation": "equals"}
      }
    ]
  }
}
```

### HTTP Request Node (Echo Reply)

```json
{
  "url": "=http://wwebjs-api:3000/client/sendMessage/{{ $json.sessionId }}",
  "method": "POST",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {"name": "x-api-key", "value": "YOUR_API_KEY"},
      {"name": "Content-Type", "value": "application/json"}
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ chatId: $json.from, contentType: 'string', content: 'Echo: ' + $json.messageBody }) }}"
}
```

## Troubleshooting

### Workflow Not Receiving Webhooks

1. Check workflow is activated: `docker logs n8n | grep Activated`
2. Verify webhook URL format: `https://your-n8n.com/webhook/path`
3. Test with curl: `curl -X POST https://your-n8n.com/webhook/path -d '{}'`

### Data Extraction Returns Null

1. Check expression depth - Set node fails beyond 2 levels
2. Use Code node for nested paths (`body.data.message.*`)
3. Verify data structure in execution logs

### HTTP Request Timeout

**Symptom:** `NodeApiError: The connection timed out` (130 seconds)

**Solution:** Use internal Docker URL instead of external:
```javascript
// Change from
"https://wa.yourdomain.com/..."
// To
"http://wwebjs-api:3000/..."
```

### Workflow Changes Not Taking Effect

1. Check `workflow_history` has entry for `activeVersionId`
2. Ensure `versionId` and `activeVersionId` match in `workflow_entity`
3. Insert into `workflow_history` BEFORE updating `workflow_entity`
4. Restart n8n after database changes

**Quick fix SQL:**
```sql
DO $$
DECLARE
  new_version_id UUID := gen_random_uuid();
  workflow_nodes JSON;
  workflow_connections JSON;
BEGIN
  SELECT nodes::json, connections::json INTO workflow_nodes, workflow_connections
  FROM workflow_entity WHERE id = 'YOUR_WORKFLOW_ID';

  INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, name)
  VALUES (new_version_id::text, 'YOUR_WORKFLOW_ID', 'system', workflow_nodes, workflow_connections, 'Workflow Name');

  UPDATE workflow_entity
  SET "versionId" = new_version_id::text, "activeVersionId" = new_version_id::text
  WHERE id = 'YOUR_WORKFLOW_ID';
END $$;
```

### Environment Variables Empty in Expressions

**Symptom:** `{{ $env.API_KEY }}` resolves to empty string, causing 403 errors

**Solution:** Add to docker-compose.override.yml:
```yaml
environment:
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

### Service Returns 403 Forbidden

**Causes:**
1. Wrong API key variable (using `API_KEY` instead of `SERVICE_API_KEY`)
2. Environment variable not passed to container
3. `N8N_BLOCK_ENV_ACCESS_IN_NODE` blocking access

**Debug:**
```bash
# Check if env var is accessible from container
docker compose exec n8n sh -c 'echo $SERVICE_API_KEY'

# Test manual call with API key
docker compose exec n8n sh -c 'wget -q -O- \
  --header="x-api-key: $SERVICE_API_KEY" \
  http://whatsapp-service:3001/service/health'
```

### Duplicate Message Responses

**Symptom:** Bot sends 2 replies per incoming message

**Causes:**
- wwebjs-api sends both `message` and `message_create` events
- Bot echoes its own sent messages (`fromMe: true`)

**Solution:** Filter with AND condition:
- `dataType === "message_create"`
- `fromMe === false`

## Debugging Strategy

1. **webhook.site**: Debug data extraction before calling real APIs
2. **Direct API test**: Verify WhatsApp API works outside n8n
3. **Container network test**: `docker exec n8n wget -q -O- "http://wwebjs-api:3000/..."`
4. **execution_data table**: Query PostgreSQL for detailed execution info

```bash
# Check recent executions
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT id, status FROM execution_entity ORDER BY \"startedAt\" DESC LIMIT 5;"

# View execution data (replace EXECUTION_ID)
docker exec n8n_postgres psql -U n8n -d n8n -t -c \
  "SELECT data FROM execution_data WHERE \"executionId\" = EXECUTION_ID;"
```

## Quick Reference Commands

```bash
# Check n8n logs
docker logs n8n --tail=50 -f

# Restart n8n
cd /path/to/n8n && docker compose restart n8n

# List workflows
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT id, name FROM workflow_entity;"

# Check webhook registrations
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT * FROM webhook_entity;"

# Test internal network
docker exec n8n wget -q -O- "http://wwebjs-api:3000/session/status/SESSION_ID" \
  --header="x-api-key: YOUR_API_KEY"
```

## Key Learnings Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Null data extraction | Set node depth limit (2 levels) | Use Code node |
| Workflow changes ignored | Missing workflow_history entry | INSERT history BEFORE UPDATE entity |
| HTTP timeout | Docker network isolation | Use internal URLs + external networks |
| Duplicate replies | Multiple events + bot's own messages | Filter `message_create` AND `fromMe === false` |
| Webhook body path | n8n 2.x change | Access via `$json.body.*` |
| `$env.*` returns empty | `N8N_BLOCK_ENV_ACCESS_IN_NODE` default | Set to `false` in docker-compose |
| 403 on service calls | Wrong API key variable | Use `SERVICE_API_KEY` not `API_KEY` |
| Container unreachable | Missing network | Add external networks to n8n |

## Related Documentation

- [WhatsApp API Setup](../whatsapp/01-whatsapp-api-setup.md)
- [Debugging Strategies](../guides/02-debugging-strategies.md)
- [n8n Node Development](02-n8n-node-development.md)
- [n8n Integration (v1)](04-n8n-integration-v1.md)
