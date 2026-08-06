#!/bin/bash
# Build and (re)start Zica-Zima CRM on AWS Lightsail / EC2
# Run from project root on the server: bash scripts/deploy-aws.sh

set -e

cd "$(dirname "$0")/.."
APP_NAME="zica-crm"
PORT="${PORT:-3000}"

echo "=== Deploying Zica-Zima CRM ==="

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in project root. Copy .env.aws.example to .env and fill in values."
  exit 1
fi

if [ ! -f "client/.env" ]; then
  echo "WARNING: client/.env not found — build will miss VITE_FIREBASE_* unless they are in root .env"
fi

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Building client + server..."
npm run build

if [ ! -f "dist/index.js" ]; then
  echo "ERROR: dist/index.js not found after build"
  exit 1
fi

if [ ! -d "dist/public" ]; then
  echo "ERROR: dist/public not found after build"
  exit 1
fi

# Runtime Firebase config for SPA fallback (vite usually writes this during build)
if [ -f "dist/public/config/firebase.json" ]; then
  echo "config/firebase.json already present from build."
elif [ -f "client/.env" ]; then
  node -e "
    require('dotenv').config({ path: 'client/.env' });
    const fs = require('fs');
    const c = {
      apiKey: process.env.VITE_FIREBASE_API_KEY || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.VITE_FIREBASE_APP_ID || '',
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || ''
    };
    fs.mkdirSync('dist/public/config', { recursive: true });
    fs.writeFileSync('dist/public/config/firebase.json', JSON.stringify(c, null, 2));
    console.log('Wrote dist/public/config/firebase.json');
  "
fi

echo "Restarting PM2 process..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 restart "$APP_NAME" --update-env
else
  PORT="$PORT" NODE_ENV=production pm2 start dist/index.js --name "$APP_NAME"
fi

pm2 save

echo ""
echo "=== Deploy complete ==="
echo "Health: curl http://127.0.0.1:${PORT}/api/health"
pm2 status "$APP_NAME"
