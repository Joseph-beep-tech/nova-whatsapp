# Docker Dev Stack

Docker Compose files for local development and production deployment of the WhatsApp bot platform.

## Compose Files Overview

| File | Location | Purpose | Services |
|------|----------|---------|----------|
| `docker-compose.yml` | repo root | **Local development** — infra + service, whatsapp-api behind profile | 3 core + 1 profile (qdrant, mongodb, whatsapp-service + whatsapp-api\*\*) |
| `docker-compose.dev.yml` | `packages/whatsapp-service/` | Development with Redis event queue | 5 (+ redis) |
| `docker-compose.prod.yml` | `packages/whatsapp-service/` | Legacy production (self-contained) | 2 (mongodb, whatsapp-service) |
| `docker-compose.yml` | `deploy/whatsapp-api/` | **Production** WhatsApp API | 1 (wwebjs-api) |
| `docker-compose.yml` | `deploy/whatsapp-service/` | **Production** service with profiles | 4 (mongodb, redis\*, qdrant\*, whatsapp-service) |
| `docker-compose.yml` | `deploy/keycloak/` | Keycloak identity provider | 2 (keycloak, keycloak-postgres) |
| `docker-compose.override.yml` | `deploy/n8n/` | n8n custom node mounts | extends base n8n |

\* Redis and Qdrant are behind profiles in deploy (see below).
\*\* whatsapp-api is behind `profiles: ["api"]` in root compose — use `--profile api` to include it.

## Which File to Use

```
Local development?
  └── Use repo root docker-compose.yml
        docker compose up -d

Production server?
  └── Use deploy/ files (separate compositions)
        cd deploy/whatsapp-api && docker compose up -d
        cd deploy/whatsapp-service && docker compose up -d
```

## Local Development (Root docker-compose.yml)

Self-contained stack for development with hot reload. The whatsapp-api service is behind a profile since it changes rarely and is usually already running on the server.

### Quick Start

```bash
# Default (service + infra, no whatsapp-api)
docker compose up -d

# Full stack (include whatsapp-api)
docker compose --profile api up -d

# Infrastructure only (run service locally via npm)
docker compose up -d mongodb qdrant

# Service with foreground logs
docker compose up -d mongodb qdrant
docker compose up whatsapp-service

# Watch mode (auto-rebuild on file changes)
docker compose watch

# Rebuild after code changes
docker compose up -d --build whatsapp-service
```

### Services

#### Core (always start)

| Service | Image | Host Port | Container Port | Health Check |
|---------|-------|-----------|----------------|--------------|
| **qdrant** | qdrant/qdrant:latest | 16333 | 6333 | TCP 127.0.0.1:6333 |
| **mongodb** | mongo:7-jammy | 17017 | 27017 | `mongosh ping` |
| **whatsapp-service** | build: packages/whatsapp-service | 13001 | 3001 | HTTP `/service/health` |

#### Profile: `api` (opt-in)

| Service | Image | Host Port | Container Port | Health Check |
|---------|-------|-----------|----------------|--------------|
| **whatsapp-api** | build: vendor/whatsapp-api | 3000 | 3000 | HTTP `/ping` |

Ports are prefixed (16333, 17017, 13001) to avoid conflicts with the SPAO dev stack.

### Environment Variable Conventions

All compose files follow these patterns:

| Pattern | Usage | Example |
|---------|-------|---------|
| `${VAR:-default}` | Dev files — self-bootstrapping without `.env` | `API_KEY=${API_KEY:-dev-local-key}` |
| `${VAR:?message}` | Production — fail-fast for required vars | `API_KEY=${API_KEY:?API_KEY is required}` |
| `${VAR:-}` | Optional keys — empty default | `OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}` |

Internal service URLs are overridable: `WHATSAPP_API_URL=${WHATSAPP_API_URL:-http://whatsapp-api:3000}`. This allows pointing to a remote whatsapp-api when the local profile is not active.

### Environment Variables

All variables have defaults in compose — `.env` is optional for local dev:

```bash
# Override API key (default: dev-local-key / test-local-key)
API_KEY=my-custom-key

# Point to remote whatsapp-api instead of local profile
WHATSAPP_API_URL=https://wa.dater.world

# Admin UI credentials (defaults: admin / admin123)
WHATSAPP_SERVICE_ADMIN_USER=admin
WHATSAPP_SERVICE_ADMIN_PASSWORD=admin123
```

### Shared Volumes

