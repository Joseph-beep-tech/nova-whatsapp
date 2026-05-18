# WhatsApp N8N Service API Reference

API reference for whatsapp-service - a bridging layer providing media proxy and user management for WhatsApp integrations.

## Authentication

All endpoints (except media cache serving) require the `x-api-key` header:
```bash
curl -H "x-api-key: YOUR_API_KEY" "https://wa.dater.world/service/endpoint"
```

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production (external) | `https://wa.dater.world/service` |
| Docker internal | `http://whatsapp-service:3001/service` |
| Local development | `http://localhost:3001/service` |

## Health Monitoring

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/service/health` | GET | None | Basic liveness probe |
| `/service/health/ready` | GET | None | Readiness check (upstream services) |
| `/service/health/sessions` | GET | API Key* | All WhatsApp session statuses |

*API key can be passed via header (`x-api-key`) or query string (`?apiKey=XXX`)

### Liveness Probe

Basic health check for service availability.

```bash
curl https://wa.dater.world/service/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "whatsapp-service",
  "mode": "thin-wrapper",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

### Readiness Check

Verifies upstream services (wwebjs-api and optionally n8n) are reachable.

```bash
curl https://wa.dater.world/service/health/ready
```

**Response (200 when healthy, 503 when degraded):**
```json
{
  "service": "whatsapp-service",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "wwebjs": true,
  "n8n": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `wwebjs` | boolean | wwebjs-api is reachable |
| `n8n` | boolean \| null | n8n is reachable (`null` if N8N_URL not configured) |

### Session Status

Lists all WhatsApp sessions with their connection status.

```bash
# Via header
curl -H "x-api-key: YOUR_API_KEY" https://wa.dater.world/service/health/sessions

# Via query string (useful for monitoring tools)
curl "https://wa.dater.world/service/health/sessions?apiKey=YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-28T12:00:00.000Z",
  "sessions": [
    { "sessionId": "mysession", "status": "CONNECTED", "authenticated": true }
  ],
  "total": 1,
  "connected": 1
}
```

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `N8N_URL` | (empty) | Optional n8n URL for readiness check |
| `HEALTH_CHECK_TIMEOUT` | `5000` | Timeout in ms for upstream health checks |

## Media Proxy

The media proxy bypasses the whatsapp-web.js `atob()` bug that prevents base64 media sending. It fetches external URLs, caches them locally, and serves them via an internal URL that wwebjs-api can access.

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/service/media/proxy` | POST | API Key | Proxy external URL, returns cache URL |
| `/service/media/cache/:id` | GET | **None** | Serve cached media (for wwebjs-api access) |
| `/service/media/stats` | GET | API Key | Cache statistics |

### Proxy External Media

```bash
curl -X POST "http://localhost:3001/service/media/proxy" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/image.jpg",
    "filename": "image.jpg",
    "mimetype": "image/jpeg"
  }'
```

**Response:**
```json
{
  "success": true,
  "proxyUrl": "http://localhost:3001/service/media/cache/8ef7a3f3-2ba8-4dbd-a4f2-fb023040c478",
  "expiresAt": "2026-01-27T20:48:08.172Z",
  "cacheId": "8ef7a3f3-2ba8-4dbd-a4f2-fb023040c478"
}
```

### Using with wwebjs-api

Instead of sending base64-encoded media (which fails due to the `atob()` bug), proxy the media first and use `MessageMediaFromURL`:

```bash
# 1. Proxy the external media
PROXY_RESPONSE=$(curl -s -X POST "http://whatsapp-service:3001/service/media/proxy" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/image.jpg"}')

PROXY_URL=$(echo $PROXY_RESPONSE | jq -r '.proxyUrl')

# 2. Send via wwebjs-api using the proxy URL
# IMPORTANT: content must be the URL string directly, NOT an object!
curl -X POST "http://whatsapp-api:3000/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatId\": \"1234567890@c.us\",
    \"contentType\": \"MessageMediaFromURL\",
    \"content\": \"$PROXY_URL\"
  }"
```

**Alternative: Send as base64 MessageMedia**

