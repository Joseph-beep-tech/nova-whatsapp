# Deployment Migration: rsync/scp to Git-Based

**Date:** 2026-01-28
**Status:** COMPLETE
**Repo:** `github.com/kulemantu/wa.dt.wrld`
**Server:** `no.flow` (root@no.flow)
**Task:** 054-20260127-monorepo-restructure

## Summary

Migrated from manual rsync/scp deployment to git-based deployment with the monorepo cloned to `/var/opt/wa.dt.wrld` and symlinks in `/var/www/wa.dater.world/`.

---

## Server Structure (Post-Migration)

```
/var/opt/wa.dt.wrld/                    # Git repo (main deployment location)
├── vendor/whatsapp-api/                # Submodule (kulemantu/wwebjs-api)
├── packages/whatsapp-service/      # Service code
├── deploy/                             # Docker-compose files + .env
│   ├── whatsapp-api/
│   │   ├── docker-compose.yml
│   │   └── .env                        # Copied from old location
│   └── whatsapp-service/
│       ├── docker-compose.yml
│       └── .env                        # Copied from old location
└── data/whatsapp-sessions/             # Session data (gitignored)

/var/www/wa.dater.world/
├── whatsapp-api -> /var/opt/wa.dt.wrld/vendor/whatsapp-api
├── whatsapp-service -> /var/opt/wa.dt.wrld/packages/whatsapp-service
├── _whatsapp-api.bak/                  # Old directory (can delete after 48h)
└── _whatsapp-service.bak/          # Old directory (can delete after 48h)
```

---

## Key Learnings

### 1. SSH Key Setup Required

The server had no SSH key for GitHub access. Generated with:
```bash
ssh-keygen -t ed25519 -C 'no.flow server' -f ~/.ssh/id_ed25519 -N ''
ssh-keyscan github.com >> ~/.ssh/known_hosts
```
Then added public key to GitHub: https://github.com/settings/keys

### 2. Submodule Initialization

After cloning, submodules must be explicitly initialized:
```bash
git submodule update --init vendor/whatsapp-api
```

### 3. npm ci vs npm install in Dockerfile

Workspace packages don't have their own `package-lock.json`. The Dockerfile must use:
```dockerfile
RUN npm install && npm cache clean --force
```
Not `npm ci` which requires a lockfile.

### 4. Dockerfile.prod vs Dockerfile

- `Dockerfile.prod` expects pre-built `dist/` folder (CI/CD scenario)
- `Dockerfile` builds TypeScript inside container (simpler for git-based deploy)

The deploy docker-compose was updated to use `Dockerfile` instead of `Dockerfile.prod`.

### 5. Docker Network Dependencies

When stopping containers, networks may fail to remove if other containers use them:
```
failed to remove network wwebjs-api_default: network has active endpoints
```
Solution: Stop dependent containers first (whatsapp-service depends on wwebjs-api network).

### 6. Health Check Endpoints

| Service | Internal Health | External Health |
|---------|-----------------|-----------------|
| wwebjs-api | `localhost:3000/ping` | `https://wa.dater.world/ping` |
| whatsapp-service | `localhost:3001/service/health` | `https://wa.dater.world/service/health` |

Note: whatsapp-service uses `/service/` prefix for all endpoints.

---

## Deployment Commands

### Standard Deployment
```bash
ssh root@no.flow
cd /var/opt/wa.dt.wrld
git pull && git submodule update --remote vendor/whatsapp-api
cd deploy/whatsapp-api && docker compose up -d --build
cd ../whatsapp-service && docker compose up -d --build
```

### View Logs
```bash
docker logs -f wwebjs-api --tail 100
docker logs -f whatsapp-service --tail 100
```

### Check Status
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'wwebjs|whatsapp|mongodb'
```

---

## Backup Locations

### Local Backups (on dev machine)
| Backup | Path |
|--------|------|
| wa.dater.world | `/Users/kago/space/dater.local/backups/wa.dater.world/` |
| n8n PostgreSQL | `/Users/kago/space/dater.local/backups/flow.dater.world/n8n-postgres-20260128.sql` |

### Server Backups
| Backup | Path |
|--------|------|
| Old whatsapp-api | `/var/www/wa.dater.world/_whatsapp-api.bak/` |
| Old whatsapp-service | `/var/www/wa.dater.world/_whatsapp-service.bak/` |

---

## Environment Files

### whatsapp-api (.env)
Located at: `/var/opt/wa.dt.wrld/deploy/whatsapp-api/.env`

Key variables:
- `API_KEY` - Authentication for API calls
- `BASE_WEBHOOK_URL` - n8n webhook endpoint
- `MAX_ATTACHMENT_SIZE` - File upload limit
- `SESSIONS_PATH` - Mapped to `../../data/whatsapp-sessions`

### whatsapp-service (.env)
Located at: `/var/opt/wa.dt.wrld/deploy/whatsapp-service/.env`

Key variables:
- `API_KEY` - Must match whatsapp-api
- `WHATSAPP_API_URL` - Internal: `http://wwebjs-api:3000`
- `WHATSAPP_SERVICE_ADMIN_USER` - Admin UI login
- `WHATSAPP_SERVICE_ADMIN_PASSWORD` - Admin UI password

---

## Docker Networks

