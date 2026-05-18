# Deployment Configurations

This directory contains production deployment configurations for all services
in the monorepo. Run docker-compose from these folders on the server.

## Directory Structure

```
deploy/
├── n8n/                    # n8n custom nodes override
│   ├── docker-compose.override.yml
│   ├── custom-nodes/
│   │   └── n8n-nodes-whatsapp-bot -> packages/whatsapp-n8n-nodes
│   └── README.md
├── whatsapp-api/           # wwebjs-api service (port 3000)
│   ├── docker-compose.yml
│   ├── .env.example
│   └── patches/            # Runtime patches (server-only)
│       ├── apply-patches.sh
│       ├── rebuild-and-patch.sh
│       └── README.md
└── whatsapp-service/   # n8n bridge service (port 3001)
    ├── docker-compose.yml
    └── .env.example
```

## Server Paths

Production server: `root@no.flow`
Git repo location: `/var/opt/wa.dt.wrld/`

| Purpose | Path |
|---------|------|
| Git repo | `/var/opt/wa.dt.wrld/` |
| whatsapp-api deploy | `/var/opt/wa.dt.wrld/deploy/whatsapp-api/` |
| whatsapp-service deploy | `/var/opt/wa.dt.wrld/deploy/whatsapp-service/` |
| Patches | `/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/` |
| Session data | `/var/opt/wa.dt.wrld/data/whatsapp-sessions/` |

| Service | Deploy From | Build Context |
|---------|-------------|---------------|
| n8n (custom nodes) | `deploy/n8n/` | Override only (base config in compose-platforms) |
| whatsapp-api | `deploy/whatsapp-api/` | `../../vendor/whatsapp-api` |
| whatsapp-service | `deploy/whatsapp-service/` | `../../packages/whatsapp-service` |

## Usage

### Initial Setup

```bash
# Clone repo to server
ssh root@no.flow
cd /var/opt && git clone git@github.com:kulemantu/wa.dt.wrld.git
cd wa.dt.wrld

# Initialize submodules
git submodule update --init --recursive vendor/whatsapp-api

# Create data directory for WhatsApp sessions
mkdir -p data/whatsapp-sessions
```

### n8n (custom nodes)

The custom WhatsAppBotTrigger and WhatsAppBot nodes are in `packages/whatsapp-n8n-nodes`.

```bash
# First time: Create symlink on server (see deploy/n8n/custom-nodes/README.md)
ssh root@no.flow "ln -s /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes \
  /var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot"

# Copy override file to n8n directory
scp deploy/n8n/docker-compose.override.yml root@no.flow:/var/www/flow.dater.world/n8n/

# Restart n8n to load custom nodes
ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose up -d --force-recreate"
```

### whatsapp-api

```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

### whatsapp-service

```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-service
cp .env.example .env
# Edit .env with production values
docker compose up -d
```

### Standard Deployment

```bash
# SSH and pull latest
ssh root@no.flow
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api

# Rebuild and restart services
cd deploy/whatsapp-api && docker compose up -d --build
cd ../whatsapp-service && docker compose up -d --build
```

### View Logs

```bash
docker logs -f wwebjs-api --tail 100
docker logs -f whatsapp-service --tail 100
```

### Patches System

Runtime patches for wwebjs-api are stored in `deploy/whatsapp-api/patches/` on the server:

```bash
# After container rebuild, apply patches
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
./patches/apply-patches.sh && docker restart wwebjs-api

# Or use convenience script
./patches/rebuild-and-patch.sh
```

## Gitignored Files

These files are gitignored and must be created on each deployment:
- `.env` - Contains secrets (API keys, passwords)
- `docker-compose.override.yml` - Server-specific overrides
- `patches/` - Server-specific runtime patches

## Data Directory

The `data/` folder at repo root stores persistent data:
- `data/whatsapp-sessions/` - WhatsApp authentication sessions

This folder is gitignored but must be backed up before any migration.

## Health Checks

| Service | Internal Health | External Health |
|---------|-----------------|-----------------|
| wwebjs-api | `localhost:3000/ping` | `https://wa.dater.world/ping` |
| whatsapp-service | `localhost:3001/service/health` | `https://wa.dater.world/service/health` |

Note: whatsapp-service uses `/service/` prefix for all endpoints.
