#!/bin/bash
# Rebuild wwebjs-api container and apply patches
# Usage: ./rebuild-and-patch.sh
#
# Run from: /var/opt/wa.dt.wrld/deploy/whatsapp-api/patches/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Rebuilding wwebjs-api ==="
echo "Deploy dir: $DEPLOY_DIR"
cd "$DEPLOY_DIR"
docker compose up -d --build

echo ""
echo "Waiting for container to be ready..."
sleep 10

echo ""
"$SCRIPT_DIR/apply-patches.sh"

echo ""
echo "Restarting to apply patches..."
docker restart wwebjs-api

echo ""
echo "=== Done! ==="
echo "Check logs: docker logs wwebjs-api --tail 50"
