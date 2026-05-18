# n8n Workflow Session Notes

## Key Learnings (2026-01-28)

### 1. Environment Variable Access in n8n 2.x

**Problem**: n8n 2.2.6+ blocks `$env` access in workflows by default.

**Error**: `"access to env vars denied"` / `N8N_BLOCK_ENV_ACCESS_IN_NODE`

**Solution**: Add to docker-compose.yml environment section:
```yaml
environment:
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
  - API_KEY
  - WHATSAPP_API_KEY
```

Note: Environment variables must be explicitly listed in docker-compose to be passed to the container.

### 2. Workflow Import Version History Issues

**Problem**: Importing workflows can fail with `"Active version not found for workflow"` error, or workflows run old code despite updated `nodes` in database.

**Cause**: n8n 2.x uses `workflow_history` table for version tracking. The `activeVersionId` must reference a valid entry in `workflow_history`, not just any version string.

**Solution** (Full version sync):
```sql
-- Create workflow_history entry from current nodes
DO $$
DECLARE
  new_version_id UUID := gen_random_uuid();
  workflow_nodes JSON;
  workflow_connections JSON;
BEGIN
  SELECT nodes, connections INTO workflow_nodes, workflow_connections
  FROM workflow_entity WHERE id = 'YOUR_WORKFLOW_ID';

  INSERT INTO workflow_history ("versionId", "workflowId", authors, "createdAt", "updatedAt", nodes, connections, name, autosaved)
  VALUES (new_version_id::text, 'YOUR_WORKFLOW_ID', 'manual', NOW(), NOW(), workflow_nodes, workflow_connections, 'Workflow Name', false);

  UPDATE workflow_entity
  SET "versionId" = new_version_id::text, "activeVersionId" = new_version_id::text
  WHERE id = 'YOUR_WORKFLOW_ID';

  RAISE NOTICE 'Created new version: %', new_version_id;
END $$;
```

Then restart n8n: `docker compose restart n8n`

**Key insight**: `activeVersionId` is a foreign key to `workflow_history`. You cannot just set it to any string - it must reference an existing history entry.

### 3. Workflow Deployment via CLI

**Export workflow**:
```bash
docker exec n8n n8n export:workflow --id=WORKFLOW_ID --pretty
```

**Import workflow**:
```bash
# Copy file into container first
docker cp workflow.json n8n:/tmp/workflow.json
docker exec n8n n8n import:workflow --input=/tmp/workflow.json
```

