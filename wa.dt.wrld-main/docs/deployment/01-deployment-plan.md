# WhatsApp Bot Deployment Plan - dater.world

This document provides deployment instructions for the WhatsApp Bot with n8n integration to the dater.world production environment.

## Pre-Deployment Checklist

Before deploying to production, ensure all local development is complete:

```bash
# Validate local build
npm run build
npm run type-check
npm test

# Ensure git is clean
git status
```

## GitHub Actions Workflow

### Automated CI/CD Pipeline

The GitHub Actions workflow provides automated deployment with the following stages:

**1. Continuous Integration**
- Triggered on push to `main` branch and pull requests
- Runs TypeScript compilation and type checking
- Executes full test suite (unit, integration, API tests)
- Builds n8n node package
- Validates n8n node compatibility

**2. Build Process**
- Creates production build artifacts
- Compiles TypeScript to JavaScript
- Bundles n8n nodes for distribution
- Generates source maps and declarations

**3. Deployment Triggers**
- **Development**: Auto-deploy on merge to `develop` branch
- **Production**: Manual approval required for `main` branch
- **Rollback**: Tagged releases for version management

**4. Environment-Specific Deployments**
- Separate workflows for staging and production
- Environment-specific configuration validation
- Health check verification post-deployment

**5. Security & Secrets Management**
- Encrypted secrets for server access
- Environment variable validation
- SSL certificate deployment
- Database connection testing

## Server Deployment Options

### Option 1: Git-Based Deployment (Recommended)

```bash
# Push to GitHub repository
git add .
git commit -m "Production deployment ready"
git push origin main

# On dater.world server
ssh root@no.flow
cd /var/www/wa.dater.world/
git pull origin main
npm install --production
cd n8n-nodes && npm install --production
systemctl restart whatsapp-bot
```

### Option 2: Direct rsync Deployment

```bash
# Direct file transfer (backup method)
rsync -av --exclude='.git' --exclude='node_modules' \
  /Users/kago/space/dater.local/wa-chatbot-local/ \
  root@no.flow:/var/www/wa.dater.world/whatsapp-web-js/
```

## Production Configuration

### Environment Setup

1. **Copy environment template**
   ```bash
   ssh root@no.flow
   cd /var/www/wa.dater.world/whatsapp-web-js/
   cp .env.example .env
   # Edit with production values
   ```

2. **Install dependencies**
   ```bash
   npm install --production
   ```

3. **Build production assets**
   ```bash
   npm run build
   ```

## n8n Node Installation

### Installing Custom Nodes in Production n8n

1. **Package the n8n nodes**
   ```bash
   cd packages/whatsapp-n8n-nodes
   npm pack
   # Creates @dater-n8n-nodes-whatsapp-bot-1.0.0.tgz
   ```

2. **Install in n8n instance**
   ```bash
   # Copy package to n8n server
   scp packages/whatsapp-n8n-nodes/@dater-n8n-nodes-whatsapp-bot-1.0.0.tgz root@no.flow:/tmp/

   # Install in n8n
   ssh root@no.flow
   cd /path/to/n8n/installation
   npm install /tmp/@dater-n8n-nodes-whatsapp-bot-1.0.0.tgz
   # Restart n8n service
   ```

3. **Verify node installation**
   - Access https://flow.dater.world
   - Check for WhatsApp Bot nodes in node palette
   - Test credential configuration
   - Validate webhook connectivity

## Service Management

### PM2 Configuration

```bash
# Start WhatsApp bot with PM2
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 status
pm2 logs whatsapp-bot

# Save PM2 configuration
pm2 save
pm2 startup
```

### Systemd Service

```bash
# Enable systemd service
systemctl enable whatsapp-bot
systemctl start whatsapp-bot
systemctl status whatsapp-bot

# View logs
journalctl -u whatsapp-bot -f
```

## Post-Deployment Verification

### Health Checks

```bash
# Service health
curl https://wa.dater.world/health

# WhatsApp authentication status
curl -u "admin:password" https://wa.dater.world/qr

# n8n connectivity
curl -X POST https://flow.dater.world/webhook/test
```

### Integration Testing

1. **WhatsApp Connection**
   - Verify QR code generation
   - Test message sending/receiving
   - Validate group functionality

2. **n8n Integration**
   - Test webhook from WhatsApp → n8n
   - Test API calls from n8n → WhatsApp
   - Verify credential authentication

3. **End-to-End Flow**
   - Send message to WhatsApp bot
   - Verify n8n workflow triggers
   - Confirm automated responses

## SECRETS/DATER_WORLD_SPECIFIC_CONFIGS

### Server File System Structure

**Primary Application Path**
```bash
/var/www/wa.dater.world/whatsapp-web-js/
├── packages/
│   ├── whatsapp-service/  # Main WhatsApp bot service
│   └── whatsapp-n8n-nodes/  # Custom n8n nodes package
├── docs/                  # Documentation
├── config/                # Configuration files
├── logs/                  # Application logs
├── .sessions/             # WhatsApp session storage
├── .env                   # Production environment variables
└── node_modules/          # Dependencies
```

