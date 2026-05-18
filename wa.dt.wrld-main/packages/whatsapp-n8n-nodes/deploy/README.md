# n8n Custom Nodes Deployment Script

Automated deployment script for the whatsapp-n8n-nodes package.

Based on [n8n docs: Install Private Nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/install-private-nodes/).

## Setup

1. Copy the example config:
   ```bash
   cp deploy/config.example.ts deploy/config.ts
   ```

2. Edit `deploy/config.ts` with your server details:
   ```typescript
   export const deployConfig = {
     ssh: {
       host: 'your-server',
       user: 'root',
     },
     remote: {
       n8nPath: '/path/to/n8n',
       customNodesPath: '/path/to/custom-nodes',
       nodeName: 'n8n-nodes-whatsapp-bot',
     },
     // ...
   };
   ```

3. Install deployment dependencies:
   ```bash
   npm install node-ssh --save-dev
   ```

## Usage

### Full Deployment
```bash
npm run deploy
```

This will:
1. Run pre-flight checks (verify local build exists)
2. Connect to remote server via SSH
3. Verify remote directory structure and docker-compose.yml config
4. Backup existing deployment (if enabled)
5. Upload dist folder and package.json
6. Install production dependencies (`npm install --production`)
7. Set correct permissions (chown to UID 1000 for n8n's node user)
8. Restart n8n container
9. Verify n8n loaded custom nodes

### Backup Only
```bash
npm run deploy:backup
```

Creates a backup of the current deployment without deploying new files.

### Verify Only
```bash
npm run deploy:verify
```

Verifies SSH connection and remote directory structure without making changes.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `ssh.host` | Remote server hostname | `no.flow` |
| `ssh.user` | SSH username | `root` |
| `ssh.privateKeyPath` | Path to SSH private key | Uses SSH agent |
| `remote.n8nPath` | Path to n8n installation | `/var/www/flow.dater.world/n8n` |
| `remote.customNodesPath` | Path to custom nodes | `/var/www/flow.dater.world/custom-nodes` |
| `remote.nodeName` | Node package name | `n8n-nodes-whatsapp-bot` |
| `backup.enabled` | Enable automatic backups | `true` |
| `backup.maxBackups` | Number of backups to keep | `5` |

## Logs

Deployment logs are saved to:
```
deploy/logs/deploy-{timestamp}.log
```

## Troubleshooting

### SSH Connection Failed
- Ensure your SSH key is loaded: `ssh-add -l`
- Try connecting manually: `ssh root@no.flow`
- Check firewall rules on the remote server

### Pre-flight Check Failed
- Run `npm run build` to create the dist folder
- Verify package.json exists in the package root

### n8n Not Loading Custom Nodes
1. Check n8n logs:
   ```bash
   ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose logs -f n8n"
   ```

2. Verify docker-compose.yml has:
   ```yaml
   volumes:
     - ../custom-nodes:/home/node/.n8n/custom
   environment:
     - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
   ```

3. Restart n8n manually:
   ```bash
   ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose restart n8n"
   ```

### Rollback
If deployment fails, the script automatically rolls back to the previous backup.

To manually rollback:
```bash
ssh root@no.flow
cd /var/www/flow.dater.world/custom-nodes
rm -rf n8n-nodes-whatsapp-bot
mv n8n-nodes-whatsapp-bot.backup.{timestamp} n8n-nodes-whatsapp-bot
cd ../n8n && docker compose restart n8n
```
