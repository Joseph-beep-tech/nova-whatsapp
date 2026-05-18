# WhatsApp API Reference

Complete endpoint reference for wwebjs-api (kulemantu/wwebjs-api fork of avoylenko/wwebjs-api).

## Authentication

All endpoints require the `x-api-key` header:
```bash
curl -H "x-api-key: YOUR_API_KEY" "https://wa.yourdomain.com/endpoint"
```

## Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/session/start/{sessionId}` | GET | Start a new session |
| `/session/status/{sessionId}` | GET | Get session status |
| `/session/qr/{sessionId}` | GET | Get QR code for authentication |
| `/session/restart/{sessionId}` | GET | Restart session |
| `/session/terminate/{sessionId}` | GET | Terminate session |
| `/session/terminateInactive` | GET | Terminate all inactive sessions |
| `/session/terminateAll` | GET | Terminate all sessions |
| `/session/getSessions` | GET | List all active sessions |
| `/session/stop/{sessionId}` | GET | Stop session (alternative to terminate) |
| `/session/requestPairingCode/{sessionId}` | POST | Request pairing code (alternative to QR) |
| `/session/getPageScreenshot/{sessionId}` | GET | Get screenshot for debugging |

## Client Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/client/sendMessage/{sessionId}` | POST | Send message (text/media/location/poll) |
| `/client/getChats/{sessionId}` | GET | Get all chats |
| `/client/getContacts/{sessionId}` | GET | Get all contacts |
| `/client/getContactById/{sessionId}` | POST | Get contact by ID |
| `/client/createGroup/{sessionId}` | POST | Create group |
| `/client/deleteProfilePicture/{sessionId}` | POST | Delete profile picture |
| `/client/setAutoDownloadAudio/{sessionId}` | POST | Configure auto-download |
| `/client/setAutoDownloadDocuments/{sessionId}` | POST | Configure auto-download |
| `/client/setAutoDownloadPhotos/{sessionId}` | POST | Configure auto-download |
| `/client/setAutoDownloadVideos/{sessionId}` | POST | Configure auto-download |
| `/client/syncHistory/{sessionId}` | POST | Sync chat history |
| `/client/getContactDeviceCount/{sessionId}` | POST | Get device count |
| `/client/resetState/{sessionId}` | POST | Reset client state |
| `/client/setBackgroundSync/{sessionId}` | POST | Configure background sync |
| `/client/getContactLidAndPhone/{sessionId}` | POST | Get contact LID |
| `/client/runMethod/{sessionId}` | POST | Execute arbitrary client method |

## Contact Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/contact/block/{sessionId}` | POST | Block contact |
| `/contact/unblock/{sessionId}` | POST | Unblock contact |
| `/contact/getProfilePicUrl/{sessionId}` | POST | Get profile picture URL |

## Group Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/groupChat/addParticipants/{sessionId}` | POST | Add participants to group |
| `/groupChat/removeParticipants/{sessionId}` | POST | Remove participants from group |
| `/groupChat/promoteParticipants/{sessionId}` | POST | Promote to admin |
| `/groupChat/demoteParticipants/{sessionId}` | POST | Demote from admin |
| `/groupChat/getInviteCode/{sessionId}` | POST | Get group invite code |
| `/groupChat/setSubject/{sessionId}` | POST | Set group name |
| `/groupChat/setDescription/{sessionId}` | POST | Set group description |
| `/groupChat/leave/{sessionId}` | POST | Leave group |

## Message Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/message/reply/{sessionId}` | POST | Reply to message |
| `/message/react/{sessionId}` | POST | React to message |
| `/message/forward/{sessionId}` | POST | Forward message |
| `/message/downloadMedia/{sessionId}` | POST | Download media from message |
| `/message/edit/{sessionId}` | POST | Edit sent message |

