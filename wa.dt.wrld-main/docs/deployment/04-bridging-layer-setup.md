# Bridging Layer Setup Guide

This document explains how to configure `whatsapp-service` as the bridging layer between `wwebjs-api` (WhatsApp Web sessions) and `n8n` (workflow automation).

## Architecture Overview

```
WhatsApp → wwebjs-api → whatsapp-service → n8n workflows
                ↓                 ↑
            (events)         (webhooks)
```

The bridging layer provides:
1. **Event forwarding**: WhatsApp events from wwebjs-api are forwarded to n8n workflows
2. **Action dispatch**: n8n HTTP Request nodes call the service to send messages, media, etc.
3. **Webhook management**: Register/unregister n8n trigger webhooks per session

---

## Prerequisites

Before configuring the bridging layer, ensure:

- [ ] `whatsapp-service` is deployed and healthy (`docker compose ps` shows healthy)
- [ ] Service can reach `wwebjs-api` (`docker exec whatsapp-service wget -qO- http://wwebjs-api:3000/ping`)
- [ ] API keys match between services

---

## Step 1: Configure wwebjs-api to Send Events

Update the wwebjs-api `.env` file to point `BASE_WEBHOOK_URL` to the bridging service:

```bash
cd /var/www/wa.dater.world/whatsapp-api

# Backup current .env
cp .env .env.backup

# Update BASE_WEBHOOK_URL
sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://whatsapp-service:3001/events|' .env

# Verify the change
grep BASE_WEBHOOK_URL .env
# Should show: BASE_WEBHOOK_URL=http://whatsapp-service:3001/events

# Restart wwebjs-api to apply
docker compose restart
```

After this change, wwebjs-api will send all WhatsApp events to the bridging service's `/events` endpoint.

---

## Step 2: Configure n8n Workflows

### Option A: Using HTTP Request Node (Direct API Calls)

For n8n workflows that need to send messages or perform actions:

1. Add an **HTTP Request** node to your workflow
2. Configure the node:
   - **Method**: POST
   - **URL**: `http://whatsapp-service:3001/webhook`
   - **Authentication**: Header Auth
     - **Name**: `X-API-Key`
     - **Value**: `{{ $credentials.whatsappApiKey }}` (or hardcode the key)
   - **Body**: JSON
     ```json
     {
       "action": "send_message",
       "sessionId": "default",
       "data": {
         "chatId": "{{ $json.from }}",
         "message": "Hello from n8n!"
       }
     }
     ```

### Option B: Using n8n Trigger Node (Receive Events)

To receive WhatsApp events in n8n:

1. Create a **Webhook** node in n8n
2. Set the webhook URL (e.g., `https://flow.dater.world/webhook/whatsapp-events`)
3. Register the webhook with the bridging service:

```bash
curl -X POST http://localhost:3001/webhook/register/default \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "webhookUrl": "http://n8n:5678/webhook/whatsapp-events",
    "events": ["message", "qr", "status_change"]
  }'
```

**Note**: Use internal Docker URLs (`http://n8n:5678/...`) for container-to-container communication.

---

## Step 3: Test the Integration

### Test Event Flow (wwebjs-api → bridging → n8n)

1. Send a WhatsApp message to your connected number
2. Check the bridging service logs:
   ```bash
   docker logs -f whatsapp-service
   ```
3. Verify the event is received and forwarded to n8n

### Test Action Dispatch (n8n → bridging → wwebjs-api)

1. Create a simple n8n workflow with:
   - Manual trigger
   - HTTP Request node to `/webhook` with `send_message` action
2. Execute the workflow
3. Verify the message is sent via WhatsApp

---

## Available Actions

The bridging service supports these actions via `/webhook`:

| Action | Description | Required Data |
|--------|-------------|---------------|
| `send_message` | Send text message | `chatId`, `message` |
| `send_media` | Send image/video/document | `chatId`, `mediaUrl`, `caption` |
| `send_location` | Send location | `chatId`, `latitude`, `longitude` |
| `send_contact` | Send contact card | `chatId`, `contact` |
| `send_poll` | Send poll | `chatId`, `pollName`, `pollOptions` |
| `react_message` | React to message | `messageId`, `reaction` |
| `forward_message` | Forward message | `messageId`, `chatId` |
| `create_group` | Create WhatsApp group | `name`, `participants` |
| `add_participants` | Add users to group | `groupId`, `participants` |
| `remove_participants` | Remove users from group | `groupId`, `participants` |

See [API Reference](../whatsapp/02-api-reference.md) for complete action documentation.

---

## Webhook Registration API

### Register Webhook

```bash
POST /webhook/register/:sessionId
Content-Type: application/json
X-API-Key: YOUR_API_KEY

{
  "webhookUrl": "http://n8n:5678/webhook/your-trigger",
  "events": ["message", "qr", "status_change", "group_join", "group_leave"]
}
```

### Unregister Webhook

```bash
POST /webhook/unregister/:sessionId
Content-Type: application/json
X-API-Key: YOUR_API_KEY

{
  "webhookUrl": "http://n8n:5678/webhook/your-trigger"
}
```

### List Registered Webhooks

```bash
GET /webhook/list/:sessionId
X-API-Key: YOUR_API_KEY
```

---

## Troubleshooting

### Events Not Reaching n8n

1. **Check wwebjs-api logs**:
   ```bash
   docker logs wwebjs-api 2>&1 | grep -i webhook
   ```

2. **Verify BASE_WEBHOOK_URL**:
   ```bash
   docker exec wwebjs-api env | grep BASE_WEBHOOK_URL
   ```

3. **Check network connectivity**:
   ```bash
   docker exec wwebjs-api wget -qO- http://whatsapp-service:3001/health
   ```

### Actions Not Working

1. **Check API key**:
   ```bash
   curl -X POST http://localhost:3001/webhook \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_KEY" \
     -d '{"action":"send_message","data":{"chatId":"test","message":"test"}}'
   ```

2. **Verify wwebjs-api connectivity**:
   ```bash
   docker exec whatsapp-service wget -qO- http://wwebjs-api:3000/ping
   ```

### Webhook Registration Fails

1. **Check MongoDB connection**:
   ```bash
   docker logs whatsapp-service | grep -i mongo
   ```

2. **Verify webhook was stored**:
   ```bash
   curl http://localhost:3001/webhook/list/default -H "X-API-Key: YOUR_KEY"
   ```

---

## Security Considerations

1. **Use internal Docker URLs**: Always use `http://container-name:port` for inter-container communication, not external URLs.

2. **API Key Security**: Keep the API key secure and use the same key across all services.

3. **Network Isolation**: The bridging service is on multiple networks:
   - `proxy`: For nginx-proxy access
   - `default`: For MongoDB
   - `wwebjs-api_default`: For wwebjs-api communication

4. **Rate Limiting**: The service has built-in rate limiting (100 req/min per IP).

---

## Rollback

To revert wwebjs-api to direct n8n routing:

```bash
cd /var/www/wa.dater.world/whatsapp-api

# Restore backup
cp .env.backup .env

# Or manually set the URL
sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router|' .env

# Restart
docker compose restart
```

---

## Related Documentation

- [Deployment Plan](01-deployment-plan.md)
- [Server Changes](02-server-changes.md)
- [API Reference](../whatsapp/02-api-reference.md)
- [n8n Integration Guide](../n8n/01-n8n-integration-v2.md)