If `MessageMediaFromURL` fails, download and encode the media manually:

```bash
# 1. Download and base64 encode
curl -s "https://example.com/image.jpg" | base64 -w0 > /tmp/media_b64.txt

# 2. Create JSON payload file (avoids argument length limits)
B64=$(cat /tmp/media_b64.txt) && cat > /tmp/send_media.json << EOF
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "image/jpeg",
    "data": "$B64",
    "filename": "image.jpg"
  },
  "options": {
    "caption": "Your caption here"
  }
}
EOF

# 3. Send using file reference
curl -X POST "http://whatsapp-api:3000/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/send_media.json
```

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MEDIA_CACHE_DIR` | `/tmp/whatsapp-media-cache` | Cache directory |
| `MEDIA_CACHE_TTL_SECONDS` | `300` | Cache expiration (5 min) |
| `MAX_MEDIA_SIZE_BYTES` | `16777216` | Max file size (16MB) |
| `MEDIA_PROXY_BASE_URL` | (auto) | Override base URL for proxyUrl |

### Cache Statistics

```bash
curl -s "http://localhost:3001/service/media/stats" -H "x-api-key: YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalEntries": 2,
    "totalSize": 43678,
    "expiredEntries": 0
  }
}
```

## User Management

The user management API stores WhatsApp users with tags for categorization. Users are automatically registered when:
- **Incoming**: User sends a message containing "SOMO" (tags: `['SOMO', 'incoming']`)
- **Outgoing**: You send a message via wa-api-webhook (tags: `['outgoing']`)

Users are deduplicated by `chatId` - the same phone number is tracked as a single user across all interactions.

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/service/users/register` | POST | API Key | Register/update user with tags |
| `/service/users/list` | GET | API Key | List all users (optional `?tag=` filter) |
| `/service/users/tags` | GET | API Key | List all unique tags in system |
| `/service/users/:chatId` | GET | API Key | Get single user by chatId |
| `/service/users/:chatId/tags` | POST | API Key | Add tags to user |
| `/service/users/:chatId/tags` | DELETE | API Key | Remove tags from user |

### Register User

Register a new user or update an existing one. Tags are added without duplicates.

```bash
curl -X POST "http://localhost:3001/service/users/register" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "name": "John Doe",
    "pushname": "John",
    "tags": ["SOMO", "VIP"]
  }'
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "phoneNumber": "254722833440",
    "name": "John Doe",
    "pushname": "John",
    "tags": ["SOMO", "VIP"],
    "firstContactAt": "2026-01-28T10:00:00.000Z",
    "lastContactAt": "2026-01-28T15:30:00.000Z",
    "messageCount": 5
  }
}
```

**Edge Cases:**

| Error | Status | Response |
|-------|--------|----------|
| Missing chatId | 400 | `{ "success": false, "error": "chatId is required" }` |
| Invalid chatId format | 400 | `{ "success": false, "error": "Invalid chatId format (must contain @, e.g., 254722833440@c.us)" }` |
| Missing API key | 403 | `{ "success": false, "error": "Invalid or missing API key" }` |

### List Users

Get all users, optionally filtered by tag.

```bash
# All users
curl "http://localhost:3001/service/users/list" \
  -H "x-api-key: YOUR_API_KEY"

# Filter by tag
curl "http://localhost:3001/service/users/list?tag=SOMO" \
  -H "x-api-key: YOUR_API_KEY"
```

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "chatId": "254722833440@c.us",
      "phoneNumber": "254722833440",
      "name": "John Doe",
      "pushname": "John",
      "tags": ["SOMO", "incoming", "VIP"],
      "firstContactAt": "2026-01-28T10:00:00.000Z",
      "lastContactAt": "2026-01-28T15:30:00.000Z",
      "messageCount": 5
    }
  ],
  "total": 1,
  "filteredByTag": "SOMO"
}
```

### Get All Tags

List all unique tags across all users.

```bash
curl "http://localhost:3001/service/users/tags" \
  -H "x-api-key: YOUR_API_KEY"