## WhatsApp Channels

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/client/getChannelByInviteCode/{sessionId}` | POST | Get channel info by invite code |
| `/client/getChannels/{sessionId}` | GET | List subscribed channels |
| `/client/createChannel/{sessionId}` | POST | Create new channel |
| `/client/subscribeToChannel/{sessionId}` | POST | Subscribe to channel |
| `/client/unsubscribeFromChannel/{sessionId}` | POST | Unsubscribe from channel |
| `/client/searchChannels/{sessionId}` | POST | Search channels |

## Webhook Events

wwebjs-api sends webhook callbacks to your configured `BASE_WEBHOOK_URL` when events occur.

### Event Types (dataType)

| Event | Description | Payload Contains |
|-------|-------------|------------------|
| `message` | Message received or sent | Full message object |
| `message_ack` | Delivery status changed | Message ID, ack status |
| `message_revoke_everyone` | Message deleted for all | Original message |
| `message_revoke_me` | Message deleted for sender | Original message |
| `group_join` | User joined group | Group/user info |
| `group_leave` | User left group | Group/user info |
| `ready` | Session connected | Session ID |
| `disconnected` | Session disconnected | Session ID, reason |

> **⚠️ Important:** wwebjs-api sends `dataType: "message"`, NOT `"message_create"`. The whatsapp-web.js library internally uses `message_create` as the event name, but wwebjs-api normalizes this to `message` in the webhook payload. Always verify actual payloads when debugging.

### Webhook Payload Structure

```json
{
  "dataType": "message",
  "sessionId": "mysession",
  "data": {
    "message": {
      "from": "254722833440@c.us",
      "to": "254748085137@c.us",
      "body": "Hello",
      "fromMe": false,
      "type": "chat",
      "timestamp": 1768596046
    }
  }
}
```

### Configuration

```bash
# .env for wwebjs-api
BASE_WEBHOOK_URL=http://your-webhook-receiver:port/webhook/path
ENABLE_WEBHOOK=TRUE

# Optional: Disable noisy events
DISABLED_CALLBACKS=message_ack|message_reaction|unread_count|message_edit
```

### Network Configuration

The `BASE_WEBHOOK_URL` environment variable determines where wwebjs-api sends event callbacks.

**Same host (Docker containers on shared network):**
```bash
BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp
```
Use container names when services share a Docker network (e.g., via proxy network or compose network).

**Different hosts:**
```bash
BASE_WEBHOOK_URL=https://flow.yourdomain.com/webhook/whatsapp
```
Use routable URLs when services run on separate hosts. Ensure wwebjs-api can resolve and reach the external domain.

**Debugging connectivity:**
```bash
# From inside the wwebjs-api container
docker exec wwebjs-api curl -I http://n8n:5678/healthz
docker exec wwebjs-api curl -I https://flow.yourdomain.com/healthz
```

## Optional Features

### WebSocket Support

Real-time events via WebSocket connection:

```bash
# Enable in environment
ENABLE_WEBSOCKET=true

# Connect to WebSocket
ws://wa.yourdomain.com/ws/{sessionId}
```

### Pairing Code Authentication

Alternative to QR code scanning (useful for headless setups):

```bash
curl -X POST "https://wa.yourdomain.com/session/requestPairingCode/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "1234567890"}'
```

## Request/Response Examples

### Send Text Message

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

### Send Media from URL (Recommended)

Use `MessageMediaFromURL` for external media - wwebjs-api calls `MessageMedia.fromUrl()` internally to fetch and encode the media. This is simpler than base64 encoding yourself.

```bash
curl -X POST "https://wa.yourdomain.com/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@c.us",
    "contentType": "MessageMediaFromURL",
    "content": "https://example.com/image.jpg",
    "options": {
      "caption": "Image caption text"
    }
  }'
```

**Note:** The `content` field is the media URL. The `options.caption` adds text below the media.

### Send Media (Base64 Encoded)

Use `MessageMedia` when you have pre-encoded base64 data. This maps directly to the `MessageMedia` class from whatsapp-web.js.

```bash
curl -X POST "https://wa.yourdomain.com/client/sendMessage/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@c.us",
    "contentType": "MessageMedia",
    "content": {
      "mimetype": "image/jpeg",
      "data": "base64_encoded_data_here",
      "filename": "image.jpg"
    }
  }'
