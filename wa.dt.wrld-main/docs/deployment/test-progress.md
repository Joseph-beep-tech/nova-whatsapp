# Service Testing Progress (2026-01-29)

## Test 1: WhatsApp Service Health
| Field | Value |
|-------|-------|
| **Endpoint** | `GET https://wa.dater.world/service/health` |
| **Status** | ✅ Pass |
| **Result** | `{"status":"healthy","service":"whatsapp-service","mode":"thin-wrapper","timestamp":"2026-01-28T23:57:51.140Z"}` |

---

## Test 1b: WhatsApp API Ping
| Field | Value |
|-------|-------|
| **Endpoint** | `GET https://wa.dater.world/ping` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true,"message":"pong"}` |

---

## Test 1c: n8n Health
| Field | Value |
|-------|-------|
| **Endpoint** | `GET https://flow.dater.world/healthz` |
| **Status** | ✅ Pass |
| **Result** | `{"status":"ok"}` |
| **Fix Applied** | Added VIRTUAL_HOST, LETSENCRYPT_HOST env vars and proxy network to docker-compose.override.yml |

---

## Test 2: User Registration with Tags
| Field | Value |
|-------|-------|
| **Endpoint** | `POST https://wa.dater.world/service/users/register` |
| **Headers** | `x-api-key: [SERVICE_API_KEY]`, `Content-Type: application/json` |
| **Body** | `{"chatId": "254722833440@c.us", "tags": ["TEST"]}` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true,"user":{"chatId":"254722833440@c.us","phoneNumber":"254722833440","tags":["SOMO","TEST"],"firstContactAt":"2026-01-28T14:38:15.375Z","lastContactAt":"2026-01-28T18:49:00.395Z","messageCount":3}}` |

---

## Test 3: List Users by Tag
| Field | Value |
|-------|-------|
| **Endpoint** | `GET https://wa.dater.world/service/users/list?tag=TEST` |
| **Headers** | `x-api-key: [SERVICE_API_KEY]` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true,"users":[{"chatId":"254722833440@c.us","phoneNumber":"254722833440","tags":["SOMO","TEST"],"firstContactAt":"2026-01-28T14:38:15.375Z","lastContactAt":"2026-01-28T18:49:00.395Z","messageCount":3}],"total":1,"filteredByTag":"TEST"}` |

---

## Test 3b: List All Tags
| Field | Value |
|-------|-------|
| **Endpoint** | `GET https://wa.dater.world/service/users/tags` |
| **Headers** | `x-api-key: [SERVICE_API_KEY]` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true,"tags":["SOMO","TEST"],"total":2}` |
| **Re-tested** | 2026-01-29 00:09 UTC |

---

## Test 4: n8n Send WhatsApp API (text)
| Field | Value |
|-------|-------|
| **Endpoint** | `POST https://flow.dater.world/webhook/wa-api` |
| **Workflow ID** | `CBppy9-zrrQ51xjxBgQTy` |
| **Headers** | `x-api-key: [N8N_API_KEY]`, `Content-Type: application/json` |
| **Body** | `{"chatId": "254722833440@c.us", "message": "Test from n8n API workflow"}` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true}` |

---

## Test 5: n8n Send WhatsApp API (media)
| Field | Value |
|-------|-------|
| **Endpoint** | `POST https://flow.dater.world/webhook/wa-api` |
| **Headers** | `x-api-key: [N8N_API_KEY]`, `Content-Type: application/json` |
| **Body** | `{"chatId": "254722833440@c.us", "media": {"url": "https://picsum.photos/200", "caption": "Test image from API"}}` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true}` |

---

## Test 6: n8n Router Workflow
| Field | Value |
|-------|-------|
| **Endpoint** | `POST https://flow.dater.world/webhook/whatsapp/router` |
| **Workflow ID** | `L94Ziar3GQZLUU1V` |
| **Headers** | `Content-Type: application/json` |
| **Body** | `{"dataType":"message_create","data":{"message":{"from":"254722833440@c.us","body":"SOMO test","fromMe":false}},"sessionId":"mysession"}` |
| **Status** | ✅ Pass |
| **Result** | `{"success":true,"message":"Router processed message","branches":1,"timestamp":"..."}` |
| **Architecture** | Redesigned to handle echo reply and SOMO registration inline |
| **Verified** | User tags updated to include ["SOMO", "incoming"] |
| **Tested** | 2026-01-29 01:54 UTC |

