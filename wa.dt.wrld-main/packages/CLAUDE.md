# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Packages Directory

This directory contains the monorepo packages. See [root CLAUDE.md](../CLAUDE.md) for full project context.

| Package | Description | Dev Command |
|---------|-------------|-------------|
| `whatsapp-service/` | Event processing, tag-based routing, RAG memory, user management | `npm run dev` |
| `whatsapp-n8n-nodes/` | Custom n8n community nodes (optional integration) | `npm run dev` (watch mode) |
| `whatsapp-dashboard/` | React HITL dashboard for agent conversations | `npm run dev` |
| `whatsapp-api/` | Git submodule (kulemantu fork) - **our maintained fork** | N/A |

---

## Per-Package Development

### whatsapp-service (Port 3001)

```bash
cd packages/whatsapp-service
npm run dev          # Hot reload server
npm test             # Run tests
npm run test:watch   # TDD mode
npm run type-check   # TypeScript check
npm run lint:fix     # Auto-fix lint
```

**Guidance:** [whatsapp-service/CLAUDE.md](whatsapp-service/CLAUDE.md) - Architecture, type system, API endpoints, critical operations.

### whatsapp-dashboard (Port 3002)

```bash
cd packages/whatsapp-dashboard
npm run dev          # Vite dev server
npm test             # Vitest tests
npm run type-check   # TypeScript check
npm run lint:fix     # Auto-fix lint
```

**Guidance:** [whatsapp-dashboard/CLAUDE.md](whatsapp-dashboard/CLAUDE.md) - Component patterns, state management, auth pattern.

### whatsapp-n8n-nodes

```bash
cd packages/whatsapp-n8n-nodes
npm run dev          # Watch mode (tsc --watch)
npm run build        # Compile nodes
npm run lint         # Check linting
npm test             # Run tests
```

Node definitions in `nodes/WhatsAppBot/` and `nodes/WhatsAppBotTrigger/`.

### whatsapp-api (Git Submodule)

**Our fork** of [avoylenko/wwebjs-api](https://github.com/avoylenko/wwebjs-api) at [kulemantu/wwebjs-api](https://github.com/kulemantu/wwebjs-api).

**Why we maintain a fork:** WhatsApp Web's internal JavaScript API changes frequently without notice, breaking the underlying whatsapp-web.js library. When upstream fixes are slow, we apply workarounds to our fork.

**Current patches applied:**
- `sendSeen: false` workaround for whatsapp-web.js #5718 (markedUnread error)

**Submodule commands:**
```bash
git submodule update --remote vendor/whatsapp-api  # Update from our fork
cd vendor/whatsapp-api && git log --oneline -1     # Check current commit
```

**Server deployment notes:**
- Build from local code (`build: .` in docker-compose.yml), NOT Docker Hub image
- Configure `BASE_WEBHOOK_URL` in wwebjs-api `.env` to point to your webhook receiver

---

## Package Data Flow

```
WhatsApp ──> whatsapp-api ──webhook──> whatsapp-service ──> Response
                                              │
                                              ├── eventRouter (tag-based routing)
                                              ├── messageRouter (filtering, detection)
                                              ├── qdrantHandler (RAG memory)
                                              └── welcomeService (auto-welcome)
```

n8n workflows are no longer used for message routing. All routing logic is in TypeScript handlers.

**Migration details:** [spec/13-n8n-to-service-migration.md](../spec/13-n8n-to-service-migration.md) - Why routing moved from n8n to TypeScript.

---

## Upstream Stability Notes

The WhatsApp integration depends on reverse-engineered APIs that can break at any time:

| Layer | Stability | Action on Break |
|-------|-----------|-----------------|
| whatsapp-web.js | Low - WhatsApp Web updates frequently | Check GitHub issues, apply workarounds to fork |
| wwebjs-api | Medium - wrapper around whatsapp-web.js | Update fork with patches |
| Our n8n nodes | High - our code | Stable unless API changes |

**When sendMessage or other APIs break:**
1. Check [whatsapp-web.js issues](https://github.com/pedroslopez/whatsapp-web.js/issues)
2. Apply workaround to `vendor/whatsapp-api/src/controllers/`
3. Push to kulemantu/wwebjs-api fork
4. Rebuild server container with `docker compose build --no-cache`

**Debugging guide:** [packages/whatsapp-service/CLAUDE.md#critical-operations](whatsapp-service/CLAUDE.md#critical-operations) - Debugging order, patch system, common gotchas.
