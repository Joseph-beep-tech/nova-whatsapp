# Incident Report: WhatsApp Router Feedback Loop

**Date:** January 21, 2026
**Severity:** High (200+ duplicate messages sent)
**Status:** Fixed
**Task:** 041-20260121-router-feedback-loop-fix

## Summary

The WhatsApp Router workflow created an infinite feedback loop that sent approximately 200+ duplicate "Used Fanout Flow" messages to a user's WhatsApp number (254722833440). The workflow was manually deactivated to stop the loop.

## Timeline

1. Router workflow was deployed and activated
2. Test message sent to bot from user's phone
3. Router received `message_create` event and forwarded to downstream workflows
4. Downstream workflow (WhatsApp Bot Trigger) sent reply message "Used Fanout Flow"
5. **wwebjs-api fired another `message_create` event for the bot's outgoing message**
6. Router received this event (with `fromMe: true`)
7. Router forwarded to downstream workflows again
8. Downstream sent another reply
9. Steps 5-8 repeated infinitely until manually stopped

## Root Cause

### The Core Problem

**WhatsApp's `message_create` event fires for BOTH incoming AND outgoing messages.**

When the bot sends a message:
```json
{
  "dataType": "message_create",
  "data": {
    "message": {
      "fromMe": true,      // <-- This indicates the bot sent this message
      "from": "254748085137@c.us",  // Bot's number
      "to": "254722833440@c.us",    // User's number
      "body": "Used Fanout Flow"
    }
  }
}
```

The `fromMe: true` field distinguishes bot-sent messages from user-sent messages. **The Router workflow did not filter on this field.**

### The Defective Code

The original "Extract Routing Data" Code node passed ALL events through without filtering:

```javascript
// ORIGINAL CODE (defective)
const input = $input.first();
const webhookData = input.json;
const body = webhookData.body || webhookData;

// Extract routing metadata
const data = body.data || {};
const message = data.message || {};

// ❌ MISSING: No check for fromMe === true
// ❌ Every event gets forwarded, including bot's own messages

return [{
  json: {
    originalPayload: body,
    routing: {
      dataType: body.dataType || 'unknown',
      // ...
    }
  }
}];
```

### The Feedback Loop Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  User sends "Hello"                                                         │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ wwebjs-api  │ ─── message_create (fromMe: false)  ───┐                   │
│  └─────────────┘                                        │                   │
│         ▲                                               ▼                   │
│         │                                    ┌──────────────────┐           │
│         │                                    │  Router Workflow │           │
│         │                                    │  (no fromMe      │           │
│         │                                    │   filter)        │           │
│         │                                    └────────┬─────────┘           │
│         │                                             │                     │
│         │                                    forwards to targets            │
│         │                                             │                     │
│         │                                             ▼                     │
│         │                                    ┌──────────────────┐           │
│         │                                    │ Bot Trigger      │           │
│         │                                    │ Workflow         │           │
│         │                                    └────────┬─────────┘           │
│         │                                             │                     │
│         │                                    sends "Used Fanout Flow"       │
│         │                                             │                     │
│         │                                             ▼                     │
│  ┌─────────────┐                             ┌──────────────────┐           │
│  │ wwebjs-api  │ ◄────── sendMessage ────────│ WhatsApp Bot     │           │
│  └─────────────┘                             │ Node             │           │
│         │                                    └──────────────────┘           │
│         │                                                                   │
│         │ message_create (fromMe: true)  ◄── PROBLEM: This event goes       │
│         │                                     back to Router!               │
│         │                                                                   │
│         └───────────────────────────────────────────────────────────────────┘
│                                         ▲                                   │
│                                         │                                   │
│                                     INFINITE                                │
│                                       LOOP                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Fix

### Layer 1: fromMe Filter (Primary Protection)

Add an early return when processing bot's own messages:

```javascript
// FIXED CODE
const fromMe = message.fromMe || false;

// Filter out messages from the bot itself to prevent feedback loops
if (body.dataType === 'message_create' && fromMe) {
  return []; // Stop processing - this is our own outgoing message
}
```

This prevents ANY processing of messages the bot sends.

### Layer 2: Deduplication (Safety Net)

Even with the fromMe filter, add deduplication as defense-in-depth:

```javascript
// Use workflow static data to track recent messages
const staticData = $getWorkflowStaticData('global');
if (!staticData.recentMessages) {
  staticData.recentMessages = {};
}

const messageKey = chatId + ':' + messageContent.slice(0, 50);
const cooldownMs = 60000; // 60 seconds

if (staticData.recentMessages[messageKey]) {
  const lastProcessed = staticData.recentMessages[messageKey];
  if (Date.now() - lastProcessed < cooldownMs) {
    return []; // Skip - duplicate within cooldown window
  }
}
```

This prevents the same message content from being processed twice within 60 seconds, protecting against other edge cases.

## Impact

- **Messages sent:** ~200+ duplicate "Used Fanout Flow" messages
- **Duration:** Several minutes until manual intervention
- **User affected:** 254722833440
- **Risk:** WhatsApp could have flagged the number for spam behavior

## Prevention Measures

1. **Always filter `fromMe: true`** in any webhook-triggered workflow that sends messages
2. **Add deduplication** as defense-in-depth
3. **Test carefully** when activating workflows that both receive AND send messages
4. **Have emergency deactivation ready:**
   ```bash
   ssh root@no.flow "docker exec n8n_postgres psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = false WHERE name = 'YOUR_WORKFLOW_NAME';\""
   ```

## Lessons Learned

1. **WhatsApp events are bidirectional** - `message_create` fires for sent AND received messages
2. **The `fromMe` field is critical** - must be checked in any routing logic
3. **Fanout patterns need extra care** - when routing to multiple targets, the risk of loops multiplies
4. **n8n workflow static data** - useful for maintaining state across executions (deduplication, rate limiting)

## Related Files

- [tasks.json](../../../tasks.json) - Task 041
- [whatsapp-router.json](../../../n8n-workflows/whatsapp-router.json) - Router workflow (to be updated)
- [WORKING_SESSION_NO_COMMIT.md](../../../WORKING_SESSION_NO_COMMIT.md) - Section 22
