# n8n Custom Nodes Deployment Guide

## Overview

This guide documents the deployment process for the WhatsApp Bot n8n custom nodes (`packages/whatsapp-n8n-nodes`) to a remote n8n server. It includes lessons learned from production deployments and troubleshooting guidance.

## Prerequisites

### Local Machine
- Node.js 18+ and npm
- SSH access to the remote server
- Built package (`npm run build` in packages/whatsapp-n8n-nodes)

### Remote Server
- Docker and Docker Compose
- n8n running in Docker container
- SSH access configured

## Quick Start

```bash
# From packages/whatsapp-n8n-nodes directory
npm run build              # Build the package
npm run deploy             # Deploy to remote server

# Other deployment options
npm run deploy:verify      # Verify remote setup only
npm run deploy:backup      # Backup current deployment only
```

## Deployment Script

### Location
```
packages/whatsapp-n8n-nodes/deploy/
├── deploy.ts           # Main deployment script
├── config.ts           # Deployment configuration (gitignored)
├── config.example.ts   # Example configuration template
└── logs/               # Deployment logs (auto-created)
```

### Configuration

Copy `config.example.ts` to `config.ts` and update:

```typescript
export const deployConfig: DeployConfig = {
  ssh: {
    host: 'your.server.com',
    user: 'root',
    privateKeyPath: '~/.ssh/id_rsa',  // Recommended for macOS
  },
  remote: {
    n8nPath: '/var/www/your-n8n.example.com/n8n',
    customNodesPath: '/var/www/your-n8n.example.com/custom-nodes',
    nodeName: 'n8n-nodes-whatsapp-bot',
  },
  local: {
    distPath: './dist',
    packageJson: './package.json',
  },
  backup: {
    enabled: true,
    maxBackups: 5,
  },
};
```

### What the Script Does

1. **Pre-flight checks**
   - Verifies local `dist/` folder exists
   - Tests SSH connectivity
   - Checks remote directories exist
   - Validates docker-compose.yml has custom nodes configuration
   - Checks `.env` for `N8N_CUSTOM_EXTENSIONS`

2. **Backup** (if enabled)
   - Creates timestamped backup of existing deployment
   - Rotates old backups (keeps last N)

3. **Deploy**
   - Cleans remote directory
   - Uploads `dist/` folder and `package.json`
   - Installs production dependencies
   - Sets permissions (UID 1000 for n8n node user)

4. **Post-deployment**
   - Restarts n8n container
   - Verifies container is running
   - Checks logs for successful node loading

5. **Rollback** (on failure)
   - Restores from backup automatically
   - Restarts n8n with previous version

## Server Configuration

### docker-compose.override.yml

Create an override file (keeps git-tracked docker-compose.yml unchanged):

```yaml
# /var/www/flow.dater.world/n8n/docker-compose.override.yml
services:
  n8n:
    volumes:
      # Mount custom nodes directory
      - ../custom-nodes/n8n-nodes-whatsapp-bot:/home/node/.n8n/custom/n8n-nodes-whatsapp-bot
    environment:
      # Tell n8n where to find custom nodes
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
      - N8N_LOG_LEVEL  # Optional: for debugging
```

**Note:** Docker Compose automatically merges `docker-compose.override.yml` with `docker-compose.yml` when running `docker compose up`.

### .env File

If using docker-compose.override.yml or env_file:

```bash
N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
N8N_LOG_LEVEL=debug  # Optional: for troubleshooting
```

### Directory Structure on Server

```
/var/www/your-n8n.example.com/
├── n8n/
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml  (optional)
│   └── .env
└── custom-nodes/
    └── n8n-nodes-whatsapp-bot/
        ├── dist/
        │   ├── credentials/
        │   ├── nodes/
        │   └── types/
        ├── package.json
        └── node_modules/
```

## Key Learnings

### SSH Authentication on macOS

macOS uses Keychain for SSH keys, which may not load them into the SSH agent automatically. If deployment fails with "All configured authentication methods failed":

```typescript
// config.ts - Use explicit key path
ssh: {
  host: 'your.server.com',
  user: 'root',
  privateKeyPath: '~/.ssh/id_rsa',  // Explicit path
}
```

### npm Not Available on Server

Some servers don't have npm installed directly. The deployment script handles this by:

1. First trying `npm install` on the server
2. Falling back to `docker compose exec -T n8n npm install` inside the container