```

**Response (200):**
```json
{
  "success": true,
  "tags": ["SOMO", "VIP", "incoming", "outgoing"],
  "total": 4
}
```

### Get Single User

```bash
curl "http://localhost:3001/service/users/254722833440@c.us" \
  -H "x-api-key: YOUR_API_KEY"
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "phoneNumber": "254722833440",
    "tags": ["SOMO", "VIP"],
    "firstContactAt": "2026-01-28T10:00:00.000Z",
    "lastContactAt": "2026-01-28T15:30:00.000Z",
    "messageCount": 5
  }
}
```

**Edge Cases:**

| Error | Status | Response |
|-------|--------|----------|
| User not found | 404 | `{ "success": false, "error": "User not found" }` |

### Add Tags to User

Add one or more tags to an existing user. Duplicates are ignored.

```bash
curl -X POST "http://localhost:3001/service/users/254722833440@c.us/tags" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["Lead", "Premium"]}'
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "tags": ["SOMO", "VIP", "Lead", "Premium"],
    "..."
  },
  "addedTags": ["Lead", "Premium"]
}
```

**Edge Cases:**

| Error | Status | Response |
|-------|--------|----------|
| User not found | 404 | `{ "success": false, "error": "User not found" }` |
| Empty tags array | 400 | `{ "success": false, "error": "tags array is required and must not be empty" }` |
| Whitespace-only tags | 400 | `{ "success": false, "error": "tags array must contain at least one non-empty tag" }` |

### Remove Tags from User

Remove one or more tags from an existing user.

```bash
curl -X DELETE "http://localhost:3001/service/users/254722833440@c.us/tags" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["VIP"]}'
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "tags": ["SOMO", "Lead", "Premium"],
    "..."
  },
  "removedTags": ["VIP"]
}
```

## Phone Number Normalization

All webhook actions automatically normalize phone numbers to WhatsApp format. You can pass phone numbers in any common format.

### Supported Input Formats

| Input | Output |
|-------|--------|
| `+254722833440` | `254722833440@c.us` |
| `254722833440` | `254722833440@c.us` |
| `+254 722 833 440` | `254722833440@c.us` |
| `254-722-833-440` | `254722833440@c.us` |
| `(254) 722833440` | `254722833440@c.us` |
| `254722833440@c.us` | `254722833440@c.us` (unchanged) |

### Usage in Webhook Actions

The `to`, `chatId`, and `contactId` fields accept any format:

```json
{
  "action": "send_message",
  "data": {
    "to": "+254 722 833 440",
    "message": "Hello!"
  }
}
```

### Multiple Recipients

For group operations, pass comma-separated or array of phone numbers:

```json
{
  "action": "add_participants",
  "data": {
    "groupId": "120363000000000000",
    "participants": "+254722833440, 254705914467"
  }
}
```

Or as array:
```json
{
  "data": {
    "participants": ["+254722833440", "254705914467"]
  }
}
```

### Validation

- Personal chats: 7-15 digits (phone numbers)
- Group IDs: 7-25 digits
- Invalid characters or lengths return an error

---

## nginx-proxy Configuration

The service uses a single path prefix for nginx-proxy routing:

```yaml
# docker-compose.prod.yml
services:
  whatsapp-service:
    environment:
      - VIRTUAL_HOST=wa.dater.world
      - VIRTUAL_PATH=/service
      - VIRTUAL_PORT=3001
    networks:
      - proxy
```

**Production URLs:**
```bash
# External (via nginx-proxy)
https://wa.dater.world/service/health
https://wa.dater.world/service/users/register
https://wa.dater.world/service/users/list?tag=SOMO
https://wa.dater.world/service/media/proxy

# Internal (Docker network)
http://whatsapp-service:3001/service/users/register
http://whatsapp-service:3001/service/media/proxy
```

## Related Documentation

- [WhatsApp API Setup](01-whatsapp-api-setup.md) - wwebjs-api configuration
- [WhatsApp API Reference](02-api-reference.md) - wwebjs-api endpoints
- [n8n Integration](../n8n/01-n8n-integration-v2.md) - Webhook handling with n8n
