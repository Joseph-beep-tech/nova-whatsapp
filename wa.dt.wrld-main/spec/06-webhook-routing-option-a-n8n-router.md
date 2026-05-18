# Option A: n8n Router Workflow

Multi-target webhook routing using n8n's built-in workflow orchestration.

## Overview

Use a single "master" webhook that receives all events from wwebjs-api and fans out to multiple workflows using n8n's "Execute Workflow" node.

```
wwebjs-api → /webhook/whatsapp/router (Router Workflow)
                    │
            ┌───────┴───────┐
            ▼               ▼
    Execute Workflow   Execute Workflow
         nodes              nodes
            │               │
    ┌───────┴───────┐       │
    ▼       ▼       ▼       ▼
  Echo    Bot    Analytics  Ack
Workflow Trigger Workflow  Tracker
```

## Design Principles

1. **Single entry point** - One webhook URL receives all events from wwebjs-api
2. **Data normalization** - Extract and flatten common fields once
3. **Conditional fanout** - Route to workflows based on event type, filters
4. **Async execution** - Use "Execute Workflow" in "Don't wait" mode for parallel processing

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WhatsApp Router Workflow                         │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌─────────────────────────────┐   │
│  │ Webhook  │───▶│   Code   │───▶│         Switch              │   │
│  │ Trigger  │    │ (Extract)│    │    (by dataType)            │   │
│  └──────────┘    └──────────┘    └─────────────────────────────┘   │
│                                      │         │         │         │
│                                      ▼         ▼         ▼         │
│                                  message   message_ack  ready      │
│                                      │         │         │         │
│                                      ▼         ▼         ▼         │
│                                 ┌────────┐ ┌────────┐ ┌────────┐   │
│                                 │Execute │ │Execute │ │Execute │   │
│                                 │Workflow│ │Workflow│ │Workflow│   │
│                                 │(Echo)  │ │(Ack)   │ │(Status)│   │
│                                 └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create the Router Workflow

1. Open n8n at https://flow.dater.world
2. Create new workflow named: **"WhatsApp Router"**
3. Add **Webhook** node with settings:
   - HTTP Method: `POST`
   - Path: `whatsapp/router`
   - Authentication: Header Auth
   - Header Name: `x-api-key`
   - Header Value: `={{$env.WHATSAPP_API_KEY}}`

### Step 2: Add Data Extraction Code Node

Add a **Code** node connected to the Webhook trigger:

```javascript
// Code node: Extract & Normalize
const body = $input.first().json.body || $input.first().json;
const data = body.data || {};
const message = data.message || {};

return [{
  json: {
    // Routing fields
    dataType: body.dataType,
    sessionId: body.sessionId,

    // Message fields (flattened)
    messageId: message.id?._serialized || message.id,
    from: message.from,
    to: message.to,
    body: message.body,
    fromMe: message.fromMe,
    hasMedia: message.hasMedia,
    type: message.type,
    timestamp: message.timestamp,

    // Group detection
    isGroup: (message.from || '').endsWith('@g.us'),

    // Original payload (for workflows that need full data)
    _raw: body
  }
}];
```

### Step 3: Add Switch Node for Routing

Add a **Switch** node connected to the Code node:

- Mode: Rules
- Field to match: `{{ $json.dataType }}`
- Rules:

| Output | Condition | Value | Description |
|--------|-----------|-------|-------------|
| 0 | equals | `message` | Message events |
| 1 | equals | `message_ack` | Delivery/read receipts |
| 2 | equals | `ready` | Session connected |
| 3 | equals | `disconnected` | Session disconnected |
| Fallback | - | - | Unknown events |

### Step 4: Add Message Filtering (Before Execute Workflow)

For the `message` output (Output 0), add an **IF** node:

**Condition: Process this message?**
```
AND:
  - {{ $json.fromMe }} equals false
  - {{ $json.isGroup }} equals false
```

This filters out:
- Messages sent by the bot itself (prevents loops)
- Group messages (unless you want them)

### Step 5: Add Execute Workflow Nodes

For each target workflow, add an **Execute Workflow** node:

| Node Name | Target Workflow | Connected To | Settings |
|-----------|-----------------|--------------|----------|
| Execute Echo Bot | Echo Reply Workflow | IF (true branch) | Don't wait |
| Execute Bot Trigger | WhatsApp Bot Trigger Workflow | IF (true branch) | Don't wait |
| Execute Ack Handler | Message Ack Workflow | Switch Output 1 | Don't wait |
| Execute Status Handler | Session Status Workflow | Switch Output 2, 3 | Don't wait |

**Critical Settings for Execute Workflow nodes:**
- Source: **Database**
- Workflow: (select target workflow by name)
- Mode: **"Don't wait for sub-workflow to finish"** ← Enables async parallel execution
- Pass input data: **Yes**

### Step 6: Modify Target Workflows

Each target workflow needs to accept data from Execute Workflow:

**Option A: Replace Webhook with Execute Workflow Trigger**
1. Remove the Webhook trigger node from target workflow
2. Add **"Execute Workflow Trigger"** node as the new trigger
3. This node receives data passed from the router

**Option B: Keep Webhooks (HTTP Request approach)**
1. Keep original Webhook trigger in target workflow
2. In router, use **HTTP Request** node instead of Execute Workflow
3. More overhead but preserves original workflows unchanged