| Volume | Access | Purpose |
|--------|--------|---------|
| `whatsapp-sessions` | whatsapp-api: rw, whatsapp-service: ro | WhatsApp session data |
| `mongodb-data` | mongodb | State persistence |
| `qdrant-data` | qdrant | Vector storage |

The sessions volume is shared between whatsapp-api (writes session data) and whatsapp-service (reads session data). whatsapp-service mounts it read-only.

### Watch Mode

```bash
docker compose watch
```

| Watched Path | Action |
|-------------|--------|
| `packages/whatsapp-service/src/` | sync+restart |
| `packages/whatsapp-service/package.json` | rebuild |

### Network

All services join `whatsapp-network` (bridge). Internal service URLs:

| From → To | URL |
|-----------|-----|
| whatsapp-service → whatsapp-api | `http://whatsapp-api:3000` |
| whatsapp-service → mongodb | `mongodb://mongodb:27017/whatsapp-service` |
| whatsapp-service → qdrant | `http://qdrant:6333` |

## Development with Redis (packages/whatsapp-service/docker-compose.dev.yml)

Extended dev stack that adds Redis for BullMQ event queue testing.

```bash
cd packages/whatsapp-service
docker compose -f docker-compose.dev.yml up -d
```

Adds:
- **redis** (port 6379) — event queue and caching
- Enables `ENABLE_EVENT_QUEUE` and `ENABLE_QDRANT` env vars

All services use default ports (3000, 3001, 6333, 6379, 27017) — will conflict with SPAO if run simultaneously.

## Production Deployment (deploy/)

Production uses separate compose files per service, connected via external Docker networks.

### Architecture

```
                    nginx-proxy (SSL termination)
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      wwebjs-api    whatsapp-service  keycloak
      (port 3000)    (port 3001)     (port 8080)
           │             │
           └──── wa-network ────┘
                     │
                  mongodb
```

### External Networks

Production services communicate via two external Docker networks:

| Network | Purpose | Members |
|---------|---------|---------|
| `proxy` | nginx-proxy reverse proxy, SSL | All public-facing services |
| `wa-network` | Internal WhatsApp service mesh | whatsapp-api, whatsapp-service, keycloak |

Create these before starting services:
```bash
docker network create proxy
docker network create wa-network
```

### deploy/whatsapp-api

WhatsApp session manager (wwebjs-api).

```bash
cd deploy/whatsapp-api
docker compose up -d
```

- Container: `wwebjs-api`
- Builds from `vendor/whatsapp-api`
- Sessions persist at `../../data/whatsapp-sessions/`
- Joins `proxy` + `wa-network`
- Configure via `.env` file

### deploy/whatsapp-service

WhatsApp event processing service with optional feature profiles.

```bash
cd deploy/whatsapp-service

# Minimal (mongodb + service only)
docker compose up -d

# With event queue (adds Redis)
docker compose --profile queue up -d

# With RAG memory (adds Qdrant)
docker compose --profile rag up -d

# Full stack
docker compose --profile queue --profile rag up -d
```

#### Profiles

| Profile | Service Added | Purpose | Enable Via |
|---------|--------------|---------|------------|
| `queue` | **redis** | BullMQ event queue | `ENABLE_EVENT_QUEUE=true` in .env |
| `rag` | **qdrant** | Vector search, semantic memory | `ENABLE_QDRANT=true` in .env |

Without profiles, only `mongodb` and `whatsapp-service` start.

#### Environment Variables

Configure via `deploy/whatsapp-service/.env`:

```bash
# Required
API_KEY=<api-key>

# nginx-proxy
VIRTUAL_HOST=wa.dater.world
LETSENCRYPT_HOST=wa.dater.world

# Optional features
ENABLE_EVENT_QUEUE=false   # Set true + use --profile queue
ENABLE_QDRANT=false        # Set true + use --profile rag
OPENROUTER_API_KEY=        # Required if ENABLE_QDRANT=true

# ERPNext sync
ENABLE_ERPNEXT_SYNC=false
ERPNEXT_URL=
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=
```

### deploy/keycloak

Keycloak OIDC identity provider with its own PostgreSQL.

```bash
cd deploy/keycloak
# Requires KC_DB_PASSWORD and KEYCLOAK_ADMIN_PASSWORD in .env
docker compose up -d
```

- Keycloak 24.0 with organizations feature
- Own PostgreSQL 16 instance (not shared)
- Port 8080 (configurable via `KEYCLOAK_PORT`)
- Admin console: `http://localhost:8080`

