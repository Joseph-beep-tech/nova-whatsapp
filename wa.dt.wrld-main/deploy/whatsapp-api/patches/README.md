# WhatsApp Web.js Patches

This directory contains patches for whatsapp-web.js that fix issues not yet released to npm.

## Server Location

```
/var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/
```

## Usage

### After container rebuild:
```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api/patches
./apply-patches.sh
docker restart wwebjs-api
```

### Full rebuild with patches:
```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api/patches
./rebuild-and-patch.sh
```

### Quick apply (if already in deploy folder):
```bash
cd /var/opt/wa.dt.wrld/deploy/whatsapp-api
./patches/apply-patches.sh && docker restart wwebjs-api
```

## Current Patches

### 001-client-hassynced-fix

**Issue:** [GitHub #5758](https://github.com/pedroslopez/whatsapp-web.js/issues/5758)
**Date:** January 30, 2026
**Status:** Required until whatsapp-web.js releases a fix

**Problem:**
The `ready` event never fires because `hasSynced` may already be `true` before the event listener is attached. This causes message callbacks to not be registered.

**Symptoms:**
- Session shows `CONNECTED` state but no `ready` event
- `message_create` events never fire
- Outbound messages work but inbound messages are ignored

**Fix:**
Check `hasSynced` state immediately before registering the change listener.

**File:** `node_modules/whatsapp-web.js/src/Client.js` (lines 288-289)

**Before:**
```javascript
window.AuthStore.AppState.on('change:state', (_AppState, state) => { window.onAuthAppStateChangedEvent(state); });
window.AuthStore.AppState.on('change:hasSynced', () => { window.onAppStateHasSyncedEvent(); });
```

**After:**
```javascript
const appState = window.AuthStore.AppState;
if (appState.hasSynced) {
    window.onAppStateHasSyncedEvent();
}
appState.on('change:hasSynced', (_AppState, hasSynced) => {
    if (hasSynced) {
        window.onAppStateHasSyncedEvent();
    }
});
appState.on('change:state', (_AppState, state) => { window.onAuthAppStateChangedEvent(state); });
```

## Library Version Update (Jan 31, 2026)

In addition to the patch, the whatsapp-web.js library was updated from 1.34.4 to 1.34.6:

**Commits in vendor/whatsapp-api:**
- `ed6cce4` fix: update whatsapp-web.js to ^1.34.6
- `91418c2` chore: update package-lock.json for whatsapp-web.js 1.34.6

**Why 1.34.6 was needed:**
- Version 1.34.4 had incompatible module references
- Console showed: `Requiring unknown module "WAWebNewsletterToggleMuteStateJob"`
- Version 1.34.6 includes fixes for removed/renamed WhatsApp Web modules

## Adding New Patches

1. Add a new function in `apply-patches.sh`:
```bash
apply_my_new_fix() {
    echo "[N/N] Applying my new fix..."
    # Your patch logic here
    echo "  -> Applied successfully"
}
```

2. Call the function at the bottom of the script

3. Document in this README with:
   - Issue link
   - Date discovered
   - Problem description
   - File affected
   - Before/after code

## Checking if Patches are Applied

```bash
# Check if hasSynced fix is applied
docker exec wwebjs-api grep -l "appState.hasSynced" node_modules/whatsapp-web.js/src/Client.js
```

## When to Remove Patches

Remove a patch when:
- whatsapp-web.js releases a version containing the fix
- The underlying WhatsApp Web issue is resolved

Check current version:
```bash
docker exec wwebjs-api sh -c "cat node_modules/whatsapp-web.js/package.json | grep version"
```

## Troubleshooting

If patches fail to apply:

1. Check container is running: `docker ps | grep wwebjs-api`
2. Check file exists: `docker exec wwebjs-api ls node_modules/whatsapp-web.js/src/Client.js`
3. Check for syntax errors in patch script: `bash -n apply-patches.sh`

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Container not running" | Container crashed or not started | `docker compose up -d` |
| "File not found" | npm install didn't run | Rebuild container |
| Patch already applied | Script is idempotent | Safe to re-run |

## Related Documentation

- [WORKING_SESSION-2026-01-30-message-callback.md](../../../WORKING_SESSION-2026-01-30-message-callback.md) - Full investigation
- [docs/deployment/05-deployment-migration.md](../../../docs/deployment/05-deployment-migration.md) - Deployment guide
- [GitHub Issue #5758](https://github.com/pedroslopez/whatsapp-web.js/issues/5758) - Upstream bug report
