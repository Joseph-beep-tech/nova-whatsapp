# MongoDB Integration for WhatsApp n8n Service

**Date**: November 2024
**Status**: ✅ Complete

---

## Overview

Replaced JSON file-based state storage with MongoDB for better scalability, query capabilities, and integration with Express ecosystem.

---

## What Changed

### Before (JSON Files)
- State stored in `data/state.json`
- File-based persistence with debounced writes
- No query capabilities
- Manual data structure management

### After (MongoDB)
- State stored in MongoDB collections
- Atomic operations with Mongoose ORM
- Full query and indexing capabilities
- Browsable via MongoDB Compass or other tools
- Easy Express integration

---

## Architecture

```
whatsapp-service (Express)
         ↓
stateManager (Singleton)
         ↓
Mongoose Models (Webhook, Config)
         ↓
MongoDB Container (mongo:7-jammy)
         ↓
Persistent Volume (mongodb-data)
```

---

## MongoDB Schema

### Collections

#### 1. `webhooks` Collection

Stores n8n webhook registrations per session.

**Schema**:
```typescript
{
  sessionId: string;      // WhatsApp session ID
  url: string;            // n8n webhook URL
  events: string[];       // Event types to forward
  registeredAt: Date;     // Registration timestamp
}
```

**Indexes**:
- `sessionId` (indexed)
- `sessionId + url` (compound unique index)

**TypeScript Interface**:
```typescript
interface IWebhook extends Document {
  sessionId: string;
  url: string;
  events: string[];
  registeredAt: Date;
}
```

#### 2. `configs` Collection

Stores application configuration key-value pairs.

**Schema**:
```typescript
{
  key: string;        // Config key
  value: any;         // Config value (mixed type)
  updatedAt: Date;    // Last update timestamp
}
```

**Indexes**:
- `key` (unique)

**TypeScript Interface**:
```typescript
interface IConfig extends Document {
  key: string;
  value: any;
  updatedAt: Date;
}
```

---

## StateManager API

### Initialization

```typescript
import { stateManager } from './utils/stateManager';

async function startServer() {
  await stateManager.init();  // Connect to MongoDB
  // ... start Express server
}
```

### Webhook Operations

```typescript
// Register webhook
await stateManager.registerWebhook(
  'default',
  'https://flow.dater.world/webhook/my-trigger',
  ['message', 'group_join']
);

// Get webhooks for session
const webhooks = await stateManager.getWebhooks('default');
// Returns: [{ url, events, registeredAt }, ...]

// Unregister webhook
await stateManager.unregisterWebhook(
  'default',
  'https://flow.dater.world/webhook/my-trigger'
);

// Get all webhooks (all sessions)
const allWebhooks = await stateManager.getAllWebhooks();
// Returns: { sessionId: [{ url, events, registeredAt }, ...], ... }
```

### Config Operations

```typescript
// Set config
await stateManager.setConfig('feature_flag_x', true);

// Get config
const value = await stateManager.getConfig('feature_flag_x', false);

// Get all config
const config = await stateManager.getAllConfig();
// Returns: { key1: value1, key2: value2, ... }
```

### State Inspection

```typescript
// Get full state (for debugging)
const state = await stateManager.getState();
// Returns: { webhooks: {...}, config: {...}, lastUpdated: ISO8601 }
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await stateManager.close();  // Close MongoDB connection
  process.exit(0);
});
```

---

## Docker Configuration

### MongoDB Service

Added to [docker-compose.yml](../../docker-compose.yml):

```yaml
mongodb:
  image: mongo:7-jammy
  container_name: whatsapp-mongodb
  restart: unless-stopped
  environment:
    - MONGO_INITDB_DATABASE=whatsapp-service
  volumes:
    - mongodb-data:/data/db
  networks:
    - whatsapp-network
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 20s
```

### WhatsApp n8n Service Dependency

```yaml
whatsapp-service:
  depends_on:
    whatsapp-api:
      condition: service_healthy
    mongodb:
      condition: service_healthy  # Wait for MongoDB
  environment:
    - MONGODB_URI=mongodb://mongodb:27017/whatsapp-service
```

### Persistent Volume

```yaml
volumes:
  mongodb-data:
    driver: local
```

---

## Environment Variables

### `.env` Configuration

```bash
# MongoDB Configuration
# Used for webhook registrations and config storage
MONGODB_URI=mongodb://mongodb:27017/whatsapp-service
```

