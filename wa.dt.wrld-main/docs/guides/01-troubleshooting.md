# WhatsApp Bot Troubleshooting Guide

## Overview
This guide provides solutions to common issues encountered during deployment and operation of the WhatsApp bot with n8n integration.

---

## Pre-Deployment Issues

### SSH Connection Problems
**Symptoms**: Cannot connect to `root@no.flow`
**Solutions**:
```bash
# Check SSH key configuration
ssh-add -l

# Test connection with verbose output
ssh -v root@no.flow

# If key auth fails, check permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

### n8n Instance Verification
**Symptoms**: n8n not accessible at `https://flow.dater.world`
**Diagnosis**:
```bash
# Check n8n container status
ssh root@no.flow "docker ps | grep n8n"

# Check nginx-proxy configuration
ssh root@no.flow "docker logs nginx-proxy"
```

---

## Installation Issues

### Node.js Installation Failures
**Symptoms**: Node.js 18 installation fails
**Solutions**:
```bash
# Clear existing Node.js
sudo apt remove nodejs npm -y
sudo apt autoremove -y

# Install using alternative method
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
npm install -g pm2
```

### Permission Errors
**Symptoms**: Permission denied errors during setup
**Solutions**:
```bash
# Fix directory ownership
sudo chown -R root:root /var/www/wa.dater.world/
sudo chmod -R 755 /var/www/wa.dater.world/

# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### Dependency Installation Issues
**Symptoms**: npm install fails with native module errors
**Solutions**:
```bash
# Install build tools
sudo apt update
sudo apt install -y build-essential python3-dev

# Clear npm cache
npm cache clean --force

# Rebuild node modules
rm -rf node_modules package-lock.json
npm install
```

---

## WhatsApp Bot Issues

### QR Code Authentication
**Symptoms**: QR code not generating or authentication failing
**Diagnosis**:
```bash
# Check bot logs
tail -f /var/www/wa.dater.world/whatsapp-web-js/logs/combined.log

# Check PM2 logs
pm2 logs whatsapp-bot

# Test bot health
curl https://wa.dater.world/health
```

**Solutions**:
1. **Clear session data**:
```bash
rm -rf /var/www/wa.dater.world/whatsapp-web-js/.wwebjs_auth
pm2 restart whatsapp-bot
```

2. **Check Puppeteer dependencies**:
```bash
# Install missing dependencies
sudo apt install -y chromium-browser xvfb
```

3. **Get QR code**:
```bash
curl https://wa.dater.world/qr
```

### Connection Drops
**Symptoms**: WhatsApp connection frequently disconnects
**Solutions**:
1. **Check memory usage**:
```bash
pm2 monit  # Check if process is being killed due to memory
```

2. **Increase memory limit**:
```javascript
// In ecosystem.config.js
max_memory_restart: '2G'  // Increase from 1G
```

3. **Check network stability**:
```bash
ping -c 10 google.com  # Test internet connectivity
```

### API Endpoint Issues
**Symptoms**: `/webhook` endpoint not responding
**Diagnosis**:
```bash
# Check if service is running
systemctl status whatsapp-bot

# Check port binding
netstat -tulpn | grep :3000

# Test endpoint directly
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "get_groups"}'
```

---

## n8n Integration Issues

### Webhook Delivery Failures
**Symptoms**: n8n not receiving webhooks from WhatsApp bot
**Diagnosis**:
```bash
# Check n8n webhook logs
ssh root@no.flow "docker logs n8n | grep webhook"

# Test webhook manually
curl -X POST https://flow.dater.world/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Solutions**:
1. **Verify webhook URL configuration**:
```bash
# Check environment variable
grep N8N_WEBHOOK_URL /var/www/wa.dater.world/whatsapp-web-js/.env
```

2. **Check firewall rules**:
```bash
sudo ufw status
# Ensure port 5678 is accessible internally
```

### Workflow Execution Errors
**Symptoms**: n8n workflows fail or don't trigger
**Solutions**:
1. **Check workflow status in n8n UI**
2. **Verify trigger configuration**
3. **Check n8n logs for errors**
4. **Test workflow manually**

---

## Performance Issues

### High Memory Usage
**Symptoms**: Bot consuming excessive memory
**Monitoring**:
```bash
# Check memory usage
free -h
ps aux | grep whatsapp

# PM2 memory monitoring
pm2 monit
```

**Solutions**:
1. **Restart bot regularly**:
```bash
# Add to crontab for daily restart
0 2 * * * pm2 restart whatsapp-bot
```

2. **Optimize Puppeteer options**:
```javascript
// Add to puppeteer config
args: [
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-background-timer-throttling'
]
```

### Slow Response Times
**Symptoms**: API responses are slow
**Diagnosis**:
```bash
# Test response time
time curl https://wa.dater.world/health

# Check system load
uptime
iostat
```

---

## Log Analysis

### Important Log Locations
```bash
# Application logs
tail -f /var/www/wa.dater.world/whatsapp-web-js/logs/combined.log

# Error logs only
tail -f /var/www/wa.dater.world/whatsapp-web-js/logs/error.log

# PM2 logs
pm2 logs whatsapp-bot

# System logs
journalctl -u whatsapp-bot -f

# n8n logs
ssh root@no.flow "docker logs -f n8n"
```

### Common Error Patterns
1. **"QR code timeout"**: Authentication session expired
2. **"ECONNREFUSED"**: Service not running or port blocked
3. **"Session not found"**: WhatsApp session data corrupted
4. **"Rate limit exceeded"**: Too many requests to WhatsApp
5. **"Webhook timeout"**: n8n not responding to webhooks

---

## Recovery Procedures

### Complete Service Restart
```bash
# Stop all services
pm2 stop whatsapp-bot
systemctl stop whatsapp-bot

# Clear temporary data
rm -rf /tmp/whatsapp-*

# Restart services
systemctl start whatsapp-bot
pm2 start ecosystem.config.js
```

### Rollback to Previous Version
```bash
# Stop current service
systemctl stop whatsapp-bot

# Restore from backup
rsync -av /var/backups/whatsapp-bot/[latest]/ /var/www/wa.dater.world/whatsapp-web-js/

# Restart service
systemctl start whatsapp-bot
```

### Emergency Shutdown
```bash
# If bot is behaving erratically
pm2 kill
systemctl stop whatsapp-bot
```

---

## Contact and Support

### Log Collection for Support
```bash
# Collect all relevant logs
mkdir /tmp/whatsapp-bot-logs
cp /var/www/wa.dater.world/whatsapp-web-js/logs/* /tmp/whatsapp-bot-logs/
pm2 logs whatsapp-bot > /tmp/whatsapp-bot-logs/pm2.log
journalctl -u whatsapp-bot --since "1 hour ago" > /tmp/whatsapp-bot-logs/systemd.log
tar -czf whatsapp-bot-logs-$(date +%Y%m%d_%H%M%S).tar.gz -C /tmp whatsapp-bot-logs
```

### System Information
```bash
# Collect system info for troubleshooting
uname -a
node --version
npm --version
pm2 --version
systemctl --version
docker --version
free -h
df -h
```

---

**Last Updated**: [Current Date]  
**Maintained By**: Claude Code Assistant