### Step 7: Update wwebjs-api BASE_WEBHOOK_URL

```bash
# SSH to server
ssh root@no.flow

# Update .env to point to router workflow
sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router|' \
  /var/www/wa.dater.world/whatsapp-api/.env

# Recreate container (restart doesn't reload .env)
cd /var/www/wa.dater.world/whatsapp-api
docker compose down && docker compose up -d

# Reconnect to n8n network
docker network connect n8n_default wwebjs-api
```

### Step 8: Activate and Test

1. **Activate** the Router workflow
2. **Activate** all target workflows
3. Send a WhatsApp message to the bot number
4. Check execution logs:
   - Router workflow should show successful execution
   - Target workflows should show triggered executions

## Complete Router Workflow Structure

```
Webhook Trigger (whatsapp/router)
     │
     ▼
Code (Extract & Normalize)
     │
     ▼
Switch (by dataType)
     │
     ├──▶ [message] ──▶ IF (not fromMe AND not group)
     │                       │
     │                       ├──▶ [true] ──▶ Execute Echo Workflow
     │                       │           └──▶ Execute Bot Trigger Workflow
     │                       │
     │                       └──▶ [false] ──▶ (discard or log)
     │
     ├──▶ [message_ack] ──▶ Execute Ack Handler Workflow
     │
     ├──▶ [ready] ──▶ Execute Status Handler Workflow
     │
     ├──▶ [disconnected] ──▶ Execute Status Handler Workflow
     │
     └──▶ [fallback] ──▶ (log to debug workflow or discard)
```

## Adding New Target Workflows

To add a new workflow as a routing target:

1. Create the new workflow with **Execute Workflow Trigger** as trigger
2. Open the Router workflow
3. Add new **Execute Workflow** node connected to appropriate Switch output
4. Configure to call the new workflow
5. Save and ensure both workflows are active

## Verification Checklist

- [ ] Router workflow is active
- [ ] All target workflows are active
- [ ] `BASE_WEBHOOK_URL` points to `/webhook/whatsapp/router`
- [ ] wwebjs-api container is connected to `n8n_default` network
- [ ] Send test message → Router execution shows in logs
- [ ] Target workflow executions appear

## Troubleshooting

### Router workflow not triggering
```bash
# Check BASE_WEBHOOK_URL
docker exec wwebjs-api printenv | grep WEBHOOK

# Check network connectivity
docker exec wwebjs-api curl -s http://n8n:5678/webhook/whatsapp/router -X POST \
  -H "Content-Type: application/json" \
  -d '{"dataType":"test"}'
```

### Target workflow not receiving data
- Verify Execute Workflow node has "Pass input data" enabled
- Check target workflow has Execute Workflow Trigger (not Webhook)
- Ensure target workflow is active

### Performance issues
- Enable "Don't wait for sub-workflow to finish" on all Execute Workflow nodes
- Consider reducing filtering complexity in IF nodes
- Check n8n resource limits

## Pros and Cons

| Aspect | Assessment |
|--------|------------|
| **Setup time** | ~30 minutes |
| **Code changes** | None (n8n UI only) |
| **Maintenance** | Low - visual workflow editor |
| **Flexibility** | Medium - limited to n8n node capabilities |
| **Performance** | Sequential unless using "Don't wait" mode |
| **Debugging** | Good - n8n execution logs for each step |
| **Scalability** | Limited by n8n execution capacity |

---

## Quick Start: Pre-Built Router Workflow

A ready-to-import router workflow is available at:

```
n8n-workflows/whatsapp-router.json
```

### Import Steps

1. Open n8n at https://flow.dater.world
2. Go to **Workflows** → **Import from File**
3. Select `n8n-workflows/whatsapp-router.json`
4. **Configure target URLs** in the HTTP Request nodes:
   - "Forward to Echo Workflow": Update URL to match your echo workflow's webhook path
   - "Forward to WhatsApp Bot Trigger": Update URL to match your trigger workflow's webhook path
5. Activate the workflow
6. Update wwebjs-api `BASE_WEBHOOK_URL` to point to `/webhook/whatsapp/router`

### Workflow Features

The pre-built router includes:

| Node | Purpose |
|------|---------|
| **Router Webhook** | Receives events at `/webhook/whatsapp/router` |
| **Extract Routing Data** | Normalizes payload and extracts routing metadata |
| **Forward to Echo Workflow** | HTTP Request to echo workflow (parallel) |
| **Forward to WhatsApp Bot Trigger** | HTTP Request to custom trigger (parallel) |
| **Aggregate Results** | Collects results from all forwards |

### HTTP Request vs Execute Workflow

This pre-built router uses **HTTP Request nodes** instead of Execute Workflow nodes because:

1. **No target modification required** - Existing workflows keep their Webhook triggers
2. **Path flexibility** - Can target any webhook URL, including custom trigger paths
3. **Parallel execution** - Multiple HTTP requests execute simultaneously
4. **Error isolation** - `continueOnFail: true` ensures one failure doesn't stop others

### Customization

To add a new target workflow:

1. Duplicate one of the "Forward to..." HTTP Request nodes
2. Update the URL to point to your new workflow's webhook path
3. Connect it to the "Extract Routing Data" node output
4. Connect its output to the "Aggregate Results" node
5. Update the "Aggregate Results" code to include the new target name