**Activate via database** (when CLI doesn't work):
```bash
docker compose exec -T postgres psql -U n8n -d n8n -c \
  "UPDATE workflow_entity SET active = true WHERE id = 'WORKFLOW_ID';"
docker compose restart n8n
```

### 4. Workflow JSON Requirements for Import

When preparing workflow JSON for import:

1. **Set correct `id`** - Must match existing workflow ID to update (not create new)
2. **Set correct `versionId`** - Get current versionId from production to avoid version conflicts
3. **Clear `pinData`** - Expressions like `$env.API_KEY` don't work in pinData

### 5. Internal Docker URLs

Use internal Docker network URLs for container-to-container communication:

| Service | Internal URL |
|---------|--------------|
| n8n | `http://n8n:5678/webhook/...` |
| wwebjs-api | `http://wwebjs-api:3000/client/...` |
| whatsapp-service | `http://whatsapp-service:3001/service/...` |

### 6. Useful PostgreSQL Queries

**Check recent executions**:
```sql
SELECT id, status, "startedAt", "workflowId"
FROM execution_entity
ORDER BY "startedAt" DESC LIMIT 10;
```

**Get execution error details**:
```sql
SELECT data FROM execution_data WHERE "executionId" = ID;
```

**List all workflows**:
```sql
SELECT id, name, active, "versionId", "activeVersionId"
FROM workflow_entity;
```

### 7. Workflow IDs Reference

| Workflow | ID | Webhook Path |
|----------|-----|--------------|
| WhatsApp Send API | `CBppy9-zrrQ51xjxBgQTy` | `/webhook/wa-api` |
| WhatsApp Router | `L94Ziar3GQZLUU1V` | `/webhook/whatsapp/router` |
| WhatsApp Echo Reply | `whatsapp-debug` | `/webhook/whatsapp/webhook` |
| Testing Trigger | `5hyhJ1ublFP7Ze6SAnV21` | (custom node webhook) |

### 8. Testing Workflows

**Test WhatsApp Send API**:
```bash
cd /var/www/flow.dater.world/n8n
source .env
curl -s -X POST "https://flow.dater.world/webhook/wa-api" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"chatId": "254722833440", "message": "Test message"}'
```

**Test with media** (via n8n workflow - uses MessageMediaFromURL):
```bash
curl -s -X POST "https://flow.dater.world/webhook/wa-api" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "chatId": "254722833440",
    "media": {
      "url": "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
      "caption": "Test image"
    }
  }'
```

**Expected response**: `{"success":true}`

### 9. Direct wwebjs-api Media Send (Working Example)

**Send media directly to wwebjs-api** (bypassing n8n):

```bash
cd /var/www/flow.dater.world/n8n
source .env
curl -s -X POST "http://localhost:3000/client/sendMessage/mysession" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WHATSAPP_API_KEY" \
  -d '{
    "chatId": "254722833440@c.us",
    "contentType": "MessageMediaFromURL",
    "content": "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
    "options": {
      "caption": "Direct API test"
    }
  }'
```

**Key fields for media messages**:
- `contentType`: Use `MessageMediaFromURL` for URL-based media
- `content`: The media URL (wwebjs-api fetches and encodes it)
- `options.caption`: Optional caption text

**Reference**: See [docs/whatsapp/02-api-reference.md](docs/whatsapp/02-api-reference.md) for complete contentType options and examples.

**Source**: [whatsapp-web.js docs](https://docs.wwebjs.dev) - `MessageMedia.fromUrl()` is the underlying method.

### 10. Debugging Strategy: PostgreSQL as Primary Interface

**Key insight**: n8n's database is the source of truth. When debugging, query PostgreSQL directly rather than relying on the UI or logs.

**Why PostgreSQL over n8n UI**:
- UI may cache old data or show stale versions
- Database reveals actual workflow configuration being executed
- Execution data contains full request/response payloads
- Version history shows what's actually active

**Essential debugging queries**:

```bash
# Connect to PostgreSQL
docker compose exec -T postgres psql -U n8n -d n8n
```

```sql
-- 1. Check what version is ACTUALLY running (not what you imported)
SELECT id, name, "versionId", "activeVersionId", active
FROM workflow_entity WHERE id = 'WORKFLOW_ID';

-- 2. Check recent execution status
SELECT id, status, "startedAt", "workflowId"
FROM execution_entity ORDER BY "startedAt" DESC LIMIT 10;

-- 3. Get execution error details (parse as JSON)
SELECT data FROM execution_data WHERE "executionId" = EXEC_ID;

-- 4. List nodes in running workflow (verify your changes took effect)
SELECT nodes FROM workflow_entity WHERE id = 'WORKFLOW_ID';

-- 5. Check workflow_history versions
SELECT "versionId", "createdAt", authors
FROM workflow_history WHERE "workflowId" = 'WORKFLOW_ID'
ORDER BY "createdAt" DESC LIMIT 5;
```

**Debugging workflow**:
1. Run test → Check execution status in `execution_entity`
2. If error, query `execution_data` for full payload
3. Verify `activeVersionId` points to correct `workflow_history` entry
4. Check `nodes` in `workflow_entity` matches expected configuration
5. If mismatch, create new `workflow_history` entry and sync versions

### 11. Quick Debugging Commands

```bash
# Check n8n logs
docker logs n8n --tail 50

# Check workflow activation
docker logs n8n --tail 20 | grep -i 'activated'

# Verify env vars in container
docker exec n8n printenv | grep API

# Test wwebjs-api directly (bypass n8n to isolate issues)
curl -s -X POST "http://localhost:3000/client/sendMessage/mysession" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WHATSAPP_API_KEY" \
  -d '{"chatId": "254722833440@c.us", "contentType": "string", "content": "Direct test"}'
```

### 12. Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow runs old code | `activeVersionId` points to old version | Create new `workflow_history` entry, sync versions |
| "Active version not found" | `activeVersionId` is NULL or invalid | Set to valid `workflow_history` entry |
| Env vars undefined | Not listed in docker-compose | Add to `environment:` section |
| "access to env vars denied" | n8n 2.x blocks by default | Set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` |
| Import succeeds but no change | Workflow not reactivated | Restart n8n after database changes |