```typescript
// From deploy.ts - npm fallback logic
const npmCheckResult = await ssh.execCommand('which npm 2>/dev/null');

if (npmCheckResult.code === 0) {
  // Use server npm
  await ssh.execCommand(`cd ${remotePath} && npm install --production`);
} else {
  // Use npm inside n8n container
  const containerPath = `/home/node/.n8n/custom/${config.remote.nodeName}`;
  await ssh.execCommand(
    `cd ${config.remote.n8nPath} && docker compose exec -T n8n sh -c "cd ${containerPath} && npm install --production"`
  );
}
```

### "No codex available" Warning

When n8n logs show this warning, it means the nodes ARE loaded successfully:

```
No codex available for: whatsAppBot
No codex available for: whatsAppBotTrigger
```

This is a normal warning indicating no AI documentation exists for the node - not an error.

### File Permissions

n8n runs as user `node` (UID 1000) inside the Docker container. Files must be owned by this user:

```bash
chown -R 1000:1000 /path/to/custom-nodes/n8n-nodes-whatsapp-bot
```

### package.json Requirements

The package.json must include:

```json
{
  "name": "n8n-nodes-whatsapp-bot",
  "keywords": [
    "n8n-community-node-package"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/WhatsAppBotApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/WhatsAppBot/WhatsAppBot.node.js",
      "dist/nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node.js"
    ]
  }
}
```

## Troubleshooting

### Node Not Appearing in n8n UI

1. **Check n8n logs for loading errors:**
   ```bash
   ssh root@server "cd /var/www/your-n8n.example.com/n8n && docker compose logs --tail=100 n8n | grep -i 'custom\|whatsapp\|error'"
   ```

2. **Verify environment variable:**
   ```bash
   ssh root@server "cd /var/www/your-n8n.example.com/n8n && docker compose exec n8n printenv | grep N8N"
   ```

3. **Check file permissions:**
   ```bash
   ssh root@server "ls -la /var/www/your-n8n.example.com/custom-nodes/n8n-nodes-whatsapp-bot/"
   ```

4. **Verify volume mount:**
   ```bash
   ssh root@server "docker compose exec n8n ls -la /home/node/.n8n/custom/"
   ```

### Credential Test Fails

1. **Test wwebjs-api directly:**
   ```bash
   # From inside n8n container
   curl -X GET "http://wwebjs-api:3000/health" -H "x-api-key: YOUR_API_KEY"
   ```

2. **Verify Docker network:**
   ```bash
   docker network ls
   docker inspect n8n_default  # or your network name
   ```

### Deployment Script Fails

1. **SSH connection issues:**
   ```bash
   # Test SSH manually
   ssh -v root@server "echo connected"

   # Check SSH agent
   ssh-add -l
   ```

2. **Pre-flight check failures:**
   ```bash
   npm run deploy:verify  # Run verification only
   ```

3. **Check deployment logs:**
   ```bash
   ls -la packages/whatsapp-n8n-nodes/deploy/logs/
   cat packages/whatsapp-n8n-nodes/deploy/logs/deploy-*.log | tail -100
   ```

## Manual Deployment

If the automated script fails, deploy manually:

```bash
# 1. Build locally
cd packages/whatsapp-n8n-nodes
npm run build

# 2. Copy files to server
scp -r dist root@server:/var/www/your-n8n.example.com/custom-nodes/n8n-nodes-whatsapp-bot/
scp package.json root@server:/var/www/your-n8n.example.com/custom-nodes/n8n-nodes-whatsapp-bot/

# 3. SSH to server
ssh root@server

# 4. Install dependencies (inside container)
cd /var/www/your-n8n.example.com/n8n
docker compose exec -T n8n sh -c "cd /home/node/.n8n/custom/n8n-nodes-whatsapp-bot && npm install --production"

# 5. Set permissions
chown -R 1000:1000 /var/www/your-n8n.example.com/custom-nodes/n8n-nodes-whatsapp-bot

# 6. Restart n8n
docker compose restart n8n

# 7. Check logs
docker compose logs -f n8n | grep -i "whatsapp\|custom"
```

## Verification Steps

After deployment, verify the installation:

1. **Open n8n UI** at your n8n URL
2. **Create new workflow**
3. **Search for "WhatsApp Bot"** - both trigger and action nodes should appear
4. **Configure credentials:**
   - Server URL: `http://wwebjs-api:3000` (Docker internal)
   - API Key: Your x-api-key
   - Session ID: Your session name
5. **Test trigger node** by sending a WhatsApp message
6. **Test action node** by sending a reply

## Related Documentation

- [01-n8n-integration-v2.md](01-n8n-integration-v2.md) - n8n 2.x integration guide
- [02-n8n-node-development.md](02-n8n-node-development.md) - Node development patterns
- [03-n8n-compatibility-fixes.md](03-n8n-compatibility-fixes.md) - Compatibility fixes
