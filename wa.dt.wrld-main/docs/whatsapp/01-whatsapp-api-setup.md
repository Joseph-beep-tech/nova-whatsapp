# WhatsApp API Setup Guide

This guide covers setting up the WhatsApp API (wwebjs-api) for production use with webhook integration.

## Overview

The WhatsApp API uses [wwebjs-api](https://github.com/avoylenko/wwebjs-api), a REST API wrapper around whatsapp-web.js. It provides:
- Multi-session support
- Webhook notifications for all WhatsApp events
- RESTful endpoints for sending messages and media
- Swagger documentation

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WhatsApp User  │────▶│   wwebjs-api    │────▶│  Webhook Server │
│                 │◀────│   (container)   │◀────│   (n8n/custom)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Required
API_KEY=<your-secure-api-key>
BASE_WEBHOOK_URL=https://your-webhook-server.com/webhook/whatsapp

# Optional
RECOVER_SESSIONS=TRUE
SET_MESSAGES_AS_SEEN=TRUE
ENABLE_SWAGGER_ENDPOINT=TRUE

# Required for reverse proxy deployments
TRUST_PROXY=true
```

### Docker Compose

```yaml
version: '3.8'
services:
  wwebjs-api:
    image: avoylenko/wwebjs-api:latest
    container_name: wwebjs-api
    restart: unless-stopped
    volumes:
      - ./sessions:/app/sessions
    env_file:
      - .env
    environment:
      - VIRTUAL_HOST=wa.yourdomain.com
      - LETSENCRYPT_HOST=wa.yourdomain.com
    networks:
      - proxy
```

## API Reference

### Authentication

All API requests require the `x-api-key` header:
```bash
-H "x-api-key: YOUR_API_KEY"
```

### Session Management

#### Check Session Status
```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "https://wa.yourdomain.com/session/status/SESSION_ID"
```

**Response:**
```json
{"success": true, "state": "CONNECTED", "message": "session_connected"}
```

#### Start Session
```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "https://wa.yourdomain.com/session/start/SESSION_ID"
```

#### Get QR Code
```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "https://wa.yourdomain.com/session/qr/SESSION_ID"
```

### Messaging

#### Send Text Message

**Important:** Use `contentType` and `content` fields (NOT `message`).

```bash
curl -X POST "https://wa.yourdomain.com/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@c.us",
    "contentType": "string",
    "content": "Hello from API!"
  }'
```

#### Send Image
```bash
curl -X POST "https://wa.yourdomain.com/client/sendImage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@c.us",
    "url": "https://example.com/image.jpg",
    "caption": "Check this out!"
  }'
```

#### Get Contacts
```bash
curl "https://wa.yourdomain.com/client/getContacts/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY"
```

## Webhook Events

The API sends these events to `BASE_WEBHOOK_URL`:

| Event | Description |
|-------|-------------|
| `qr` | QR code generated for authentication |
| `authenticated` | Session authenticated successfully |
| `ready` | Client ready to send/receive messages |
| `message` | New message received |
| `message_create` | Message created (sent or received) |
| `disconnected` | Session disconnected |
| `auth_failure` | Authentication failed |
| `group_join` | User joined a group |
| `group_leave` | User left a group |
| `call` | Incoming call |

### Webhook Payload Structure

```json
{
  "dataType": "message_create",
  "sessionId": "mysession",
  "data": {
    "message": {
      "body": "Hello!",
      "from": "1234567890@c.us",
      "to": "0987654321@c.us",
      "fromMe": false,
      "timestamp": 1234567890,
      "type": "chat"
    }
  }
}
```

**Key Paths:**
- Message body: `data.message.body`
- Sender: `data.message.from`
- Is from bot: `data.message.fromMe`
- Event type: `dataType`

## Key Considerations

### 1. Reverse Proxy Configuration

When running behind nginx-proxy or similar:

- **Set `TRUST_PROXY=true`** in environment variables
- Ensure only ONE container has the same `VIRTUAL_HOST` to avoid load-balancing issues

### 2. Single Container Rule

Multiple containers with the same `VIRTUAL_HOST` cause nginx to load-balance between them, resulting in intermittent "Cannot POST" errors.

```bash
# Check upstream configuration
docker exec nginx-proxy cat /etc/nginx/conf.d/default.conf | grep -A15 "upstream wa.yourdomain.com"

# Stop duplicate containers if found
docker stop old_container_name
docker exec nginx-proxy nginx -s reload
```

### 3. Message Format

The API uses `contentType` and `content` fields:
```json
// CORRECT
{"chatId": "...", "contentType": "string", "content": "Hello"}

// WRONG - returns 400 Bad Request
{"chatId": "...", "message": "Hello"}
```

### 4. Chat ID Format

- Individual chats: `PHONENUMBER@c.us` (e.g., `1234567890@c.us`)
- Group chats: `GROUPID@g.us`
- Phone number should include country code without `+` prefix

### 5. Session Recovery

With `RECOVER_SESSIONS=TRUE`, sessions automatically reconnect on container restart. Session data is stored in the `./sessions` volume.

### 6. Duplicate Message Handling

The webhook may send both `message` and `message_create` events for the same message. Additionally, bot-sent messages trigger `message_create` with `fromMe: true`.

**Solution:** Filter by `dataType === "message_create" AND fromMe === false` to process only incoming messages once.

## Troubleshooting

### "Cannot POST" or 400 Errors

1. Verify `TRUST_PROXY=true` is set
2. Check for duplicate containers with same VIRTUAL_HOST
3. Verify correct message format (`contentType`/`content`)

### Session Not Connecting

1. Check container logs: `docker logs wwebjs-api --tail=50`
2. Verify session directory permissions
3. Try removing session and re-scanning QR code

### Webhook Not Receiving Events

1. Verify `BASE_WEBHOOK_URL` is accessible from the container
2. Check webhook server is running and accepting POST requests
3. Test with: `curl -X POST YOUR_WEBHOOK_URL -d '{"test": true}'`

## Server Commands Reference

```bash
# View logs
docker logs wwebjs-api --tail=50 -f

# Restart container
docker compose down && docker compose up -d

# Check session status
curl -s -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/session/status/SESSION_ID"

# Generate QR in terminal (requires jq and qrencode)
QR=$(curl -s -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/session/qr/SESSION_ID" | jq -r ".qr")
echo "$QR" | qrencode -t ANSIUTF8
```

## API Documentation

Swagger documentation is available at `/api-docs` when `ENABLE_SWAGGER_ENDPOINT=TRUE`.

## Related Documentation

- [n8n Integration Guide](../n8n/01-n8n-integration-v2.md) - Webhook handling with n8n
- [Debugging Strategies](../guides/02-debugging-strategies.md) - Debugging integrations
- [Architecture Overview](../architecture/01-architecture-overview.md) - System architecture
