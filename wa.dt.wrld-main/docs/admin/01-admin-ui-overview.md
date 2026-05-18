# Admin UI Overview

The WhatsApp n8n Service includes a simple admin UI for monitoring sessions and viewing logs.

## Pages

| Route | Description |
|-------|-------------|
| `/service/admin/sessions` | View WhatsApp session status |
| `/service/admin/logs` | View system logs |
| `/service/admin` | Redirects to sessions page |

## Authentication

Admin pages are protected by HTTP Basic Authentication.

### Configuration

Set these environment variables:

```bash
WHATSAPP_SERVICE_ADMIN_USER=admin        # Username (default: admin)
WHATSAPP_SERVICE_ADMIN_PASSWORD=secret   # Required - no default
```

**Important:** If `WHATSAPP_SERVICE_ADMIN_PASSWORD` is not set, the admin UI is disabled entirely.

### Accessing the UI

1. Navigate to `https://your-domain/service/admin/sessions`
2. Enter username and password when prompted
3. Browser caches credentials for the session

### Programmatic Access

For scripts or monitoring tools, embed credentials in the URL:

```bash
curl -u admin:secret https://your-domain/service/admin/sessions
# Or
curl https://admin:secret@your-domain/service/admin/sessions
```

---

## Sessions Page

**Route:** `/service/admin/sessions`

Displays all active WhatsApp sessions with their status.

### Features

- **Auto-refresh:** Updates every 10 seconds
- **Manual refresh:** Click "Refresh" button
- **Session cards:** Show session ID, status, connection state
- **QR code links:** For sessions awaiting authentication

### Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| `connected` / `ready` | Green | Session is active |
| `authenticated` | Green | Logged in, initializing |
| `qr` | Yellow | Waiting for QR scan |
| `loading` | Blue | Starting up |
| `disconnected` | Red | Session lost |

---

## Logs Page

**Route:** `/service/admin/logs`

Real-time log viewer with filtering capabilities.

### Features

- **Auto-scroll:** Toggle to follow new logs
- **Level filter:** Show all, errors, warnings, info, or debug
- **Entry count:** Shows number of visible entries
- **Clear logs:** Remove all current entries

### Log Levels

| Level | Color | Description |
|-------|-------|-------------|
| `error` | Red | Errors requiring attention |
| `warn` | Yellow | Warnings about potential issues |
| `info` | Blue | Informational messages |
| `debug` | Gray | Detailed debug output |

---

## Technical Details

### Styling

The admin UI uses locally-bundled Tailwind CSS (not CDN) for CSP compliance.

**Build CSS:**
```bash
cd packages/whatsapp-service
npm run build:css
```

The generated CSS is committed to the repository at `src/views/styles.css`.

### File Locations

```
packages/whatsapp-service/
├── src/
│   ├── routes/admin.ts       # Route handlers
│   ├── middleware/basicAuth.ts  # Authentication
│   ├── styles/input.css      # Tailwind input
│   └── views/
│       ├── sessions.html     # Sessions page
│       ├── logs.html         # Logs page
│       └── styles.css        # Generated CSS
```

### Adding New Admin Pages

1. Create HTML file in `src/views/`
2. Include the local CSS: `<link rel="stylesheet" href="/service/admin/styles.css">`
3. Add route in `src/routes/admin.ts` with `requireBasicAuth` middleware
4. Rebuild CSS if using new Tailwind classes: `npm run build:css`

---

## Troubleshooting

### "Admin UI is disabled" Error

**Cause:** `WHATSAPP_SERVICE_ADMIN_PASSWORD` not set.

**Fix:** Set the environment variable and restart the service.

### Styling Not Applied

**Cause:** CSS not built or route misconfigured.

**Fix:**
1. Run `npm run build:css`
2. Verify `src/views/styles.css` exists
3. Check browser network tab for 404 on styles.css

### Authentication Loop

**Cause:** Invalid credentials or browser cache issue.

**Fix:**
1. Verify environment variables are correct
2. Clear browser cache/cookies
3. Try incognito window

### Sessions Not Loading

**Cause:** WhatsApp API not reachable or CORS issues.

**Fix:**
1. Check whatsapp-api service is running
2. Verify `WHATSAPP_API_URL` environment variable
3. Check browser console for errors
