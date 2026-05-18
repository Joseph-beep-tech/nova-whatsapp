# Qdrant Vector Database Setup

## Overview

Qdrant is used as the vector database for RAG (Retrieval-Augmented Generation) features. It stores embeddings for semantic search and content retrieval.

---

## Docker Configuration

### Basic Setup

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    restart: unless-stopped
    volumes:
      - qdrant-data:/qdrant/storage
    ports:
      - "6333:6333"  # REST API
      - "6334:6334"  # gRPC
    networks:
      - default
```

### Health Check Configuration

**Important**: The Qdrant Docker image is minimal and does NOT include `curl` or `wget`. Use bash's built-in `/dev/tcp` for health checks.

```yaml
healthcheck:
  test: ["CMD-SHELL", "bash -c 'echo > /dev/tcp/localhost/6333'"]
  interval: 10s
  timeout: 5s
  retries: 5
```

#### Why Not curl/wget?

The official `qdrant/qdrant` image is built for minimal size and doesn't include common HTTP utilities:

| Tool | Available? | Notes |
|------|------------|-------|
| `curl` | No | Not installed |
| `wget` | No | Not installed |
| `nc` (netcat) | No | Not installed |
| `bash` | Yes | Has `/dev/tcp` support |

#### Health Check Endpoints

Qdrant provides these health endpoints (useful for debugging, but require HTTP client):

```bash
# From host machine (not inside container)
curl http://localhost:6333/healthz   # General health
curl http://localhost:6333/readyz    # Ready to serve
curl http://localhost:6333/livez     # Liveness check
```

---

## Environment Variables

### Authentication

```yaml
environment:
  - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
```

### nginx-proxy Integration

```yaml
environment:
  - VIRTUAL_HOST=qd.dater.world
  - VIRTUAL_PORT=6333
  - LETSENCRYPT_HOST=qd.dater.world
```

---

## Service Integration

### From whatsapp-service

```yaml
environment:
  - QDRANT_URL=http://qdrant:6333
```

### Connection Test

```bash
# Test from inside a container on the same network
docker exec whatsapp-service curl -s http://qdrant:6333/collections

# Test from host
curl http://localhost:6333/collections
```

---

## Troubleshooting

### Container Shows "unhealthy"

**Symptoms**: `docker ps` shows Qdrant container as `(unhealthy)`

**Diagnosis**:
```bash
# Check health check logs
docker inspect qdrant --format '{{json .State.Health}}' | jq

# Common error:
# "exec: \"curl\": executable file not found in $PATH"
# "exec: \"wget\": executable file not found in $PATH"
```

**Solution**: Update healthcheck to use bash `/dev/tcp` (see Health Check Configuration above).

### Verify Service is Actually Running

Even if Docker reports unhealthy, the service may be running fine:

```bash
# Check logs for errors
docker logs qdrant --tail 50

# Test API from host
curl http://localhost:6333/collections

# Test port connectivity
docker exec qdrant bash -c 'echo > /dev/tcp/localhost/6333 && echo OK'
```

### API Key Authentication Errors

**Symptoms**: Requests return 401 Unauthorized

**Solution**: Include API key in requests:
```bash
curl -H "api-key: ${QDRANT_API_KEY}" http://localhost:6333/collections
```

---

## Production Deployment

### Server Locations

| Host | Path | Purpose |
|------|------|---------|
| qd.dater.world | `/var/www/qd.dater.world/` | Standalone Qdrant instance |
| wa.dater.world | Part of whatsapp-service compose | Integrated Qdrant for RAG |

### Updating Health Check on Server

```bash
ssh root@no.flow

# Edit compose file
vim /var/www/qd.dater.world/docker-compose.yml

# Update healthcheck to:
#   test: ["CMD-SHELL", "bash -c 'echo > /dev/tcp/localhost/6333'"]

# Restart
cd /var/www/qd.dater.world && docker compose up -d
```

---

## Service Integration Architecture

### Current State

Embeddings and vector operations are **internal services**, not exposed as HTTP endpoints:

| Operation | Access Method | Notes |
|-----------|---------------|-------|
| Store embeddings | Event processing pipeline | Via `qdrantHandler.handleEvent()` |
| Hybrid search | Internal service call | Via `qdrantHandler.hybridSearch()` |
| Thread detection | Internal service call | Via `threadDetector` functions |
| Conversation summaries | StateManager | MongoDB, not Qdrant |

Content (LMS modules) is accessed via the Progress API routes, which internally use `LmsCollectionClient`.

### Planned: Embeddings Management Routes

Future HTTP routes for operational management:

```
POST /service/embeddings/reindex/:chatId   - Re-index messages for a user
POST /service/embeddings/repair            - Repair/validate collection
GET  /service/embeddings/stats             - Collection statistics
DELETE /service/embeddings/:chatId         - Remove user's embeddings
```

**Use cases:**
- Recovery after Qdrant data loss
- Re-indexing after schema changes
- Bulk cleanup operations
- Debugging and monitoring

See [Memory Schema Enhancements](../architecture/05-memory-schema-enhancements.md) for internal API details.

---

## Related Documentation

- [Architecture Overview](../architecture/01-architecture-overview.md)
- [Memory Schema Enhancements](../architecture/05-memory-schema-enhancements.md)
- [Deployment Guide](../deployment/05-deployment-migration.md)
- [Troubleshooting](../guides/01-troubleshooting.md)

---

**Last Updated**: 2026-01-31
