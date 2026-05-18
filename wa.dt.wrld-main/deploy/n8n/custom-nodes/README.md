# n8n Custom Nodes Directory

This directory structure mirrors the server's `/var/www/flow.dater.world/custom-nodes/`.

## Server Structure

```
/var/www/flow.dater.world/custom-nodes/
├── .archive/                         # Backup of previous deployments
│   └── n8n-nodes-whatsapp-bot.YYYYMMDD-HHMMSS/
└── n8n-nodes-whatsapp-bot -> /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes
```

## Setup on Server

Create the symlink to the monorepo package:

```bash
# Create symlink from custom-nodes to repo package
ln -s /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes \
      /var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot

# Set permissions for n8n container (UID 1000)
chown -R 1000:1000 /var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes
```

## Archive

When redeploying, the previous deployment is archived:

```bash
# Archive existing before creating new symlink
mv /var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot \
   /var/www/flow.dater.world/custom-nodes/.archive/n8n-nodes-whatsapp-bot.$(date +%Y%m%d-%H%M%S)
```

## Volume Mount

The docker-compose.override.yml mounts this directory into n8n:

```yaml
volumes:
  - ../custom-nodes/n8n-nodes-whatsapp-bot:/home/node/.n8n/custom/n8n-nodes-whatsapp-bot
```