### deploy/n8n (Override)

Extends a base n8n compose with custom WhatsApp Bot nodes.

```bash
# Placed alongside the base n8n docker-compose.yml on the server
# Docker Compose automatically merges override files
cd deploy/n8n
docker compose up -d
```

Mounts custom nodes from `packages/whatsapp-n8n-nodes/` into n8n's custom extensions directory. Joins `proxy`, `whatsapp-service_default`, and `wwebjs-api_default` networks for cross-service communication.

## Port Map

All ports used across development and production:

| Port | Service | Context |
|------|---------|---------|
| 3000 | whatsapp-api | Dev + Production |
| 3001 | whatsapp-service | Production (13001 in dev) |
| 6333 | qdrant | Production (16333 in dev) |
| 6379 | redis | Profile: queue |
| 8080 | keycloak | Production |
| 13001 | whatsapp-service | Dev (avoids SPAO conflict) |
| 16333 | qdrant | Dev (avoids SPAO conflict) |
| 17017 | mongodb | Dev (avoids default 27017) |
| 27017 | mongodb | Production |

### Port Conflict Avoidance with SPAO

The dev compose uses prefixed ports to coexist with the SPAO dev stack:

| Service | wa.dt.wrld dev | SPAO dev |
|---------|----------------|----------|
| Qdrant | 16333 | 6333 |
| MongoDB | 17017 | — |
| Service API | 13001 | 5001 |
| Admin UI | — | 3100 |
| Portal UI | — | 3101 |

## Tunnel Integration

When running behind `az dev:up`, use the full production compose files:

```bash
cd deploy/whatsapp-api && docker compose up -d
cd deploy/whatsapp-service && docker compose --profile queue --profile rag up -d

# Services available at:
# https://kago-wa-api.dev.aziziafrica.com  → whatsapp-api (3000)
# https://kago-wa.dev.aziziafrica.com      → whatsapp-service (3001)
```

## Troubleshooting

### whatsapp-api won't start

Check the vendor submodule is initialized:
```bash
git submodule update --init --remote vendor/whatsapp-api
```

### Session data lost after rebuild

Ensure the `whatsapp-sessions` volume persists. Don't use `docker compose down -v` unless you want to reset sessions.

### Services can't communicate (production)

Verify external networks exist:
```bash
docker network ls | grep -E 'proxy|wa-network'
# If missing:
docker network create proxy
docker network create wa-network
```

### Event queue not processing

1. Check Redis is running: `docker compose --profile queue ps`
2. Check `ENABLE_EVENT_QUEUE=true` in `.env`
3. Check whatsapp-service logs: `docker logs whatsapp-service --tail 50`

### Healthcheck shows unhealthy

Alpine containers resolve `localhost` to `::1` (IPv6), but Node/Next.js often binds IPv4 only. All healthchecks use `127.0.0.1` instead of `localhost` to avoid this.

```bash
# Check what a container's healthcheck is doing
docker inspect --format='{{.State.Health.Log}}' <container-name>

# Manually run a healthcheck command inside the container
docker exec <container-name> wget --spider -q http://127.0.0.1:3000

## Seeding Local Data from Server

Copy production data to local dev stacks:

```bash
# MongoDB (wa.dt.wrld)
ssh root@207.154.221.187 "docker exec whatsapp-mongodb mongodump --db whatsapp-service --archive" > /tmp/wa-mongo-dump.archive
docker exec -i wadtwrld-mongodb mongorestore --drop --archive < /tmp/wa-mongo-dump.archive

# PostgreSQL (ai-ops)
ssh root@207.154.221.187 "docker exec postgres pg_dump -U spao -d spao --format=custom" > /tmp/spao-pg-dump.custom
docker exec -i spao-postgres-dev pg_restore -U spao -d spao --clean --if-exists --no-owner < /tmp/spao-pg-dump.custom

# Qdrant — create snapshot on server, download, upload locally
# Server (via Docker network since Qdrant port isn't exposed on host):
ssh root@207.154.221.187 "docker run --rm --network ai-ops-platform_qdrant_network \
  curlimages/curl:latest curl -s -X POST http://qdrant:6333/collections/<name>/snapshots"
# Download snapshot file, then upload to local:
curl -X POST http://localhost:16333/collections/<name>/snapshots/upload \
  -F "snapshot=@/tmp/<name>.snapshot"
```