| Network | Purpose | Containers |
|---------|---------|------------|
| `proxy` | nginx-proxy reverse proxy | wwebjs-api, whatsapp-service, n8n |
| `wwebjs-api_default` | Internal API communication | wwebjs-api, whatsapp-service |
| `whatsapp-service_default` | Service + MongoDB | whatsapp-service, whatsapp-mongodb |

---

## Rollback Procedure

If issues occur:

```bash
# 1. Stop new containers
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api && docker compose down
cd /var/opt/wa.dt.wrld/deploy/whatsapp-service && docker compose down

# 2. Remove symlinks
rm /var/www/wa.dater.world/whatsapp-api
rm /var/www/wa.dater.world/whatsapp-service

# 3. Restore old directories
mv /var/www/wa.dater.world/_whatsapp-api.bak /var/www/wa.dater.world/whatsapp-api
mv /var/www/wa.dater.world/_whatsapp-service.bak /var/www/wa.dater.world/whatsapp-service

# 4. Start old containers
cd /var/www/wa.dater.world/whatsapp-api && docker compose up -d
cd /var/www/wa.dater.world/whatsapp-service && docker compose up -d
```

---

## Cleanup (After 48h Stable Operation)

```bash
rm -rf /var/www/wa.dater.world/_whatsapp-api.bak
rm -rf /var/www/wa.dater.world/_whatsapp-service.bak
```

---

## Post-Migration Fix: Dockerfile Issue

### Problem

After initial migration, we discovered the deploy docker-compose referenced `Dockerfile.prod` which expects a pre-built `dist/` folder. This works for CI/CD pipelines but fails for git-based deployment.

Additionally, `Dockerfile` used `npm ci` which requires `package-lock.json` - but workspace packages don't have their own lockfile.

### Files Affected

| File | Issue | Fix |
|------|-------|-----|
| `packages/whatsapp-service/Dockerfile:11` | `npm ci` fails without lockfile | Changed to `npm install` |
| `deploy/whatsapp-service/docker-compose.yml:26` | Referenced `Dockerfile.prod` | Changed to `Dockerfile` |

### Dockerfile Comparison

| Dockerfile | Use Case | Builds TypeScript? | When to Use |
|------------|----------|-------------------|-------------|
| `Dockerfile` | Git-based deployment | Yes, inside container | Current workflow |
| `Dockerfile.prod` | CI/CD pipelines | No, expects `dist/` | GitHub Actions, etc. |

### Fix Applied

```bash
# On server (during migration via sed)
sed -i 's/npm ci/npm install/g' /var/opt/wa.dt.wrld/packages/whatsapp-service/Dockerfile
sed -i 's/Dockerfile.prod/Dockerfile/g' /var/opt/wa.dt.wrld/deploy/whatsapp-service/docker-compose.yml

# Later committed locally and pushed to sync
git commit -m "fix(deploy): use Dockerfile instead of Dockerfile.prod"
git push origin main
ssh root@no.flow "cd /var/opt/wa.dt.wrld && git pull"
```

### Commit Reference

```
b7f70f6 fix(deploy): use Dockerfile instead of Dockerfile.prod for git-based deployment
```

---

## Patches System (Added Jan 30, 2026)

Runtime patches for wwebjs-api are managed in `/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/`:

| File | Purpose |
|------|---------|
| `apply-patches.sh` | Apply patches to running container (idempotent) |
| `rebuild-and-patch.sh` | Rebuild container + apply patches + restart |
| `001-client-hassynced-fix.patch` | hasSynced timing fix reference |
| `README.md` | Full documentation |

### Usage

```bash
# After container rebuild
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
./patches/apply-patches.sh && docker restart wwebjs-api

# Or use convenience script
./patches/rebuild-and-patch.sh
```

---

## Key Learnings (From Working Sessions)

### 1. Health Check Endpoints

| Service | Internal | External |
|---------|----------|----------|
| wwebjs-api | `localhost:3000/ping` | `https://wa.dater.world/ping` |
| whatsapp-service | `localhost:3001/service/health` | `https://wa.dater.world/service/health` |

**Common mistake:** Using `/health` instead of `/service/health` for whatsapp-service.

### 2. WhatsApp Session Maintenance

When message callbacks stop working:

1. Check console errors for module errors like `"Requiring unknown module..."`
2. Check [whatsapp-web.js releases](https://github.com/pedroslopez/whatsapp-web.js/releases) for fixes
3. Update version in `vendor/whatsapp-api/package.json`
4. Run `npm update whatsapp-web.js` to update lock file
5. Commit, push, and redeploy

### 3. wwebjs-api Content Types

| contentType | content format |
|-------------|---------------|
| `string` | Plain text string |
| `MessageMedia` | `{mimetype, data, filename}` where `data` is **base64** |
| `MessageMediaFromURL` | **URL string directly** (NOT an object with url property!) |

**Wrong:** `{"contentType": "MessageMediaFromURL", "content": {"url": "https://..."}}`
**Correct:** `{"contentType": "MessageMediaFromURL", "content": "https://..."}`

### 4. Docker Network Order

When stopping containers, networks may fail to remove if other containers use them. Stop dependent containers first (whatsapp-service depends on wwebjs-api network).

---

## Related Files

- [deploy/README.md](../../deploy/README.md) - Deploy folder documentation
- [CLAUDE.md](../../CLAUDE.md) - Main project documentation (deployment section)
- [spec/monorepo-restructure/05-server-migration.md](../../spec/monorepo-restructure/05-server-migration.md) - Server migration spec
- `.claude/plans/stateless-rolling-island.md` - Original migration plan