**Default**: `mongodb://mongodb:27017/whatsapp-service`
**Production**: Same (uses Docker service name)
**Local Development**: `mongodb://localhost:27017/whatsapp-service`

---

## Connection Management

### Features

1. **Automatic Reconnection**
   - Mongoose handles reconnection automatically
   - Connection events logged (disconnected, reconnected, error)

2. **Connection Pooling**
   - Default Mongoose connection pool
   - Configurable via connection options

3. **Healthcheck**
   - `isConnected` flag tracks connection state
   - `ensureConnected()` throws error if not connected

4. **Graceful Shutdown**
   - `stateManager.close()` closes connection cleanly
   - Integrated with SIGINT/SIGTERM handlers

### Connection Options

```typescript
await mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

---

## TypeScript-First Design

### Principle: Types Define Structure

MongoDB schema mirrors TypeScript interfaces:

1. **Define TypeScript interface** (source of truth)
```typescript
interface IWebhook extends Document {
  sessionId: string;
  url: string;
  events: string[];
  registeredAt: Date;
}
```

2. **Create Mongoose schema** (mirrors interface)
```typescript
const webhookSchema = new Schema<IWebhook>({
  sessionId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  events: { type: [String], required: true },
  registeredAt: { type: Date, default: Date.now },
});
```

3. **TypeScript ensures consistency**
   - Compile-time checks
   - IDE autocomplete
   - Refactoring safety

---

## Dependencies

### Production

```json
{
  "mongoose": "^8.1.0"
}
```

### Development

- `@types/node` - Already included (Node.js types)
- Mongoose includes its own TypeScript definitions

---

## Migration from JSON Files

### For Existing Deployments

1. **No data migration needed** - fresh start with MongoDB
2. **Webhooks must be re-registered** via n8n trigger nodes
3. **Config will use defaults** until explicitly set

### Process

1. Update `.env` with `MONGODB_URI`
2. Deploy updated docker-compose.yml
3. MongoDB container will start automatically
4. whatsapp-service will connect on startup
5. Re-activate n8n trigger nodes to register webhooks

---

## Querying Data

### Via MongoDB Compass

Connection string: `mongodb://localhost:27017` (if exposing port)

Database: `whatsapp-service`
Collections: `webhooks`, `configs`

### Via mongosh (CLI)

```bash
docker exec -it whatsapp-mongodb mongosh

use whatsapp-service

# View webhooks
db.webhooks.find().pretty()

# View configs
db.configs.find().pretty()

# Count webhooks per session
db.webhooks.aggregate([
  { $group: { _id: "$sessionId", count: { $sum: 1 } } }
])
```

### Via Mongoose (Code)

```typescript
import { Webhook, Config } from './utils/stateManager';

// Direct Mongoose queries
const webhooks = await Webhook.find({ sessionId: 'default' });
const count = await Webhook.countDocuments({ sessionId: 'default' });
```

---

## Benefits

### Scalability
- ✅ Handles thousands of webhooks efficiently
- ✅ Indexed queries for fast lookups
- ✅ Connection pooling for concurrent requests

### Developer Experience
- ✅ TypeScript-first design
- ✅ Browsable via Compass or mongosh
- ✅ Familiar Mongoose API
- ✅ Easy integration with Express

### Reliability
- ✅ Atomic operations (no race conditions)
- ✅ Automatic reconnection
- ✅ Transaction support (if needed later)

### Operations
- ✅ Standard Docker container
- ✅ Persistent volume for data
- ✅ Healthchecks integrated
- ✅ Easy backup/restore (mongodump/mongorestore)

---

## Related Documentation

- [FINAL_ARCHITECTURE_SUMMARY.md](FINAL_ARCHITECTURE_SUMMARY.md) - Complete architecture overview
- [N8N_INTEGRATION.md](../n8n/N8N_INTEGRATION.md) - Webhook registration guide
- [../../docker-compose.yml](../../docker-compose.yml) - Docker orchestration
- [../../.env.example](../../.env.example) - Environment variables

---

## Future Enhancements

### Potential Additions

1. **MongoDB Authentication**
   - Add MONGO_INITDB_ROOT_USERNAME/PASSWORD
   - Create app-specific user with limited permissions

2. **Replication**
   - MongoDB replica set for high availability
   - Automatic failover

3. **Monitoring**
   - MongoDB metrics export (Prometheus)
   - Query performance monitoring

4. **Backup**
   - Automated mongodump cronjob
   - S3 backup storage

---

**Last Updated**: November 22, 2024
**Version**: whatsapp-service v2.0.0