**System Service Paths**
```bash
/etc/systemd/system/whatsapp-bot.service    # Systemd service file
/var/log/whatsapp-bot/                      # System logs
/etc/nginx/sites-available/wa.dater.world   # Nginx configuration
```

### File System Commands

**Deployment Commands**
```bash
# Backup current deployment
cp -r /var/www/wa.dater.world/whatsapp-web-js \
      /var/www/wa.dater.world/whatsapp-web-js.backup.$(date +%Y%m%d_%H%M%S)

# Set proper ownership and permissions
chown -R www-data:www-data /var/www/wa.dater.world/whatsapp-web-js/
chmod 755 /var/www/wa.dater.world/whatsapp-web-js/
chmod 644 /var/www/wa.dater.world/whatsapp-web-js/.env
chmod +x /var/www/wa.dater.world/whatsapp-web-js/dist/bot/index.js

# Create necessary directories
mkdir -p /var/www/wa.dater.world/whatsapp-web-js/logs
mkdir -p /var/www/wa.dater.world/whatsapp-web-js/.sessions
chmod 750 /var/www/wa.dater.world/whatsapp-web-js/.sessions
```

**Log Management**
```bash
# Create log rotation
cat > /etc/logrotate.d/whatsapp-bot << EOF
/var/www/wa.dater.world/whatsapp-web-js/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF
```

### Production Environment Variables

**Critical Secrets (.env)**
```bash
# Production URLs
WEBHOOK_URL=https://wa.dater.world
N8N_WEBHOOK_URL=https://flow.dater.world
N8N_BASE_URL=https://flow.dater.world

# Security Keys (CHANGE THESE)
SESSION_SECRET=dater_world_session_secret_change_this
API_KEY=dater_world_api_key_change_this
QR_AUTH_USERNAME=admin
QR_AUTH_PASSWORD=dater_world_qr_password_change_this
N8N_API_KEY=n8n_api_key_change_this

# Database Connections
REDIS_URL=redis://whatsapp_redis:6379

# File Paths (dater.world specific)
LOG_FILE=/var/www/wa.dater.world/whatsapp-web-js/logs/whatsapp-bot.log
WHATSAPP_SESSION_NAME=dater-world-whatsapp-session

# SSL/Domain Configuration
VIRTUAL_HOST=wa.dater.world
LETSENCRYPT_HOST=wa.dater.world
LETSENCRYPT_EMAIL=admin@dater.world
```

### Docker Configuration (if applicable)

**Docker Compose Override**
```bash
# /var/www/wa.dater.world/docker-compose.override.yml
version: '3.8'
services:
  whatsapp-bot:
    environment:
      - VIRTUAL_HOST=wa.dater.world
      - LETSENCRYPT_HOST=wa.dater.world
      - LETSENCRYPT_EMAIL=admin@dater.world
    volumes:
      - /var/www/wa.dater.world/whatsapp-web-js:/app
      - /var/www/wa.dater.world/logs:/app/logs
```

### Nginx Configuration

**Site Configuration**
```bash
# /etc/nginx/sites-available/wa.dater.world
server {
    server_name wa.dater.world;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Configuration

**Redis Configuration**
```bash
# Redis configuration for WhatsApp sessions
# Default: redis://whatsapp_redis:6379
# Production database: 1 (to separate from other services)
REDIS_URL=redis://whatsapp_redis:6379/1
```

**PostgreSQL (n8n workflows)**
```bash
# n8n database connection (if separate from default n8n config)
N8N_DB_TYPE=postgresdb
N8N_DB_POSTGRESDB_HOST=localhost
N8N_DB_POSTGRESDB_PORT=5432
N8N_DB_POSTGRESDB_DATABASE=n8n_dater_world
N8N_DB_POSTGRESDB_USER=n8n_user
N8N_DB_POSTGRESDB_PASSWORD=secure_password_change_this
```

### SSL Certificate Management

**Let's Encrypt Setup**
```bash
# Ensure certificates for wa.dater.world
certbot certonly --webroot -w /var/www/wa.dater.world -d wa.dater.world
```

### Monitoring and Alerts

**Health Check Endpoints**
```bash
# Add to monitoring system
https://wa.dater.world/health         # Application health
https://flow.dater.world/healthz      # n8n health
```

## Rollback Procedures

### Quick Rollback

```bash
# Stop current service
systemctl stop whatsapp-bot

# Restore from backup
rm -rf /var/www/wa.dater.world/whatsapp-web-js
mv /var/www/wa.dater.world/whatsapp-web-js.backup.YYYYMMDD_HHMMSS \
   /var/www/wa.dater.world/whatsapp-web-js

# Restart service
systemctl start whatsapp-bot
```

### Git-Based Rollback

```bash
# Rollback to previous commit
cd /var/www/wa.dater.world/whatsapp-web-js
git log --oneline -10  # Find commit to rollback to
git reset --hard <commit-hash>
npm install --production
npm run build
systemctl restart whatsapp-bot
```