---

## Test 7: n8n Echo Workflow (DEPRECATED)
| Field | Value |
|-------|-------|
| **Endpoint** | `POST https://flow.dater.world/webhook/whatsapp/webhook` |
| **Workflow ID** | `whatsapp-debug` |
| **Status** | ⚠️ Deprecated |
| **Note** | Echo functionality moved to Router workflow. This workflow is now inactive and returns a deprecation notice. |
| **Migration** | Echo reply logic is now handled inline by the Router workflow's "Send Echo Reply" node |

---

## Test 8: Direct WhatsApp Text Message
| Field | Value |
|-------|-------|
| **Endpoint** | `POST http://localhost:3000/client/sendMessage/mysession` |
| **Headers** | `x-api-key: [WHATSAPP_API_KEY]`, `Content-Type: application/json` |
| **Body** | `{"chatId": "254722833440@c.us", "contentType": "string", "content": "Test message"}` |
| **Status** | ✅ Pass |
| **Result** | Message delivered, ack=1 |
| **Tested** | 2026-01-29 00:57 UTC |

---

## Test 9: Direct WhatsApp Media Message (URL)
| Field | Value |
|-------|-------|
| **Endpoint** | `POST http://localhost:3000/client/sendMessage/mysession` |
| **Headers** | `x-api-key: [WHATSAPP_API_KEY]`, `Content-Type: application/json` |
| **Body** | `{"chatId": "254722833440@c.us", "contentType": "MessageMediaFromURL", "content": "https://shop.somoafrica.org/img/logo/min/logo_small.png", "options": {"caption": "SOMO Logo"}}` |
| **Status** | ✅ Pass |
| **Result** | Image delivered with caption, ack=1 |
| **Tested** | 2026-01-29 00:59 UTC |

---

## Summary
| Test | Status |
|------|--------|
| 1. Service Health | ✅ |
| 1b. API Ping | ✅ |
| 1c. n8n Health | ✅ (fixed) |
| 2. User Registration | ✅ |
| 3. List Users by Tag | ✅ |
| 3b. List All Tags | ✅ |
| 4. Send Text via n8n | ✅ |
| 5. Send Media via n8n | ✅ |
| 6. Router Workflow | ✅ (redesigned, inline SOMO/echo) |
| 7. Echo Workflow | ⚠️ Deprecated (logic moved to Router) |
| 8. Direct Text Message | ✅ |
| 9. Direct Media Message | ✅ |

**Last Run:** 2026-01-29 01:54 UTC

**Legend:** ✅ Pass | ❌ Fail | ⏳ Pending | ⚠️ Partial

---

## API Keys Reference
| Service | Key Variable | Location |
|---------|--------------|----------|
| whatsapp-service | `API_KEY` | `/var/opt/wa.dt.wrld/deploy/whatsapp-service/.env` |
| n8n workflows | `API_KEY` | `/usr/share/github.com/kulemantu/compose-platforms/n8n/.env` |
| wwebjs-api | `WHATSAPP_API_KEY` | n8n .env file |

---

## Active Workflows (from PostgreSQL)
```
          id           |                 name                  | active
-----------------------+---------------------------------------+--------
 L94Ziar3GQZLUU1V      | WhatsApp Router (Multi-Target Fanout) | t
 whatsapp-debug        | WhatsApp Echo Reply                   | t
 CBppy9-zrrQ51xjxBgQTy | WhatsApp Send API                     | t
```

---

## Notes
- Server repo location: `/var/opt/wa.dt.wrld`
- All external endpoints working correctly
- Container `whatsapp-service` shows "unhealthy" in Docker but external health check passes (likely internal healthcheck path issue)

### n8n nginx-proxy Fix (2026-01-29)
n8n was returning 503 via nginx because it wasn't connected to the proxy network and lacked VIRTUAL_HOST env var.

**Fix applied to `/var/www/flow.dater.world/n8n/docker-compose.override.yml`:**
```yaml
services:
  n8n:
    environment:
      - VIRTUAL_HOST
      - LETSENCRYPT_HOST
      - LETSENCRYPT_EMAIL
    networks:
      - default
      - proxy

networks:
  proxy:
    external: true
```

