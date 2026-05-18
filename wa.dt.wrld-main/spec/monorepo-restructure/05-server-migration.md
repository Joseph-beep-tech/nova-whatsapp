# Phase 5: Server Migration (DATA PRESERVATION CRITICAL)

## Task ID: 054.5-server-migration

## Status: COMPLETED

The server migration was completed as part of earlier work. The production server now uses the new directory structure at `/var/opt/wa.dt.wrld/`.

## Server Paths Reference

| Purpose | Path |
|---------|------|
| Git repo | `/var/opt/wa.dt.wrld/` |
| whatsapp-api deploy | `/var/opt/wa.dt.wrld/deploy/whatsapp-api/` |
| whatsapp-service deploy | `/var/opt/wa.dt.wrld/deploy/whatsapp-service/` |
| Patches | `/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/` |
| Session data | `/var/opt/wa.dt.wrld/data/whatsapp-sessions/` |

## Objective

Migrate the production server to use the new directory structure while preserving WhatsApp session data.

## CRITICAL WARNING

**The `sessions/` folder contains authenticated WhatsApp state. If lost, requires QR re-scan and potential loss of session history.**

## Pre-Migration Checklist

- [x] All previous phases (1-4) completed and committed
- [x] Changes pushed to remote repository
- [x] SSH access to server confirmed
- [x] Backup storage has sufficient space

## Migration Steps (Historical Reference)

The migration has been completed. Below are the steps that were followed for reference.

### STEP 1: BACKUP BEFORE ANYTHING ELSE

```bash
ssh root@no.flow

# NOTE: Old location was /var/www/wa.dater.world/whatsapp-api
# This has been migrated to /var/opt/wa.dt.wrld/deploy/whatsapp-api

# Backup sessions (CRITICAL - contains WhatsApp auth)
tar -czvf /root/whatsapp-sessions-backup-$(date +%Y%m%d-%H%M%S).tar.gz sessions/

# Backup .env
cp .env /root/whatsapp-api-env-backup-$(date +%Y%m%d-%H%M%S)

# Verify backup exists and has content
ls -la /root/whatsapp-sessions-backup-*.tar.gz
tar -tvf /root/whatsapp-sessions-backup-*.tar.gz | head -5
```

### STEP 2: STOP OLD CONTAINER (keep data intact)

```bash
# Old location - no longer in use
docker compose stop  # stop, NOT down (preserves volumes)
```

### STEP 3: PULL UPDATED REPO STRUCTURE

```bash
cd /var/opt/wa.dt.wrld
git fetch && git pull
git submodule update --init --recursive
```

### STEP 4: SET UP NEW DEPLOY DIRECTORY

The deploy directory structure is already in the repo:

```bash
# deploy/whatsapp-api/docker-compose.yml is tracked in git
# deploy/whatsapp-service/docker-compose.yml is tracked in git
```

### STEP 5: MOVE (not copy) SESSION DATA

Session data is now stored at `/var/opt/wa.dt.wrld/data/whatsapp-sessions/` (gitignored).

### STEP 6: START FROM NEW LOCATION

```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
docker compose up -d --build
```

### STEP 7: VERIFY SESSION PRESERVED

```bash
# Wait for container to start
sleep 10

# Check container logs for "Session restored" or similar
docker logs wwebjs-api --tail 30

# Check session status endpoint (replace YOUR_API_KEY)
curl -s http://localhost:3000/session/status/mysession \
  -H "x-api-key: YOUR_API_KEY" | jq .

# Health check
curl http://localhost:3000/ping
```

### STEP 8: CLEANUP OLD LOCATION (only after verification)

**ONLY run this after confirming session works:**

```bash
# Old container has been removed
# Old directory (/var/www/wa.dater.world/) can be removed once confident
```

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup to new location
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
tar -xzvf /root/whatsapp-sessions-backup-*.tar.gz
cp /root/whatsapp-api-env-backup-* .env
docker compose up -d
```

## Verification Checklist

- [x] Backup exists: `ls -la /root/whatsapp-sessions-backup-*.tar.gz`
- [x] Sessions in place: `ls -la /var/opt/wa.dt.wrld/data/whatsapp-sessions/`
- [x] Container running: `docker ps | grep wwebjs-api`
- [x] Health check: `curl http://localhost:3000/ping` returns success
- [x] Session preserved: Session status API returns CONNECTED
- [x] Webhook works: Send WhatsApp message, verify service receives it

## Data Safety Guarantees

| Guarantee | How |
|-----------|-----|
| Backup before changes | `tar -czvf` in /root/ |
| Move not copy | Prevents accidental use of stale data |
| Verification step | Explicit session status check before cleanup |
| Rollback documented | Can restore in <2 minutes |

## Patches System

Runtime patches for wwebjs-api are stored in `/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/`:

```bash
# After container rebuild, apply patches
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
./patches/apply-patches.sh && docker restart wwebjs-api

# Or use convenience script
./patches/rebuild-and-patch.sh
```

## Standard Deployment Commands

```bash
# SSH and pull latest
ssh root@no.flow
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api

# Rebuild and restart services
cd deploy/whatsapp-api && docker compose up -d --build
cd ../whatsapp-service && docker compose up -d --build
```

## Notes

- The old `/var/www/wa.dater.world/` directory is no longer used
- Backups in `/root/` should be retained for at least 7 days
- Session data is gitignored and persists between deployments
