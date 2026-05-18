# n8n Integration Guide

**Last Updated**: November 2024
**Status**: ✅ Updated for thin wrapper architecture

---

## Overview

This guide covers the integration between n8n workflows and the WhatsApp automation platform using the new thin wrapper architecture.

### Architecture Summary

```
n8n Workflows (your-n8n.example.com)
         ↓
whatsapp-service:3001 (Thin Wrapper)
         ↓
whatsapp-api:3000 (WhatsApp Session Manager)
         ↓
WhatsApp Web
```

**Key Components**:
- **whatsapp-api**: Core service managing WhatsApp sessions via whatsapp-web.js
- **whatsapp-service**: Thin wrapper translating n8n actions to whatsapp-api REST calls
- **n8n**: Workflow automation platform

---

## Current n8n Setup

### Server Configuration
- **Location**: `your-server` server at `/usr/share/github.com/kulemantu/compose-platforms/n8n/`
- **URL**: https://your-n8n.example.com
- **Port**: 5678 (internal Docker)
- **Database**: PostgreSQL 16
- **Status**: Running and healthy

### Docker Network
```yaml
networks:
  n8n_default:
    external: true
  whatsapp-network:
    driver: bridge
```

**Note**: n8n and whatsapp services can communicate via Docker networks if needed, but HTTP-based integration is recommended.

---

## WhatsApp n8n Service Integration

### Webhook Endpoint

**Primary endpoint** for n8n to send actions to WhatsApp:

```
POST https://your-wa.example.com/webhook
Headers:
  x-api-key: <API_KEY>
  Content-Type: application/json

Body:
{
  "action": "send_message",
  "data": {
    "to": "1234567890",
    "message": "Hello from n8n!"
  }
}
```

### Multi-Session Support

For multi-session deployments:

```
POST https://your-wa.example.com/session/{sessionId}/webhook
Headers:
  x-api-key: <API_KEY>
  Content-Type: application/json

Body:
{
  "action": "send_message",
  "data": {
    "to": "1234567890",
    "message": "Hello from specific session!"
  }
}
```

---

## Supported Actions

### Message Operations

#### Send Text Message
```json
{
  "action": "send_message",
  "data": {
    "to": "1234567890",
    "message": "Your text here"
  }
}
```

#### Send Media
```json
{
  "action": "send_media",
  "data": {
    "to": "1234567890",
    "media": {
      "url": "https://example.com/image.jpg",
      "caption": "Optional caption"
    }
  }
}
```

#### Send Location
```json
{
  "action": "send_location",
  "data": {
    "to": "1234567890",
    "location": {
      "latitude": -6.2,
      "longitude": 106.8,
      "description": "Jakarta"
    }
  }
}
```

#### Send Contact
```json
{
  "action": "send_contact",
  "data": {
    "to": "1234567890",
    "contactId": "9876543210"
  }
}
```

#### Reply to Message
```json
{
  "action": "reply_message",
  "data": {
    "chatId": "1234567890@c.us",
    "messageId": "message-id-here",
    "content": "Reply text"
  }
}
```

#### React to Message
```json
{
  "action": "react_message",
  "data": {
    "chatId": "1234567890@c.us",
    "messageId": "message-id-here",
    "reaction": "👍"
  }
}
```

#### Forward Message
```json
{
  "action": "forward_message",
  "data": {
    "chatId": "1234567890@c.us",
    "messageId": "message-id-here",
    "toChat": "9876543210@c.us"
  }
}
```

### Group Operations

#### Get Groups
```json
{
  "action": "get_groups",
  "data": {}
}
```

#### Create Group
```json
{
  "action": "create_group",
  "data": {
    "name": "My Group",
    "participants": "1234567890,9876543210"
  }
}
```

#### Add Participants
```json
{
  "action": "add_participants",
  "data": {
    "groupId": "group-id@g.us",
    "participants": "1234567890,9876543210"
  }
}
```

#### Remove Participants
```json
{
  "action": "remove_participants",
  "data": {
    "groupId": "group-id@g.us",
    "participants": "1234567890"
  }
}
```

