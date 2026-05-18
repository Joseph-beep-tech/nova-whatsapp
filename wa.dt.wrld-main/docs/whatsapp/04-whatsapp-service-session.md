# WhatsApp N8N Service - Session Notes

Key learnings from deploying and configuring the whatsapp-service.

## nginx-proxy VIRTUAL_PATH

### The Problem

nginx-proxy's `VIRTUAL_PATH` does **not** support comma-separated values:

```yaml
# WRONG - nginx-proxy treats this as a literal path
- VIRTUAL_PATH=/users,/media,/webhook,/health
```

This generates an invalid nginx config:
```nginx
location /users,/media,/webhook,/health {
    proxy_pass http://upstream;
}
```

### The Solution

Use a single path prefix for all routes:

```yaml
# CORRECT - single prefix
- VIRTUAL_PATH=/service
- VIRTUAL_PORT=3001
```

Then mount all Express routes under that prefix:

```typescript
const router = express.Router();

// Define routes on router
router.get('/health', ...);
router.post('/users/register', ...);

// Mount at /service
app.use('/service', router);
```

**Result:** All endpoints accessible at `/service/*`:
- `https://wa.dater.world/service/health`
- `https://wa.dater.world/service/users/register`
- `https://wa.dater.world/service/media/proxy`

## Health Check Configuration

The Docker health check must use the **internal** path (without `/service` prefix) because it runs inside the container:

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/service/health', ...)"]
```

**Note:** The container listens on port 3001 internally, nginx-proxy routes external traffic.

## Deployment Workflow

### 1. Build Locally
```bash
npm run build -w packages/whatsapp-service
```

### 2. Upload to Server
```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'coverage' \
  --exclude '.env' \
  packages/whatsapp-service/ \
  root@no.flow:/var/www/wa.dater.world/whatsapp-service/
```

### 3. Rebuild and Deploy
```bash
ssh root@no.flow "cd /var/www/wa.dater.world/whatsapp-service && \
  docker compose -f docker-compose.prod.yml build --no-cache whatsapp-service && \
  docker compose -f docker-compose.prod.yml up -d whatsapp-service"
```

### 4. Verify
```bash
curl https://wa.dater.world/service/health
```

## User Management API

New endpoints for managing WhatsApp contacts with tags:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/service/users/register` | Register user with tags |
| GET | `/service/users/list?tag=SOMO` | List users by tag |
| GET | `/service/users/tags` | List all unique tags |
| POST | `/service/users/:chatId/tags` | Add tags to user |
| DELETE | `/service/users/:chatId/tags` | Remove tags |

### Example: Register User to List
```bash
curl -X POST "https://wa.dater.world/service/users/register" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "254722833440@c.us", "tags": ["SOMO"]}'
```

### Example: Query Users by Tag
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://wa.dater.world/service/users/list?tag=SOMO"
```

## Network Architecture

```
Internet
    │
    ▼
nginx-proxy (port 443)
    │
    ├── wa.dater.world/ → wwebjs-api:3000 (WhatsApp Web API)
    │
    └── wa.dater.world/service/* → whatsapp-service:3001
                │
                └── MongoDB (whatsapp-mongodb:27017)
```

### Docker Networks

The service connects to three networks:

```yaml
networks:
  - default           # Internal network with MongoDB
  - proxy             # nginx-proxy network (external)
  - wwebjs-api_default # Access to whatsapp-api (external)
```

## Environment Variables

Required for production:

```bash
API_KEY=<your-api-key>
WHATSAPP_API_URL=http://wwebjs-api:3000  # Docker internal URL
MONGODB_URI=mongodb://mongodb:27017/whatsapp-service
WHATSAPP_SERVICE_ADMIN_USER=admin
WHATSAPP_SERVICE_ADMIN_PASSWORD=<password>
```

## Common Issues

### 1. "Cannot POST /users/register" from external

**Cause:** VIRTUAL_PATH not correctly routing to service

**Fix:** Ensure single path prefix and restart container to regenerate nginx config

### 2. API Key mismatch

**Cause:** Local `.env` has different key than server

**Fix:** Source server's `.env` or use server's API key:
```bash
ssh root@no.flow 'source /path/.env; curl -H "X-API-Key: $API_KEY" ...'
```

### 3. Health check failing after route changes

**Cause:** Health check path doesn't match new route structure

**Fix:** Update health check in docker-compose.prod.yml to use correct path

## Files Changed

| File | Change |
|------|--------|
| `src/index.ts` | Mounted all routes on `/service` prefix using Express Router |
| `docker-compose.prod.yml` | Changed `VIRTUAL_PATH` to `/service` |
| `docs/whatsapp/05-developer-api-guide.md` | Updated all URLs to use `/service` prefix |
