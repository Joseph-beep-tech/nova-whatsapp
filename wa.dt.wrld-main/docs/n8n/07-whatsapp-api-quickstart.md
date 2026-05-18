# WhatsApp API Quick Start

Send messages and manage user lists via the WhatsApp API.

## Prerequisites

You need an `API_KEY` from the server admin. All examples use this header:
```
x-api-key: YOUR_API_KEY
```

## 1. Send Messages (flow.dater.world)

Base URL: `https://flow.dater.world/webhook/wa-api`

### Send Text Message

```bash
curl -X POST "https://flow.dater.world/webhook/wa-api" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "chatId": "254722833440",
    "message": "Hello from the API!"
  }'
```

### Send Image with Caption

```bash
curl -X POST "https://flow.dater.world/webhook/wa-api" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "chatId": "254722833440",
    "media": {
      "url": "https://example.com/image.jpg",
      "caption": "Check out this image!"
    }
  }'
```

### Send Video/Document

Same as image - just provide the URL. The API auto-detects the media type.

```bash
curl -X POST "https://flow.dater.world/webhook/wa-api" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "chatId": "254722833440",
    "media": {
      "url": "https://example.com/document.pdf",
      "caption": "Here is the report"
    }
  }'
```

### Request Fields

| Field | Required | Description |
|-------|----------|-------------|
| `chatId` | Yes | Phone number (country code, no `+`) |
| `message` | For text | Text message content |
| `media.url` | For media | Public URL to image/video/document |
| `media.caption` | No | Caption displayed with media |
| `sessionId` | No | WhatsApp session (default: `mysession`) |

### Response

```json
{"success": true}
```

---

## 2. User Lists (wa.dater.world)

Base URL: `https://wa.dater.world/service`

Manage users in tagged lists (e.g., "SOMO" subscribers).

### Register User to a List

```bash
curl -X POST "https://wa.dater.world/service/users/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "chatId": "254722833440@c.us",
    "tags": ["SOMO"]
  }'
```

**Note:** For user management, `chatId` requires the `@c.us` suffix.

### Get All Users in a List

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://wa.dater.world/service/users/list?tag=SOMO"
```

Response:
```json
{
  "success": true,
  "users": [
    {"chatId": "254722833440@c.us", "tags": ["SOMO"], "registeredAt": "..."},
    {"chatId": "254711222333@c.us", "tags": ["SOMO", "VIP"], "registeredAt": "..."}
  ],
  "total": 2,
  "filteredByTag": "SOMO"
}
```

### Get All Lists (Tags)

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://wa.dater.world/service/users/tags"
```

### Add Tags to Existing User

```bash
curl -X POST "https://wa.dater.world/service/users/254722833440@c.us/tags" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"tags": ["VIP", "PREMIUM"]}'
```

### Remove Tags from User

```bash
curl -X DELETE "https://wa.dater.world/service/users/254722833440@c.us/tags" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"tags": ["SOMO"]}'
```

### User Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/service/users/register` | Register user with tags |
| GET | `/service/users/list` | List all users |
| GET | `/service/users/list?tag=SOMO` | List users by tag |
| GET | `/service/users/tags` | List all unique tags |
| GET | `/service/users/:chatId` | Get single user |
| POST | `/service/users/:chatId/tags` | Add tags to user |
| DELETE | `/service/users/:chatId/tags` | Remove tags from user |

---

## Chat ID Formats

| Context | Format | Example |
|---------|--------|---------|
| Sending messages | Phone number only | `254722833440` |
| User management | With `@c.us` suffix | `254722833440@c.us` |
| Groups | With `@g.us` suffix | `123456789@g.us` |

---

## Code Examples

### Node.js/TypeScript

```typescript
const API_KEY = process.env.API_KEY;

// Send text message
async function sendText(chatId: string, message: string) {
  const response = await fetch('https://flow.dater.world/webhook/wa-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ chatId, message }),
  });
  return response.json();
}

// Send media
async function sendMedia(chatId: string, url: string, caption?: string) {
  const response = await fetch('https://flow.dater.world/webhook/wa-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ chatId, media: { url, caption } }),
  });
  return response.json();
}

// Register user to list
async function registerUser(phone: string, tags: string[]) {
  const chatId = `${phone}@c.us`;
  const response = await fetch('https://wa.dater.world/service/users/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ chatId, tags }),
  });
  return response.json();
}

// Get users by tag
async function getUsersByTag(tag: string) {
  const response = await fetch(
    `https://wa.dater.world/service/users/list?tag=${tag}`,
    { headers: { 'x-api-key': API_KEY } }
  );
  return response.json();
}
```

### Python

```python
import requests

API_KEY = "YOUR_API_KEY"

def send_text(chat_id: str, message: str):
    return requests.post(
        "https://flow.dater.world/webhook/wa-api",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={"chatId": chat_id, "message": message}
    ).json()

def send_media(chat_id: str, url: str, caption: str = None):
    return requests.post(
        "https://flow.dater.world/webhook/wa-api",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={"chatId": chat_id, "media": {"url": url, "caption": caption}}
    ).json()

def register_user(phone: str, tags: list):
    return requests.post(
        "https://wa.dater.world/service/users/register",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={"chatId": f"{phone}@c.us", "tags": tags}
    ).json()

def get_users_by_tag(tag: str):
    return requests.get(
        f"https://wa.dater.world/service/users/list?tag={tag}",
        headers={"x-api-key": API_KEY}
    ).json()
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid or missing API key | Check `x-api-key` header |
| `Invalid chatId format` | Missing `@c.us` for user endpoints | Add `@c.us` suffix |
| Media not sending | URL not publicly accessible | Use public HTTPS URL |
| Empty response | Phone number format wrong | Use country code without `+` |

---

## Related Docs

- [API Reference](../whatsapp/02-api-reference.md) - Complete endpoint documentation
- [n8n Session Notes](06-n8n-session-notes.md) - Debugging and deployment notes
- [WhatsApp Service Session](../whatsapp/04-whatsapp-service-session.md) - Service configuration
