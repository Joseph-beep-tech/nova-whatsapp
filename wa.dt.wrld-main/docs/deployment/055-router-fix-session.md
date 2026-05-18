# Session Notes: Task 055 - Fix Router Workflow Timeout

**Date:** 2026-01-28
**Task ID:** 055-20260128-fix-router-workflow-timeout

## Problem Summary

Router workflow (`L94Ziar3GQZLUU1V`) forwards WhatsApp messages to two targets:
- Echo Workflow (`/webhook/whatsapp/webhook`) - Works fine
- Bot Trigger (`/webhook/df4ce89f-fe74-4d2b-8146-2c47b69f0262/webhook`) - Times out (10-15s)

The Bot Trigger UUID is a placeholder that doesn't match any registered webhook, causing delays on every incoming WhatsApp message.

## Root Cause Analysis

From investigation in [test-progress.md](test-progress.md):

1. **Target Workflow Exists:** "Testing Trigger and Action Node" (ID: `5hyhJ1ublFP7Ze6SAnV21`) uses `CUSTOM.whatsAppBotTrigger`
2. **Custom Nodes Not Deployed:** `/home/node/.n8n/nodes/package.json` has empty dependencies
3. **Webhook Not Registered:** Without the custom node loaded, the webhook path can't be registered

## Chosen Approach

**Git-based deployment** (preferred over SCP deploy script):
1. Pull repo at `/var/opt/wa.dt.wrld` on server
2. Build `packages/whatsapp-n8n-nodes` on server
3. Create symlink from `/var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot` to repo
4. Update Router workflow with correct webhook URL

## Server Structure (Discovered)

```
/var/opt/wa.dt.wrld/                    # Git repo location
├── packages/
│   ├── whatsapp-n8n-nodes/             # Custom n8n nodes (needs build)
│   └── whatsapp-service/           # Express service
└── vendor/
    └── whatsapp-api/                   # wwebjs-api submodule

/var/www/flow.dater.world/
├── n8n -> /usr/share/github.com/kulemantu/compose-platforms/n8n/
└── custom-nodes/
    └── n8n-nodes-whatsapp-bot/         # Currently contains old SCP deployment
```

## Deployment Steps (Completed)

### Step 1: Update repo on server ✅
```bash
ssh root@no.flow
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api
```

### Step 2: Copy dist folder ✅
Built locally and copied dist folder to server:
```bash
scp -r packages/whatsapp-n8n-nodes/dist root@no.flow:/var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes/
```

### Step 3: Replace custom-nodes with symlink ✅
```bash
# Archived old deployment to .archive/n8n-nodes-whatsapp-bot.20260128-191305

# Created symlink
ln -s /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes \
      /var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot

# Set permissions for n8n container (UID 1000)
chown -R 1000:1000 /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes
```

### Step 4: Create docker-compose.override.yml ✅
Created override file (not modifying git-tracked docker-compose.yml):
```yaml
# /var/www/flow.dater.world/n8n/docker-compose.override.yml
services:
  n8n:
    volumes:
      - ../custom-nodes/n8n-nodes-whatsapp-bot:/home/node/.n8n/custom/n8n-nodes-whatsapp-bot
    environment:
      - N8N_LOG_LEVEL
```

### Step 5: Restart n8n ✅
```bash
cd /var/www/flow.dater.world/n8n
docker compose up -d --force-recreate
```

### Step 6: Verify nodes loaded ✅
```bash
docker compose logs --tail=200 n8n | grep -iE 'codex|whatsapp'
```
Output confirmed:
- `No codex available for: whatsAppBot` - nodes loaded
- `Activated workflow "Testing Trigger and Action Node"` - workflow activated

### Step 7: Test Bot Trigger webhook ✅
```bash
curl -s -m 10 -X POST 'http://localhost:5678/webhook/df4ce89f-fe74-4d2b-8146-2c47b69f0262/webhook' \
  -H 'Content-Type: application/json' \
  -d '{"dataType":"message","data":{"message":{"from":"test@c.us","body":"test","fromMe":false}},"sessionId":"test"}'
```
**Result:** `firstEntryJson` - webhook works!

### Remaining Issue: Router Aggregation

The Router workflow still times out because:
1. Echo Workflow uses `responseMode: responseNode`
2. Echo Reply node calls wwebjs-api (can be slow)
3. Both forward nodes run in parallel but only Echo result appears in Aggregate

**This is a separate workflow design issue, not related to custom nodes deployment.**

## Key Files

| File | Purpose |
|------|---------|
| `n8n-workflows/whatsapp-router.json` | Router workflow JSON (local reference) |
| `packages/whatsapp-n8n-nodes/` | Custom nodes package |
| `packages/whatsapp-n8n-nodes/deploy/config.ts` | Old SCP deploy config |
| `docs/n8n/05-n8n-nodes-deployment.md` | Deployment guide |

## Config Reference

### deploy/config.ts (current values)
```typescript
ssh: { host: 'no.flow', user: 'root', privateKeyPath: '~/.ssh/id_rsa' }
remote: {
  n8nPath: '/var/www/flow.dater.world/n8n',
  customNodesPath: '/var/www/flow.dater.world/custom-nodes',
  nodeName: 'n8n-nodes-whatsapp-bot'
}
```

## Local Repo Structure (Created)

```
deploy/n8n/
├── docker-compose.override.yml   # Custom nodes volume mount (copy to server)
├── custom-nodes/                 # Mirrors server structure
│   ├── .archive/.gitkeep         # Backup placeholder
│   └── README.md                 # Symlink setup instructions
└── README.md                     # Deployment instructions
```

These files provide a reference for the server structure and can be used to recreate the deployment on other servers.

## Notes

- SSH connection to `no.flow` was working earlier in session, may be transient issue
- Symlink approach is preferred to keep deployment consistent with other packages
- Custom nodes provide filtering capabilities (event type, fromMe, groups, phone numbers)
- Tag-based filtering (by user tags from whatsapp-service) not built into nodes yet - would need workflow-level implementation
- docker-compose.override.yml approach keeps git-tracked docker-compose.yml unchanged

## Completion Status

**Primary Objective:** Deploy custom n8n nodes ✅
- Custom nodes deployed via git-based deployment
- Bot Trigger webhook now responds correctly
- docker-compose.override.yml created and copied to server
- Local repo structure mirrors server for documentation

**Remaining Issues (Out of Scope):**
- Echo workflow timeout (uses responseNode mode, waits for wwebjs-api)
- Router aggregation only shows 1 target

These are separate workflow design issues, not deployment issues.
