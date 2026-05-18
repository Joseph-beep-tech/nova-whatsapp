# Keycloak Setup Guide

This guide covers setting up Keycloak for the WhatsApp n8n Service dashboard authentication.

## Overview

The service uses Keycloak OIDC authentication with the Backend-for-Frontend (BFF) pattern:
- **Server-side sessions** stored in Redis
- **No tokens in the browser** - only httpOnly cookies
- **Keycloak organizations** for tenant scoping

## Quick Start

### 1. Start Keycloak

```bash
cd deploy/keycloak
cp .env.example .env
# Edit .env with your passwords

docker compose up -d
```

Wait for Keycloak to be ready (check health):
```bash
curl http://localhost:8080/health/ready
```

### 2. Import Realm Configuration

1. Open Keycloak admin console: http://localhost:8080
2. Login with admin credentials (from `.env`)
3. Create a new realm:
   - Click "Create realm"
   - Upload `realm-export.json` or manually configure

### 3. Generate Client Secret

1. Go to Clients → `whatsapp-service`
2. Under Credentials tab, generate a new secret
3. Copy the secret value

### 4. Configure Service

Add to your service `.env`:

```bash
# Enable Keycloak authentication
ENABLE_KEYCLOAK_AUTH=true

# Keycloak configuration
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/dater
KEYCLOAK_CLIENT_ID=whatsapp-service
KEYCLOAK_CLIENT_SECRET=your-generated-secret

# Session configuration
SESSION_SECRET=your-32-char-random-secret
SESSION_TTL_SECONDS=86400

# Service base URL (for callback)
SERVICE_BASE_URL=http://localhost:3001
```

### 5. Create a Test User

1. Go to Users → Add user
2. Set username and email
3. Under Credentials, set a password
4. Under Role mappings, assign roles (e.g., `tenant_admin`)

## Roles

| Role | Description |
|------|-------------|
| `creator_admin` | Platform owner, global access to all tenants |
| `tenant_admin` | Tenant owner, full access to their organization |
| `agent` | Support agent, HITL conversation access |
| `automation_engineer` | Workflow builder, routing configuration |
| `read_only` | Observer, dashboard read-only access |

## Organizations (Tenancy)

Keycloak 24+ organizations provide multi-tenant scoping:

1. Enable organizations in Realm Settings → General
2. Create organizations for each tenant
3. Assign users to organizations
4. The `kc.org` claim in tokens contains the organization ID

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_KEYCLOAK_AUTH` | No | `false` | Enable Keycloak authentication |
| `KEYCLOAK_ISSUER_URL` | Yes* | - | Keycloak realm URL |
| `KEYCLOAK_CLIENT_ID` | No | `whatsapp-service` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | Yes* | - | OIDC client secret |
| `SESSION_SECRET` | Yes* | - | Session signing secret (32+ chars) |
| `SESSION_TTL_SECONDS` | No | `86400` | Session duration (24 hours) |
| `SERVICE_BASE_URL` | No | `http://localhost:3001` | Service URL for callbacks |
| `TOKEN_REFRESH_THRESHOLD` | No | `300` | Refresh tokens if expiring in N seconds |
| `KEYCLOAK_SCOPES` | No | `openid profile email roles` | OIDC scopes |

*Required when `ENABLE_KEYCLOAK_AUTH=true`

## Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/service/auth/login` | Redirect to Keycloak login |
| GET | `/service/auth/callback` | Handle Keycloak callback |
| POST | `/service/auth/logout` | Logout (destroy session) |
| GET | `/service/auth/logout` | Logout with redirect |
| GET | `/service/auth/me` | Get current user info |

### /auth/me Response

```json
{
  "authenticated": true,
  "user": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "roles": ["tenant_admin"],
  "organizationId": "org-uuid",
  "organizationName": "My Organization"
}
```

## Security Notes

### Cookie Configuration

- `httpOnly: true` - No JavaScript access
- `secure: true` - HTTPS only (production)
- `sameSite: 'lax'` - CSRF protection

### Token Storage

- Tokens are stored **server-side only** in Redis
- The browser only has a session cookie (`sid`)
- Refresh tokens are used to maintain sessions

### CSRF Protection

The combination of:
- `SameSite=Lax` cookies
- OIDC state parameter validation
- Server-side session storage

Provides CSRF protection without explicit tokens.

## Troubleshooting

### "OIDC client not initialized"

The service couldn't connect to Keycloak. Check:
- `KEYCLOAK_ISSUER_URL` is correct and reachable
- Keycloak is running and healthy
- Network connectivity between service and Keycloak

### "State mismatch"

The OIDC state validation failed. This can happen if:
- Session expired during login
- Multiple browser tabs trying to login
- CSRF attack attempt

Solution: Clear cookies and try again.

### "Session expired"

The session or tokens have expired. The user needs to login again.

### Redirect Loop

Check that:
- `SERVICE_BASE_URL` matches the actual service URL
- Keycloak redirect URIs include your callback URL
- Cookie domain settings are correct

## Production Checklist

- [ ] Use `KC_HOSTNAME` with your domain (not localhost)
- [ ] Enable HTTPS on Keycloak
- [ ] Set `secure: true` for cookies
- [ ] Generate strong secrets for:
  - `KC_DB_PASSWORD`
  - `KEYCLOAK_ADMIN_PASSWORD`
  - `KEYCLOAK_CLIENT_SECRET`
  - `SESSION_SECRET`
- [ ] Configure proper redirect URIs in Keycloak
- [ ] Set up database backups for Keycloak Postgres
- [ ] Configure session TTL appropriately
- [ ] Review and limit Keycloak admin access

## Deployment

### Local Development

```bash
# 1. Start Keycloak
cd deploy/keycloak
cp .env.example .env
# Edit .env with passwords
docker compose up -d

# 2. Configure service
cd deploy/whatsapp-service
# Add Keycloak env vars to .env (see Configure Service section)

# 3. Rebuild and restart service
docker compose up -d --build
```

### Production Deployment

```bash
# On server
cd /var/opt/wa.dt.wrld

# 1. Deploy Keycloak (first time only)
cd deploy/keycloak
cp .env.example .env
# Edit .env with secure passwords
docker compose up -d

# 2. Configure realm in Keycloak admin console
# - Import realm-export.json
# - Generate client secret
# - Create users and assign roles

# 3. Update service configuration
cd ../whatsapp-service
# Add to .env:
#   ENABLE_KEYCLOAK_AUTH=true
#   KEYCLOAK_ISSUER_URL=https://auth.dater.world/realms/dater
#   KEYCLOAK_CLIENT_ID=whatsapp-service
#   KEYCLOAK_CLIENT_SECRET=<from-keycloak>
#   SESSION_SECRET=<32+-char-random-string>

# 4. Rebuild service
docker compose up -d --build

# 5. Verify
curl https://wa.dater.world/service/auth/status
```

## Disabling Basic Auth Fallback

Once Keycloak is working, you can remove the basic auth fallback by:

1. Removing `WHATSAPP_SERVICE_ADMIN_PASSWORD` from env
2. Setting `ENABLE_KEYCLOAK_AUTH=true`

The admin routes will now only accept Keycloak authentication.
