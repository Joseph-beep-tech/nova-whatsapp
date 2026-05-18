#!/bin/bash
# Apply patches to wwebjs-api container
# Usage: ./apply-patches.sh [container_name]
#
# This script copies patched files into the running container.
# Run after container restart or rebuild.

set -e

CONTAINER=${1:-wwebjs-api}
PATCHES_DIR="$(dirname "$0")"
CONTAINER_APP_DIR="/usr/src/app"

echo "=== WhatsApp Web.js Patch Script ==="
echo "Container: $CONTAINER"
echo "Patches dir: $PATCHES_DIR"
echo ""

# Check if container is running
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    echo "ERROR: Container $CONTAINER is not running"
    exit 1
fi

# Function to apply a sed-based patch
apply_client_hassynced_fix() {
    echo "[1/1] Applying Client.js hasSynced timing fix..."

    # Copy original file out
    docker cp "$CONTAINER:$CONTAINER_APP_DIR/node_modules/whatsapp-web.js/src/Client.js" /tmp/Client.js.original

    # Check if already patched
    if grep -q "if (appState.hasSynced)" /tmp/Client.js.original; then
        echo "  -> Already patched, skipping"
        return 0
    fi

    # Create patched version
    head -n 287 /tmp/Client.js.original > /tmp/Client.js.patched

    cat >> /tmp/Client.js.patched << 'PATCH'
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
PATCH

    # Skip original lines 288-289 and append rest
    tail -n +290 /tmp/Client.js.original >> /tmp/Client.js.patched

    # Copy back to container
    docker cp /tmp/Client.js.patched "$CONTAINER:$CONTAINER_APP_DIR/node_modules/whatsapp-web.js/src/Client.js"

    # Cleanup
    rm -f /tmp/Client.js.original /tmp/Client.js.patched

    echo "  -> Applied successfully"
}

# Apply all patches
apply_client_hassynced_fix

echo ""
echo "=== All patches applied ==="
echo ""
echo "Restart container to apply changes:"
echo "  docker restart $CONTAINER"
