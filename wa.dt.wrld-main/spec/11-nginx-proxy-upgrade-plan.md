# Nginx-Proxy Upgrade Plan

## Overview

Upgrade the nginx-proxy infrastructure to enable proper `VIRTUAL_PATH` support for path-based routing. The `nginxproxy/*` images are drop-in replacements for `jwilder/*` - they're maintained by the same community and are interchangeable.

## Current State

| Container | Current Image |
|-----------|---------------|
| nginx-proxy | `jwilder/nginx-proxy` |
| nginx-proxy-letsencrypt | `jrcs/letsencrypt-nginx-proxy-companion` |

## Target State

| Container | New Image |
|-----------|-----------|
| nginx-proxy | `nginxproxy/nginx-proxy:latest` |
| acme-companion | `nginxproxy/acme-companion:latest` |

> **Note**: Images are interchangeable. The `nginxproxy` org took over maintenance from `jwilder`/`jrcs`.

---

## Motivation

### 1. VIRTUAL_PATH Support
The current deployment of `whatsapp-service` uses `VIRTUAL_PATH=/dashboard` but path rewriting doesn't work correctly. The newer image versions properly support:
- `VIRTUAL_PATH` - path prefix matching
- `VIRTUAL_DEST` - path rewriting/stripping

### 2. Continued Maintenance
- `nginxproxy/*` receives regular updates and security patches
- Same codebase, just different Docker Hub organization

---

## Affected Services

Services behind nginx-proxy that will be affected:

| Service | VIRTUAL_HOST | Current Status |
|---------|--------------|----------------|
| wwebjs-api | wa.dater.world | Working |
| n8n | flow.dater.world | Working |
| whatsapp-service | wa.dater.world/dashboard | Path rewriting broken |

---

## Pre-Upgrade Checklist

- [ ] **CRITICAL: Backup SSL certificates and keys**
- [ ] Identify certificate volume/bind mount location
- [ ] Verify all SSL certificates are valid (not expiring soon)
- [ ] Document current container environment variables
- [ ] Schedule maintenance window (recommend low-traffic period)

---

## Upgrade Procedure

### Step 1: Identify and Backup SSL Certificates (CRITICAL)

**This is the most important step. Certificates must be preserved.**

```bash
# SSH to server
ssh root@no.flow

# Create backup directory
BACKUP_DIR=/root/nginx-proxy-backup-$(date +%Y%m%d)
mkdir -p $BACKUP_DIR
cd $BACKUP_DIR

# Find where certificates are stored
docker inspect nginx-proxy --format='{{range .Mounts}}{{if eq .Destination "/etc/nginx/certs"}}{{.Source}}{{end}}{{end}}'

# Backup SSL certificates (CRITICAL)
docker cp nginx-proxy:/etc/nginx/certs ./certs-backup
ls -la ./certs-backup/

# Verify certificate files exist
ls -la ./certs-backup/*.crt ./certs-backup/*.key 2>/dev/null

# Check certificate expiry dates
for cert in ./certs-backup/*.crt; do
  echo "=== $cert ==="
  openssl x509 -in "$cert" -noout -subject -dates 2>/dev/null
done

# Backup container configs
docker inspect nginx-proxy > nginx-proxy-inspect.json
docker inspect nginx-proxy-letsecrypt > acme-companion-inspect.json

# Backup nginx config
docker cp nginx-proxy:/etc/nginx/conf.d ./conf.d-backup

# List current volumes
docker volume ls | grep -E 'nginx|certs|acme' > volumes.txt
cat volumes.txt
```

### Step 2: Verify Certificate Volume Configuration

Before upgrading, ensure you understand how certificates are mounted:

```bash
# Check if using named volume or bind mount
docker inspect nginx-proxy --format='{{json .Mounts}}' | jq '.[] | select(.Destination=="/etc/nginx/certs")'

# If using named volume, note the volume name
docker volume inspect <volume-name>

# If using bind mount, note the host path
# e.g., /var/lib/docker/volumes/certs/_data or /etc/nginx/certs
```

**Key principle**: The certificate volume/mount must remain unchanged during upgrade.

### Step 2: Find and Update Compose File

```bash
# Find where nginx-proxy is defined
find /var/www -name "docker-compose*.yml" -exec grep -l "nginx-proxy" {} \;
# or
find /usr/share -name "docker-compose*.yml" -exec grep -l "nginx-proxy" {} \;
```

The compose file likely exists in a compose-platforms or similar directory.

### Step 3: Update Docker Compose (Preserve Volumes)

**CRITICAL**: Keep the same volume names/mounts to preserve certificates.

```yaml
# Only change the image names, keep volumes identical
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy:latest  # Changed from jwilder/nginx-proxy
    container_name: nginx-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      # KEEP THESE EXACTLY AS THEY WERE - certificates are here
      - conf:/etc/nginx/conf.d
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - certs:/etc/nginx/certs:ro          # CRITICAL: Same volume name
      - /var/run/docker.sock:/tmp/docker.sock:ro
    networks:
      - proxy

  acme-companion:
    image: nginxproxy/acme-companion:latest  # Changed from jrcs/letsencrypt-nginx-proxy-companion
    container_name: acme-companion
    restart: unless-stopped
    environment:
      - DEFAULT_EMAIL=admin@dater.world
    volumes_from:
      - nginx-proxy
    volumes:
      - certs:/etc/nginx/certs:rw          # CRITICAL: Same volume name
      - acme:/etc/acme.sh
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - proxy

# CRITICAL: Do not remove or rename these volumes
volumes:
  conf:
  vhost:
  html:
  certs:    # Contains SSL certificates and keys
  acme:     # Contains ACME account data

networks:
  proxy:
    external: true
```