### Symlink Fix (2026-01-29)
Updated symlinks in `/var/www/wa.dater.world/` to point to deploy folders (with .env and docker-compose.yml) instead of source code:

```bash
# Before (broken - no .env)
whatsapp-api -> /var/opt/wa.dt.wrld/vendor/whatsapp-api
whatsapp-service -> /var/opt/wa.dt.wrld/packages/whatsapp-service

# After (working - has .env)
whatsapp-api -> /var/opt/wa.dt.wrld/deploy/whatsapp-api
whatsapp-service -> /var/opt/wa.dt.wrld/deploy/whatsapp-service
```

---

## Router Workflow Architecture (2026-01-29)

### Architectural Redesign

**Problem:** n8n self-call timeouts when Router forwarded to Echo workflow internally.

**Solution:** Move all routing logic and actions into the Router workflow itself. Downstream workflows are deprecated.

### New Architecture

```
WhatsApp Event → wwebjs-api webhook → Router Workflow
                                            │
                                            ├── Extract & Route (Code node)
                                            │   - Filter fromMe (prevents loops)
                                            │   - Deduplicate messages (60s window)
                                            │   - Set routing flags
                                            │
                                            ├── Is Incoming Message? (IF node)
                                            │   └── Yes → Send Echo Reply (HTTP Request to wwebjs-api)
                                            │
                                            ├── Contains SOMO? (IF node)
                                            │   └── Yes → Register SOMO User (HTTP Request to service)
                                            │   └── Yes → Forward to Bot Trigger (HTTP Request to n8n)
                                            │
                                            └── Aggregate Results (Code node)
```

### Benefits

| Before | After |
|--------|-------|
| Router → HTTP call → Echo workflow → HTTP call → wwebjs-api | Router → HTTP call → wwebjs-api |
| n8n self-call timeout issue | No self-call, direct API call |
| Duplicate message filtering in both Router and Echo | Single filter in Router |
| 2 workflows to maintain | 1 workflow (Echo deprecated) |

### Workflow Files

| File | Status | Purpose |
|------|--------|---------|
| `n8n-workflows/whatsapp-router.json` | ✅ Active | Central routing, echo reply, SOMO registration |
| `n8n-workflows/whatsapp-echo-reply.json` | ⚠️ Deprecated | Kept for backwards compatibility, `active: false` |

### Environment Variables (Placeholders)

The workflow JSON files use placeholders for sensitive values:

| Placeholder | Description | Server Location |
|-------------|-------------|-----------------|
| `$env.WHATSAPP_API_KEY` | wwebjs-api authentication | n8n .env file |
| `$env.SERVICE_API_KEY` | whatsapp-service authentication | n8n .env file |
| `{{BOT_TRIGGER_WEBHOOK_ID}}` | Custom bot workflow webhook ID | Replace in n8n UI |

**Important:** n8n must have `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` set to allow workflow access to environment variables.

### Deployment Commands

```bash
# Git-based deployment (on server)
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api

# Import updated workflows to n8n
# Option 1: Use n8n UI to import JSON files
# Option 2: Use n8n CLI or API

# Restart n8n
cd /var/www/flow.dater.world/n8n
docker compose restart n8n

# Verify workflow loaded
docker compose logs --tail=50 n8n | grep -i "router\|whatsapp"
```

### Testing the New Router

```bash
# Test incoming message (should trigger echo reply)
curl -s -m 15 -X POST https://flow.dater.world/webhook/whatsapp/router \
  -H 'Content-Type: application/json' \
  -d '{"dataType":"message_create","data":{"message":{"from":"254722833440@c.us","body":"Hello","fromMe":false}},"sessionId":"mysession"}' | jq

# Test SOMO keyword (should register user and forward to bot)
curl -s -m 15 -X POST https://flow.dater.world/webhook/whatsapp/router \
  -H 'Content-Type: application/json' \
  -d '{"dataType":"message_create","data":{"message":{"from":"254722833440@c.us","body":"SOMO help","fromMe":false}},"sessionId":"mysession"}' | jq
```

**See Task:** `055-20260128-fix-router-workflow-timeout` in tasks.json