#### Promote to Admin
```json
{
  "action": "promote_to_admin",
  "data": {
    "groupId": "group-id@g.us",
    "participants": "1234567890"
  }
}
```

#### Demote from Admin
```json
{
  "action": "demote_from_admin",
  "data": {
    "groupId": "group-id@g.us",
    "participants": "1234567890"
  }
}
```

#### Update Group Info
```json
{
  "action": "update_group_info",
  "data": {
    "groupId": "group-id@g.us",
    "name": "New Group Name"
  }
}
```

#### Leave Group
```json
{
  "action": "leave_group",
  "data": {
    "groupId": "group-id@g.us"
  }
}
```

#### Get Invite Code
```json
{
  "action": "get_invite_code",
  "data": {
    "groupId": "group-id@g.us"
  }
}
```

### Contact Operations

#### Get Contact
```json
{
  "action": "get_contact",
  "data": {
    "contactId": "1234567890"
  }
}
```

#### Block Contact
```json
{
  "action": "block_contact",
  "data": {
    "contactId": "1234567890"
  }
}
```

#### Unblock Contact
```json
{
  "action": "unblock_contact",
  "data": {
    "contactId": "1234567890"
  }
}
```

#### Get Profile Picture
```json
{
  "action": "get_profile_picture",
  "data": {
    "contactId": "1234567890"
  }
}
```

### Poll Operations

#### Create Poll
```json
{
  "action": "create_poll",
  "data": {
    "to": "1234567890",
    "question": "Cats or Dogs?",
    "options": ["Cats", "Dogs"],
    "multipleSelection": false
  }
}
```

### Session Operations

#### Get Session Info
```json
{
  "action": "get_session_info",
  "data": {}
}
```

#### Reset Session
```json
{
  "action": "reset_session",
  "data": {}
}
```

---

## Receiving Events from WhatsApp (Triggers)

### Webhook Registration

n8n trigger nodes can register to receive WhatsApp events:

```
POST https://your-wa.example.com/webhook/register/default
Headers:
  x-api-key: <API_KEY>
  Content-Type: application/json

Body:
{
  "webhookUrl": "https://your-n8n.example.com/webhook/whatsapp-trigger",
  "events": ["message", "group_join", "group_leave", "status_change"]
}
```

### Event Types

- `message` - New incoming message
- `qr` - QR code ready for scanning
- `status_change` - Session connection status changed
- `group_join` - User joined group
- `group_leave` - User left group
- `message_reaction` - Message reaction added

### Event Payload Format

```json
{
  "dataType": "message",
  "data": {
    "from": "1234567890@c.us",
    "body": "Message text",
    "timestamp": 1234567890,
    "isGroup": false
  },
  "sessionId": "default"
}
```

---

## Example n8n Workflows

### Simple Auto-Reply Bot

```json
{
  "nodes": [
    {
      "name": "WhatsApp Trigger",
      "type": "WhatsAppBotTrigger",
      "credentials": {
        "whatsappBotApi": "WhatsApp Bot Credentials"
      }
    },
    {
      "name": "Send Reply",
      "type": "WhatsAppBot",
      "parameters": {
        "resource": "message",
        "operation": "sendText",
        "to": "={{ $json.from }}",
        "message": "Thanks for your message!"
      }
    }
  ]
}
```

### Group Admin Bot

```json
{
  "nodes": [
    {
      "name": "Trigger on Join",
      "type": "WhatsAppBotTrigger",
      "parameters": {
        "events": ["group_join"]
      }
    },
    {
      "name": "Send Welcome",
      "type": "WhatsAppBot",
      "parameters": {
        "resource": "message",
        "operation": "sendText",
        "to": "={{ $json.data.groupId }}",
        "message": "Welcome ={{ $json.data.userName }}!"
      }
    }
  ]
}
```

---

## Authentication

### API Key Setup

1. **Set API_KEY** in whatsapp-service environment
2. **Include in n8n node credentials**:
   ```
   Server URL: https://your-wa.example.com
   API Token: <your-api-key>
   ```

### Testing Authentication

```bash
curl -X POST https://your-wa.example.com/webhook \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_session_info", "data": {}}'
```

---

## Phone Number Format

