# n8n Deployment Configuration

This directory contains override configuration for n8n to load custom WhatsApp Bot nodes.

## Local Directory Structure

```
deploy/n8n/
├── docker-compose.override.yml   # Custom nodes volume mount
├── custom-nodes/                 # Mirrors server structure
│   ├── .archive/                 # Backup placeholder
│   ├── README.md                 # Symlink setup instructions
│   └── n8n-nodes-whatsapp-bot -> ../../../packages/whatsapp-n8n-nodes
└── README.md                     # This file
```

The `n8n-nodes-whatsapp-bot` symlink points to `packages/whatsapp-n8n-nodes` which contains the custom `WhatsAppBotTrigger` and `WhatsAppBot` (action) nodes.

## Server Structure

```
/var/www/flow.dater.world/
├── n8n/                              # Symlink to compose-platforms/n8n
│   ├── docker-compose.yml            # Base config (git-tracked elsewhere)
│   └── docker-compose.override.yml   # Custom nodes mount (from this repo)
└── custom-nodes/
    └── n8n-nodes-whatsapp-bot/       # Symlink to wa-chatbot-local package
```

## Deployment

1. Copy the override file to the server:
   ```bash
   scp deploy/n8n/docker-compose.override.yml root@no.flow:/var/www/flow.dater.world/n8n/
   ```

2. Restart n8n:
   ```bash
   ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose up -d --force-recreate"
   ```

3. Verify nodes loaded:
   ```bash
   ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose logs --tail=50 n8n | grep -i codex"
   ```
   Look for: `No codex available for: whatsAppBot` (indicates successful load)

## Custom Nodes

The override mounts custom WhatsApp Bot nodes from:
- **Symlink**: `/var/www/flow.dater.world/custom-nodes/n8n-nodes-whatsapp-bot`
- **Source**: `/var/opt/wa.dt.wrld/packages/whatsapp-n8n-nodes`

### Node Types

| Node | Type | Description |
|------|------|-------------|
| `CUSTOM.whatsAppBotTrigger` | Trigger | Receives webhooks from wwebjs-api |
| `CUSTOM.whatsAppBot` | Action | Sends messages via wwebjs-api |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_CUSTOM_EXTENSIONS` | Path to custom nodes (set in base .env) |
| `N8N_LOG_LEVEL` | Optional: Set to `debug` for troubleshooting |

## Custom Nodes Setup

See [custom-nodes/README.md](custom-nodes/README.md) for symlink setup instructions on the server.

## Related Documentation

- [05-n8n-nodes-deployment.md](../../docs/n8n/05-n8n-nodes-deployment.md) - Full deployment guide
- [packages/whatsapp-n8n-nodes/](../../packages/whatsapp-n8n-nodes/) - Node source code