```

**MessageMedia content object:**
| Field | Type | Description |
|-------|------|-------------|
| `mimetype` | string | MIME type (e.g., `image/jpeg`, `video/mp4`, `audio/ogg`) |
| `data` | string | Base64-encoded file data |
| `filename` | string | Optional filename |
| `filesize` | number | Optional file size in bytes |

### React to Message

```bash
curl -X POST "https://wa.yourdomain.com/message/react/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "true_1234567890@c.us_ABCDEF",
    "reaction": "👍"
  }'
```

### Create Group

```bash
curl -X POST "https://wa.yourdomain.com/client/createGroup/SESSION_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Group",
    "participants": ["1234567890@c.us", "0987654321@c.us"]
  }'
```

## contentType Reference

The `contentType` field in `/client/sendMessage` determines how the `content` field is interpreted:

| contentType | content Type | Description |
|-------------|-------------|-------------|
| `string` | string | Plain text message |
| `MessageMedia` | object | Base64-encoded media (see Send Media section) |
| `MessageMediaFromURL` | string (URL) | Media URL - wwebjs-api fetches and encodes it |
| `Location` | object | Location message `{ latitude, longitude, description? }` |
| `Contact` | object | Contact card (vCard) |
| `Poll` | object | Poll message (deprecated on some platforms) |
| `Buttons` | object | Interactive buttons (deprecated) |
| `List` | object | Interactive list (deprecated) |

**Common options for all media types:**
| Option | Type | Description |
|--------|------|-------------|
| `options.caption` | string | Text caption displayed with media |
| `options.sendMediaAsDocument` | boolean | Send as document instead of image/video |
| `options.sendMediaAsSticker` | boolean | Send image as sticker |
| `options.sendAudioAsVoice` | boolean | Send audio as voice message |
| `options.sendVideoAsGif` | boolean | Send video as GIF |

## Chat ID Formats

| Type | Format | Example |
|------|--------|---------|
| Individual | `{phone}@c.us` | `1234567890@c.us` |
| Group | `{groupId}@g.us` | `123456789-1234567890@g.us` |
| Broadcast | `{broadcastId}@broadcast` | `status@broadcast` |

**Note:** Phone numbers include country code without `+` prefix.

## Troubleshooting

### sendMessage Returns 500 Error

**Error:** `Cannot read properties of undefined (reading 'markedUnread')`

**Cause:** This is an upstream whatsapp-web.js bug (GitHub issue #5718) caused by WhatsApp Web interface changes. The library's `sendSeen` function tries to access a property that no longer exists.

**Fix (Applied in kulemantu fork):**
The kulemantu/wwebjs-api fork includes a workaround that passes `{ sendSeen: false }` to all sendMessage calls, bypassing the broken function.

If building from source, ensure you're using the fork with this fix:
```bash
git remote set-url origin https://github.com/kulemantu/wwebjs-api.git
```

**Verify fix is in container:**
```bash
docker exec wwebjs-api grep -A2 'sendSeen' /usr/src/app/src/controllers/clientController.js
# Should show: sendSeen: false
```

### "No LID for user" Error

**Cause:** WhatsApp's LID (Local ID) migration system. Contacts that haven't been messaged before may not have an Account LID assigned.

**Workaround:** Send messages only to contacts with existing chat history. This is a whatsapp-web.js library limitation being tracked in GitHub issue #3834.

### Container Uses Old Code After Deploy

**Symptoms:** Fix was pushed to repo but container still shows errors.

**Cause:** docker-compose.yml uses `image:` directive (pulls from Docker Hub) instead of `build:` (builds from local code).

**Fix:** Change docker-compose.yml:
```yaml
# FROM (pulls pre-built image):
image: avoylenko/wwebjs-api:latest

# TO (builds from local code):
build: .
```

Then rebuild:
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Related Documentation

- [WhatsApp API Setup](01-whatsapp-api-setup.md) - Configuration and setup
- [Service API Reference](03-service-api-reference.md) - whatsapp-service (media proxy, user management)
- [n8n Integration](../n8n/01-n8n-integration-v2.md) - Webhook handling with n8n
- [wwebjs-api GitHub (upstream)](https://github.com/avoylenko/wwebjs-api) - Original source repository
- [wwebjs-api GitHub (fork)](https://github.com/kulemantu/wwebjs-api) - Fork with bug fixes