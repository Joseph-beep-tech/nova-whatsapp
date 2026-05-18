# Debugging Strategies

Proven debugging strategies for WhatsApp API and n8n workflow integrations.

## General Principles

### 1. Isolate Variables

Test each component independently before testing the integration:
- Test API directly before testing through n8n
- Verify network connectivity from the container, not the host
- Check data at each step in the pipeline

### 2. Staged Testing

Progress through these stages:
1. **webhook.site** - Debug data extraction and payload structure
2. **Direct API call** - Verify the target API works with expected data
3. **n8n workflow** - Test the complete integration

### 3. Verify Assumptions

Never assume syntax or configuration works:
- Test expressions with simple values first
- Check actual data structure, not documented structure
- Verify network paths from the actual container

## n8n Workflow Debugging

### Check Workflow Activation

```bash
docker logs n8n | grep "Activated"
```

### View Recent Executions

```bash
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT id, \"workflowId\", status, \"stoppedAt\"
   FROM execution_entity
   ORDER BY \"startedAt\" DESC LIMIT 10;"
```

### View Execution Data

```bash
# Get execution details (replace EXECUTION_ID)
docker exec n8n_postgres psql -U n8n -d n8n -t -c \
  "SELECT data FROM execution_data WHERE \"executionId\" = 'EXECUTION_ID';"
```

### Check Webhook Registrations

```bash
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT * FROM webhook_entity;"
```

### Test Webhook Endpoint

```bash
curl -X POST "https://your-n8n.com/webhook/path" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Docker Network Debugging

### Test Container-to-Container Connectivity

```bash
# From n8n container to WhatsApp API
docker exec n8n wget -q -O- --timeout=5 \
  "http://wwebjs-api:3000/session/status/SESSION_ID" \
  --header="x-api-key: YOUR_API_KEY"
```

### Check Container Networks

```bash
# List networks for a container
docker inspect CONTAINER_NAME | jq '.[0].NetworkSettings.Networks'

# Check which containers share a network
docker network inspect NETWORK_NAME
```

### Verify DNS Resolution

```bash
docker exec CONTAINER_NAME nslookup TARGET_CONTAINER
```

## Data Extraction Debugging

### Use webhook.site for Payload Inspection

1. Create a free endpoint at https://webhook.site
2. Point your workflow to send data there
3. Inspect the actual payload structure

### Debug n8n Expressions

Add a Code node to log data:
```javascript
console.log(JSON.stringify($input.first().json, null, 2));
return $input.all();
```

### Check Expression Depth

n8n 2.x Set node limitation - test with increasing depth:
```javascript
// Level 1 - works
$json.body

// Level 2 - works
$json.body.dataType

// Level 3+ - may fail
$json.body.data.message  // Use Code node instead
```

## WhatsApp API Debugging

### Check Session Status

```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "https://wa.yourdomain.com/session/status/SESSION_ID"
```

### View Container Logs

```bash
docker logs wwebjs-api --tail=50 -f
```

### Test Message Sending

```bash
curl -X POST "https://wa.yourdomain.com/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "1234567890@c.us", "contentType": "string", "content": "Test"}'
```

## Database Debugging (n8n)

### View Workflow Definition

```bash
docker exec n8n_postgres psql -U n8n -d n8n -t -c \
  "SELECT nodes::text FROM workflow_entity WHERE id = 'WORKFLOW_ID';" \
  | python3 -m json.tool
```

### Check Workflow Version Sync

```bash
# Verify activeVersionId matches workflow_history
docker exec n8n_postgres psql -U n8n -d n8n -c \
  "SELECT we.id, we.\"activeVersionId\", wh.\"versionId\"
   FROM workflow_entity we
   LEFT JOIN workflow_history wh ON we.\"activeVersionId\" = wh.\"versionId\"
   WHERE we.id = 'WORKFLOW_ID';"
```

## Common Time Sinks to Avoid

| Issue | Symptom | Solution |
|-------|---------|----------|
| Expression depth limit | Data returns null | Use Code node for nested paths |
| Workflow not updating | Changes ignored after DB update | INSERT workflow_history FIRST |
| HTTP timeout | 130s timeout error | Use internal Docker URLs |
| Duplicate messages | Multiple responses | Filter by `fromMe === false` |
| Webhook not receiving | 404 or no execution | Check activation, verify URL path |

## Debugging Checklist

### n8n Workflow Issues
- [ ] Workflow is activated (`docker logs n8n | grep Activated`)
- [ ] Webhook URL is correct and accessible
- [ ] Expression paths match actual data structure
- [ ] Using Code node for deeply nested data
- [ ] workflow_history is in sync with workflow_entity

### Network Issues
- [ ] Containers share the same Docker network
- [ ] Using internal URLs between containers
- [ ] TRUST_PROXY=true for reverse proxy setups
- [ ] Only one container per VIRTUAL_HOST

### Data Issues
- [ ] Verified payload structure with webhook.site
- [ ] Checked n8n 2.x body location (`$json.body.*`)
- [ ] Tested API directly before n8n integration
- [ ] Confirmed correct field names (`contentType`/`content` not `message`)

## Tools Reference

| Tool | Purpose |
|------|---------|
| webhook.site | Inspect incoming webhook payloads |
| jq | Parse JSON in command line |
| docker exec | Run commands in containers |
| psql | Query n8n PostgreSQL database |
| curl/wget | Test HTTP endpoints |

## Related Documentation

- [n8n Integration v2](../n8n/01-n8n-integration-v2.md) - n8n 2.x specifics
- [WhatsApp API Setup](../whatsapp/01-whatsapp-api-setup.md) - API configuration
- [Troubleshooting](01-troubleshooting.md) - Common issues and solutions
