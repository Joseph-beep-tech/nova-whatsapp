# Phase 3: Create deploy/ Directory Structure

## Task ID: 054.3-create-deploy

## Objective

Create a `deploy/` directory to store production deployment configurations separate from the submodules.

## Directory Structure to Create

```
deploy/
├── whatsapp-api/
│   ├── docker-compose.yml      # Production config
│   ├── .env.example            # Environment template
│   └── (sessions/)             # Runtime data, gitignored
├── whatsapp-service/
│   └── docker-compose.yml      # Production config (optional)
└── README.md                   # Deployment documentation
```

## Commands

```bash
mkdir -p deploy/whatsapp-api
mkdir -p deploy/whatsapp-service
```

## deploy/whatsapp-api/docker-compose.yml

```yaml
name: wwebjs-api

services:
  api:
    build: ../../vendor/whatsapp-api
    container_name: wwebjs-api
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./sessions:/usr/src/app/sessions
    ports:
      - "3000:3000"
    networks:
      - default
      - proxy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/ping', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  proxy:
    external: true
```

## deploy/whatsapp-api/.env.example

```bash
# WhatsApp API Configuration
# Copy to .env and fill in values

# API authentication
API_KEY=your-api-key-here

# Webhook configuration
BASE_WEBHOOK_URL=http://n8n:5678/webhook/whatsapp/router
ENABLE_WEBHOOK=TRUE

# Logging
LOG_LEVEL=info

# Session configuration (optional)
# SESSIONS_PATH=/usr/src/app/sessions
# RECOVER_SESSIONS=true
```

## deploy/README.md

```markdown
# Deployment Configurations

This directory contains production deployment configurations for services
that are git submodules (vendor/) and shouldn't be modified directly.

## Directory Structure

- `whatsapp-api/` - Production config for wwebjs-api
- `whatsapp-service/` - Production config for n8n service (if needed)

## Usage

### whatsapp-api

```bash
cd deploy/whatsapp-api
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

### Server Deployment

See `spec/monorepo-restructure/05-server-migration.md` for complete
server migration instructions with data preservation.

## Gitignored Files

These files are gitignored and must be created on each deployment:
- `.env` - Contains secrets
- `sessions/` - WhatsApp session data
- `docker-compose.override.yml` - Server-specific overrides
```

## Verification

```bash
# Validate compose syntax
docker compose -f deploy/whatsapp-api/docker-compose.yml config

# Test that build context resolves correctly
docker compose -f deploy/whatsapp-api/docker-compose.yml build --dry-run
```

## Checklist

- [ ] `deploy/whatsapp-api/` directory created
- [ ] `deploy/whatsapp-api/docker-compose.yml` created
- [ ] `deploy/whatsapp-api/.env.example` created
- [ ] `deploy/README.md` created
- [ ] Compose config validates

## Notes

- The build context `../../vendor/whatsapp-api` is relative to `deploy/whatsapp-api/`
- Sessions volume is local to deploy directory, not shared with development
- `proxy` network is external - must exist on production server (nginx-proxy)