The webhook dispatcher automatically formats phone numbers:

- **Input**: `1234567890` or `1234567890@c.us`
- **Output**: `1234567890@c.us` (individual) or `group-id@g.us` (group)

**No manual formatting needed** in n8n workflows!

---

## Error Handling

### Common Errors

```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

**Solutions**:
- Verify API_KEY is correct
- Check x-api-key header is present
- Ensure HTTPS is used in production

```json
{
  "success": false,
  "error": "Unknown action: invalid_action"
}
```

**Solutions**:
- Check action name spelling
- Verify action is in supported list (23 operations)

```json
{
  "success": false,
  "error": "WhatsApp API Error [404]: Session not found"
}
```

**Solutions**:
- Verify sessionId exists
- Start session via whatsapp-api
- Check session status at /admin/sessions

---

## Admin Monitoring

### Session Monitoring

Access the admin UI:
```
https://your-wa.example.com/admin
Username: admin
Password: <WHATSAPP_SERVICE_ADMIN_PASSWORD>
```

**Features**:
- Real-time session status
- Connection indicators
- QR code access for pending sessions
- Auto-refresh every 10 seconds

### Logs

View system logs:
```
https://your-wa.example.com/admin/logs
```

**Features**:
- Filter by log level
- Auto-scroll option
- Clear logs functionality

---

## Best Practices

### 1. Use Specific Actions

Instead of generic `send_message`, use specific actions:
- ✅ `send_media` for images/videos
- ✅ `send_location` for coordinates
- ✅ `reply_message` for threading
- ❌ `send_message` for everything

### 2. Handle Errors Gracefully

```javascript
// In n8n Function node
if (!$input.json.success) {
  $error('WhatsApp API error: ' + $input.json.error);
  return [];
}
return [$input.json.data];
```

### 3. Use Multi-Session for Scale

```javascript
// Route different workflows to different sessions
const sessionId = $input.json.customerId % 5; // 5 sessions
$http.post(`/session/${sessionId}/webhook`, {
  action: 'send_message',
  data: { ... }
});
```

### 4. Register Webhooks Properly

```javascript
// Register once when workflow activates
await $http.post('/webhook/register/default', {
  webhookUrl: 'https://your-n8n.example.com/webhook/my-trigger',
  events: ['message', 'status_change']
});

// Unregister when workflow deactivates
await $http.post('/webhook/unregister/default', {
  webhookUrl: 'https://your-n8n.example.com/webhook/my-trigger'
});
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md) for common issues and solutions.

### Quick Checks

1. **Is whatsapp-api healthy?**
   ```bash
   curl http://localhost:3000/ping
   ```

2. **Is whatsapp-service healthy?**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Is session authenticated?**
   - Check https://your-wa.example.com/admin/sessions
   - Look for "connected" status

4. **Are webhooks registered?**
   ```bash
   curl -H "x-api-key: key" http://localhost:3001/webhook/list/default
   ```

---

## Related Documentation

- [N8N_COMPATIBILITY_FIXES.md](N8N_COMPATIBILITY_FIXES.md) - Required fixes for full compatibility
- [N8N_NODE_DEVELOPMENT.md](N8N_NODE_DEVELOPMENT.md) - Developing custom n8n nodes
- [FINAL_ARCHITECTURE_SUMMARY.md](../architecture/FINAL_ARCHITECTURE_SUMMARY.md) - Complete architecture overview

---

## Migration from Old Architecture

If migrating from pre-refactor setup:

1. **Update webhook URLs**:
   - Old: Various custom endpoints
   - New: Single `/webhook` endpoint with actions

2. **Update action format**:
   - Old: Direct REST calls to whatsapp-api
   - New: Unified webhook format with `{action, data}`

3. **Update credentials**:
   - Remove: `QR_AUTH_USERNAME`, `QR_AUTH_PASSWORD`
   - Add: `WHATSAPP_SERVICE_ADMIN_USER`, `WHATSAPP_SERVICE_ADMIN_PASSWORD`

4. **Test all workflows**:
   - Verify 23 operations work correctly
   - Check trigger nodes receive events
   - Monitor admin UI for session status
