# Session Proxy Routes - Staged Changes

## Files Staged
- `packages/whatsapp-service/src/routes/health.ts`
- `packages/whatsapp-service/src/routes/index.ts`

## New Endpoints Added

### GET /session/status/:sessionId
Proxies to wwebjs-api for dashboard compatibility.

Returns:
```json
{
  "success": true,
  "data": {
    "sessionId": "mysession",
    "state": "CONNECTED|DISCONNECTED",
    "authenticated": true|false
  }
}
```

### GET /session/qr/:sessionId/image
Proxies QR code image from wwebjs-api.

Returns: PNG image or error JSON.

## Auth Changes (index.ts)
Routes starting with `/session/` now require API key authentication.

## Tests Needed
- `GET /session/status/:sessionId` - success, not found, timeout
- `GET /session/qr/:sessionId/image` - success, not available, timeout

## To Commit
```bash
git commit -m "feat(service): add session proxy routes for dashboard

Add session status and QR code proxy endpoints:
- GET /session/status/:sessionId - proxies to wwebjs-api
- GET /session/qr/:sessionId/image - proxies QR code image
- API key auth required for /session/* routes

Signed-off-by: Kago Kagichiri <kago.kagichiri@gmail.com>
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## To Unstage
```bash
git restore --staged packages/whatsapp-service/src/routes/health.ts packages/whatsapp-service/src/routes/index.ts
```
