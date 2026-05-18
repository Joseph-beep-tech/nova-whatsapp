# WhatsApp API Developer Guide

Send WhatsApp messages and manage contacts programmatically.

## Quick Reference

| Service | Base URL | Purpose |
|---------|----------|---------|
| **Messaging API** | `https://flow.dater.world/webhook/wa-api` | Send messages, images, documents |
| **Service API** | `https://wa.dater.world/service` | User management, media proxy, webhooks |

---

## Authentication

All API requests require an API key in the header:

```
x-api-key: YOUR_API_KEY
```

---

# Messaging API

**Base URL:** `https://flow.dater.world/webhook/wa-api`

## Send Text Message

```bash
curl -X POST https://flow.dater.world/webhook/wa-api \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "message": "Hello from the API!"
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `chatId` | Yes | Recipient phone with `@c.us` suffix |
| `message` | Yes | Text content to send |
| `sessionId` | No | WhatsApp session (default: `mysession`) |

## Send Image

```bash
curl -X POST https://flow.dater.world/webhook/wa-api \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://example.com/photo.jpg",
      "caption": "Check this out!"
    }
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `media.url` | Yes | Direct URL to image (jpg, png, gif, webp) |
| `media.caption` | No | Text below the image |

## Send Document

```bash
curl -X POST https://flow.dater.world/webhook/wa-api \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://example.com/report.pdf",
      "filename": "Monthly Report.pdf"
    }
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `media.url` | Yes | Direct URL to file |
| `media.filename` | No | Display name (recommended for PDFs) |
| `media.mimetype` | No | MIME type if auto-detection fails |

## Chat ID Format

Phone numbers must include country code and end with `@c.us`:

| Raw Number | Formatted Chat ID |
|------------|-------------------|
| `254722833440` | `254722833440@c.us` |
| `+254722833440` | `254722833440@c.us` |
| `0722833440` | `254722833440@c.us` (add country code) |

## Response Format

**Success:**
```json
{
  "success": true
}
```

**Error:**
```json
{
  "success": false,
  "error": "Chat not found"
}
```

---

# Service API

**Base URL:** `https://wa.dater.world/service`

## Health Check

```bash
curl https://wa.dater.world/service/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "whatsapp-service",
  "mode": "thin-wrapper",
  "timestamp": "2026-01-28T14:46:43.748Z"
}
```

---

## User Management

Manage contacts with tags for targeted messaging (e.g., broadcast lists).

### Register User

Add a new user or update existing user with tags.

```bash
curl -X POST https://wa.dater.world/service/users/register \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "name": "John Doe",
    "tags": ["SOMO", "VIP"]
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `chatId` | Yes | Phone with `@c.us` suffix |
| `name` | No | Display name |
| `pushname` | No | WhatsApp profile name |
| `tags` | No | Array of tag strings |

**Response:**
```json
{
  "success": true,
  "user": {
    "chatId": "254722833440@c.us",
    "phoneNumber": "254722833440",
    "name": "John Doe",
    "tags": ["SOMO", "VIP"],
    "firstContactAt": "2026-01-28T14:38:15.375Z",
    "lastContactAt": "2026-01-28T14:38:15.375Z",
    "messageCount": 1
  }
}
```

### List Users

Get all users or filter by tag.

```bash
# All users
curl -H "x-api-key: YOUR_API_KEY" \
  https://wa.dater.world/service/users/list

# Filter by tag
curl -H "x-api-key: YOUR_API_KEY" \
  "https://wa.dater.world/service/users/list?tag=SOMO"
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "chatId": "254722833440@c.us",
      "phoneNumber": "254722833440",
      "tags": ["SOMO"],
      "messageCount": 2
    }
  ],
  "total": 1,
  "filteredByTag": "SOMO"
}
```

### Get Single User

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://wa.dater.world/service/users/254722833440@c.us
```

### List All Tags

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://wa.dater.world/service/users/tags
```

**Response:**
```json
{
  "success": true,
  "tags": ["SOMO", "VIP", "NEWSLETTER"],
  "total": 3
}
```

### Add Tags to User

```bash
curl -X POST https://wa.dater.world/service/users/254722833440@c.us/tags \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["PREMIUM"]}'
```

### Remove Tags from User

```bash
curl -X DELETE https://wa.dater.world/service/users/254722833440@c.us/tags \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["SOMO"]}'
```

---

## Media Proxy

Use the media proxy when direct URLs fail (common with large files or base64 media).

### Step 1: Proxy the Media

```bash
curl -X POST https://wa.dater.world/service/media/proxy \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/large-image.jpg"}'
```

**Response:**
```json
{
  "success": true,
  "proxyUrl": "https://wa.dater.world/service/media/cache/abc-123-def",
  "expiresAt": "2026-01-28T15:05:00.000Z",
  "cacheId": "abc-123-def"
}
```

### Step 2: Send Using Proxy URL

```bash
curl -X POST https://flow.dater.world/webhook/wa-api \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://wa.dater.world/service/media/cache/abc-123-def"
    }
  }'
