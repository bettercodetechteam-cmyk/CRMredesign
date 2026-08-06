#!/bin/bash
# Remote deploy steps run on EC2 after git sync (called from GitHub Actions).
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "=== Deploy from $APP_DIR @ $(git rev-parse --short HEAD) ==="

if [ ! -f ".env" ]; then
  echo "ERROR: $APP_DIR/.env not found."
  echo "SSH to the server and create .env with production Firebase values, then re-run deploy."
  exit 1
fi

mkdir -p client
cp .env client/.env
export NODE_OPTIONS="--max-old-space-size=1536"
bash scripts/deploy-aws.sh

echo "Waiting for app to become healthy..."
HEALTH_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:3000/api/health; then
    echo ""
    echo "Health check passed (attempt $i)."
    HEALTH_OK=1
    break
  fi
  echo "Health check attempt $i failed, retrying in 3s..."
  sleep 3
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "ERROR: /api/health did not respond after 30s."
  pm2 logs zica-crm --lines 40 --nostream || true
  exit 1
fi

pm2 status zica-crm
echo "=== Deploy finished successfully ==="
