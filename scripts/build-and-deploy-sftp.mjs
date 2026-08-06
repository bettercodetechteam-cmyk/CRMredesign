/**
 * Build client for static SFTP hosting and upload to Hostinger.
 * Usage: npm run release:sftp
 *
 * Requires client/.env with VITE_FIREBASE_* and .env.deploy with SFTP_* credentials.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, 'client', '.env') });
dotenv.config({ path: path.join(root, '.env.deploy') });

const distPublic = path.join(root, 'dist', 'public');
const configDir = path.join(distPublic, 'config');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeFirebaseConfig() {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || '',
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  };

  if (!config.apiKey || !config.projectId) {
    console.error('Missing VITE_FIREBASE_* in client/.env — required for production build.');
    process.exit(1);
  }

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'firebase.json'),
    JSON.stringify(config, null, 2)
  );
  console.log('Wrote dist/public/config/firebase.json');
}

function copyHtaccess() {
  const source = path.join(root, 'client', 'public', '.htaccess');
  const target = path.join(distPublic, '.htaccess');
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log('Copied .htaccess for SPA routing on Hostinger');
  }
}

async function main() {
  console.log('Building client for SFTP static hosting...');
  run('npm', ['run', 'build:client'], {
    env: { ...process.env, NODE_ENV: 'production' },
  });

  if (!fs.existsSync(path.join(distPublic, 'index.html'))) {
    console.error('Build failed: dist/public/index.html not found');
    process.exit(1);
  }

  copyHtaccess();
  writeFirebaseConfig();

  console.log('Uploading to Hostinger via SFTP...');
  const { deployViaSftp } = await import('./deploy-hostinger-sftp.mjs');
  await deployViaSftp();
}

main().catch((error) => {
  console.error('SFTP release failed:', error.message);
  process.exit(1);
});
