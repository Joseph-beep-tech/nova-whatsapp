# Production Fix: Welcome Message Routing and Media Format

**Date:** January 29, 2026
**Severity:** Medium (Welcome messages not sending)
**Status:** Fixed

## Summary

Two issues prevented welcome messages from being sent when users sent "SOMO" to the WhatsApp bot:

1. **n8n workflow used wrong JSON paths** - Registration request referenced non-existent `$json.routing.*` paths
2. **MediaFromURL content format was incorrect** - Used object `{ url: "..." }` instead of URL string

## Issue 1: n8n Workflow JSON Paths

### Problem

The "Register SOMO User" node in the Router workflow was using incorrect JSON paths:

```javascript
// WRONG - these paths don't exist in the data structure
JSON.stringify({
  chatId: $json.routing.from,        // ❌ Should be $json.from
  pushname: $json.routing.pushname,  // ❌ Should be $json.pushname
  tags: ['SOMO', 'incoming'],
  sessionId: $json.routing.sessionId // ❌ Should be $json.sessionId
})
```

### Root Cause

The Extract & Route code node outputs data at the TOP LEVEL of `$json`, not under `$json.routing`:

```javascript
// What Extract & Route actually outputs:
return [{
  json: {
    // TOP LEVEL - these are the correct paths
    sessionId: body.sessionId || 'default',
    from: message.from || null,
    pushname: message._data?.notifyName || message.notifyName || null,

    // routing contains only flags, not the data
    routing: {
      isIncomingMessage,
      containsSOMO,
      isGroup: ...,
      dataType,
      timestamp: ...
    },
    originalPayload: body
  }
}];
```

### Fix Applied

Updated the workflow node jsonBody via direct SQL update in PostgreSQL:

```javascript
// CORRECT paths
JSON.stringify({
  chatId: $json.from,
  pushname: $json.pushname,
  tags: ['SOMO', 'incoming'],
  sessionId: $json.sessionId
})
```

**Method:** SQL update + n8n restart:
```sql
UPDATE workflow_entity
SET nodes = REPLACE(
  nodes::text,
  'tags: [''SOMO'', ''incoming''] })',
  'tags: [''SOMO'', ''incoming''], sessionId: $json.sessionId })'
)::jsonb
WHERE id = 'L94Ziar3GQZLUU1V';
```

## Issue 2: MessageMediaFromURL Content Format

### Problem

Welcome messages with media were failing with "WhatsApp API Error [500]: Invalid URL".

### Root Cause

For `MessageMediaFromURL`, the wwebjs-api expects `content` to be a plain URL string, NOT an object:

| Format | Works? |
|--------|--------|
| `content: "https://example.com/image.png"` | Yes |
| `content: { url: "https://example.com/image.png" }` | No - "Invalid URL" |

### Fix Applied

Updated SOMO welcome message configuration:

```bash
curl -X POST http://localhost:3001/service/welcome-messages/SOMO \
  -d '{
    "messages": [
      { "contentType": "string", "content": "Welcome to SOMO Africa!" },
      {
        "contentType": "MessageMediaFromURL",
        "content": "https://shop.somoafrica.org/img/logo/min/logo_small.png",
        "options": { "caption": "Visit us at shop.somoafrica.org" }
      }
    ],
    "enabled": true
  }'
```

## Verification

### Test: Direct API Registration
```bash
curl -X POST http://localhost:3001/service/users/register \
  -d '{"chatId": "254722833440@c.us", "tags": ["SOMO"], "sessionId": "mysession"}'
```

### Result
```json
{
  "success": true,
  "welcomeResult": {
    "sentWelcomes": [{ "tag": "SOMO", "messageCount": 2 }],
    "errors": []
  }
}
```

Both text and image messages sent successfully.

## Files Modified

| File | Change |
|------|--------|
| n8n-workflows/whatsapp-router.json (git) | Fixed JSON paths in local copy |
| n8n PostgreSQL workflow_entity (production) | Direct SQL update to fix paths |
| MongoDB config collection (production) | Updated SOMO welcome message format |

## Lessons Learned

1. **Always verify JSON data structure** - n8n expressions like `$json.routing.from` vs `$json.from` matter
2. **MessageMediaFromURL expects URL string** - Not all content types use object format
3. **Test welcome messages with sessionId** - Without sessionId, welcome service can't send messages
4. **n8n workflow import has constraints** - Sometimes direct SQL updates are needed when CLI import fails

## Related

- [IMPLEMENTATION_SESSION.md](../../../IMPLEMENTATION_SESSION.md) - Full implementation details
- [whatsapp-router.json](../../../n8n-workflows/whatsapp-router.json) - Router workflow
- [welcomeService.ts](../../../packages/whatsapp-service/src/services/welcomeService.ts) - Welcome service