### Step 4: Perform Upgrade (Preserve Volumes)

```bash
cd /path/to/nginx-proxy-compose

# Pull new images first
docker pull nginxproxy/nginx-proxy:latest
docker pull nginxproxy/acme-companion:latest

# IMPORTANT: Use 'down' without -v to preserve volumes
docker compose down  # Do NOT use -v flag!

# Verify volumes still exist
docker volume ls | grep -E 'certs|acme'

# Start new containers with existing volumes
docker compose up -d

# Verify containers are running
docker compose ps

# IMMEDIATELY verify certificates are accessible
docker exec nginx-proxy ls -la /etc/nginx/certs/

# Check logs for errors
docker compose logs -f
```

### Step 5: Verify Certificates and Services

```bash
# FIRST: Verify SSL certificates are intact
docker exec nginx-proxy ls -la /etc/nginx/certs/
docker exec nginx-proxy ls -la /etc/nginx/certs/*.crt /etc/nginx/certs/*.key

# Check certificate details
docker exec nginx-proxy sh -c 'for f in /etc/nginx/certs/*.crt; do echo "=== $f ==="; openssl x509 -in "$f" -noout -subject -dates; done'

# Test HTTPS connectivity (certificates working)
echo | openssl s_client -servername wa.dater.world -connect wa.dater.world:443 2>/dev/null | openssl x509 -noout -subject -dates
echo | openssl s_client -servername flow.dater.world -connect flow.dater.world:443 2>/dev/null | openssl x509 -noout -subject -dates

# Test each service
curl -I https://wa.dater.world/health
curl -I https://flow.dater.world/healthz
curl -I https://wa.dater.world/dashboard/health

# Check nginx-proxy generated config
docker exec nginx-proxy cat /etc/nginx/conf.d/default.conf | grep -A10 "/dashboard"
```

### Step 6: Verify VIRTUAL_PATH Works

After upgrade, test that path rewriting works:

```bash
# This should return health response without API key error
curl https://wa.dater.world/dashboard/health

# Expected: {"status":"healthy","service":"whatsapp-service"...}
```

---

## Rollback Procedure

If upgrade fails:

```bash
cd /path/to/nginx-proxy-compose

# Stop new containers (preserve volumes)
docker compose down  # Do NOT use -v!

# Revert to old images in docker-compose.yml
sed -i 's|nginxproxy/nginx-proxy|jwilder/nginx-proxy|' docker-compose.yml
sed -i 's|nginxproxy/acme-companion|jrcs/letsencrypt-nginx-proxy-companion|' docker-compose.yml

# Start old containers
docker compose up -d

# Verify certificates still work
docker exec nginx-proxy ls -la /etc/nginx/certs/
curl -I https://wa.dater.world/health
curl -I https://flow.dater.world/healthz
```

### Emergency Certificate Restoration

If certificates were lost (volumes deleted), restore from backup:

```bash
BACKUP_DIR=/root/nginx-proxy-backup-YYYYMMDD

# Find certificate volume mount point
CERT_VOLUME=$(docker volume inspect <certs-volume-name> --format '{{.Mountpoint}}')

# OR if using bind mount
CERT_PATH=/path/to/certs

# Copy certificates back
cp -a $BACKUP_DIR/certs-backup/* $CERT_VOLUME/
# OR
cp -a $BACKUP_DIR/certs-backup/* $CERT_PATH/

# Restart nginx-proxy
docker compose restart nginx-proxy

# Verify
curl -I https://wa.dater.world
```

---

## Post-Upgrade Tasks

1. **Update documentation** - Note new image names in deployment docs
2. **Monitor logs** - Watch for certificate renewal issues over next 24-48 hours
3. **Test certificate renewal** - Force a dry-run renewal test
   ```bash
   docker exec acme-companion /app/cert_status
   ```
4. **Remove old images** - Clean up unused images
   ```bash
   docker image prune -a
   ```

---

## Image Migration Reference

| Old (Deprecated) | New (Active) |
|------------------|--------------|
| `jwilder/nginx-proxy` | `nginxproxy/nginx-proxy` |
| `jrcs/letsencrypt-nginx-proxy-companion` | `nginxproxy/acme-companion` |
| `jwilder/docker-gen` | `nginxproxy/docker-gen` |

---

## Environment Variable Changes

Most environment variables remain the same. Key additions in new images:

| Variable | Description | Default |
|----------|-------------|---------|
| `TRUST_DOWNSTREAM_PROXY` | Trust X-Forwarded-* headers | true |
| `RESOLVERS` | Custom DNS resolvers | auto |
| `DEBUG` | Enable debug logging | false |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **SSL certificate loss** | Low | **CRITICAL** | Backup certs BEFORE upgrade, never use `docker compose down -v` |
| Service downtime | Medium | Medium | Schedule maintenance window |
| Config incompatibility | Low | Low | Images are drop-in replacements |
| Rollback needed | Low | Low | Keep old images, preserve volumes |

**Estimated downtime**: 2-5 minutes during container restart

### Critical Warnings

1. **NEVER use `docker compose down -v`** - This deletes volumes including certificates
2. **ALWAYS backup `/etc/nginx/certs`** before any changes
3. **Verify certificates immediately** after upgrade before declaring success

---

## References

- [nginxproxy/nginx-proxy GitHub](https://github.com/nginx-proxy/nginx-proxy)
- [nginxproxy/acme-companion GitHub](https://github.com/nginx-proxy/acme-companion)
- [Migration Guide](https://github.com/nginx-proxy/nginx-proxy/wiki/Migration-from-jwilder-nginx-proxy)
- [VIRTUAL_PATH Documentation](https://github.com/nginx-proxy/nginx-proxy#virtual-path)