```

### When to Use Media Proxy

| Scenario | Direct URL | Media Proxy |
|----------|------------|-------------|
| Public CDN images | Try first | If fails |
| Large files (>5MB) | May fail | Recommended |
| Base64-encoded media | Broken | Required |
| Private/authenticated URLs | Won't work | Required |

**Note:** Proxied media expires after 5 minutes. Send immediately after proxying.

### Media Cache Stats

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://wa.dater.world/service/media/stats
```

---

## Webhook Registration

Register webhooks to receive WhatsApp events (messages, QR codes, status changes).

### Register Webhook

```bash
curl -X POST https://wa.dater.world/service/webhook/register/mysession \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://your-server.com/webhook",
    "events": ["message", "qr", "status_change"]
  }'
```

| Event | Description |
|-------|-------------|
| `message` | Incoming WhatsApp messages |
| `qr` | QR code for authentication |
| `status_change` | Session status updates |
| `group_join` | User joined group |
| `group_leave` | User left group |

### List Webhooks

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://wa.dater.world/service/webhook/list/mysession
```

### Unregister Webhook

```bash
curl -X POST https://wa.dater.world/service/webhook/unregister/mysession \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://your-server.com/webhook"}'
```

---

# Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Unauthorized` | Missing/invalid API key | Check `x-api-key` header |
| `Chat not found` | Invalid phone number | Verify number has WhatsApp |
| `Media URL invalid` | URL not accessible | Use direct URLs or media proxy |
| `Invalid chatId format` | Missing `@c.us` suffix | Format: `254722833440@c.us` |

---

# Examples

## Broadcast to Tag Group

Send a message to all users with a specific tag:

```bash
# 1. Get all users with the SOMO tag
users=$(curl -s -H "x-api-key: YOUR_API_KEY" \
  "https://wa.dater.world/service/users/list?tag=SOMO")

# 2. Extract chatIds and send messages
echo "$users" | jq -r '.users[].chatId' | while read chatId; do
  curl -X POST https://flow.dater.world/webhook/wa-api \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"chatId\": \"$chatId\", \"message\": \"Hello from SOMO broadcast!\"}"
done
```

## Send Image with Caption

```bash
curl -X POST https://flow.dater.world/webhook/wa-api \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://picsum.photos/800/600",
      "caption": "Beautiful random image from Picsum!"
    }
  }'
```

## Register User on First Contact

```bash
curl -X POST https://wa.dater.world/service/users/register \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "254722833440@c.us",
    "pushname": "John",
    "tags": ["NEW_USER", "2026-01"]
  }'
```

---

# API Endpoints Summary

## Messaging API (`flow.dater.world`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/wa-api` | Send message (text, image, document) |

## Service API (`wa.dater.world/service`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/users/register` | Register/update user |
| GET | `/users/list` | List users (optional `?tag=`) |
| GET | `/users/tags` | List all tags |
| GET | `/users/:chatId` | Get single user |
| POST | `/users/:chatId/tags` | Add tags |
| DELETE | `/users/:chatId/tags` | Remove tags |
| POST | `/media/proxy` | Proxy external media |
| GET | `/media/cache/:id` | Serve cached media |
| GET | `/media/stats` | Cache statistics |
| POST | `/webhook/register/:sessionId` | Register webhook |
| POST | `/webhook/unregister/:sessionId` | Unregister webhook |
| GET | `/webhook/list/:sessionId` | List webhooks |

---

# Testing in n8n (For Admins)

## Using Pinned Data

The workflow includes pinned test data for testing without live requests:

1. Open the workflow in n8n
2. Click the **Webhook** node
3. Look for the pin icon
4. Click **Test Workflow** - uses pinned data instead of waiting for requests

## Test Payloads

**Text message:**
```json
{
  "headers": { "x-api-key": "YOUR_API_KEY" },
  "body": {
    "chatId": "254722833440@c.us",
    "message": "Test message"
  }
}
```

**Image:**
```json
{
  "headers": { "x-api-key": "YOUR_API_KEY" },
  "body": {
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://picsum.photos/200",
      "caption": "Test image"
    }
  }
}
```

**Document:**
```json
{
  "headers": { "x-api-key": "YOUR_API_KEY" },
  "body": {
    "chatId": "254722833440@c.us",
    "media": {
      "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      "filename": "test.pdf"
    }
  }
}
```
