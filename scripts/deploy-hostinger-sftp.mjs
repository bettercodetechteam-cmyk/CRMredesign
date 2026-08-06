/**
 * Upload dist/public to Hostinger via SFTP (port 65002).
 *
 * Set credentials in .env.deploy (gitignored) or environment:
 *   SFTP_HOST, SFTP_USER, SFTP_PASSWORD
 *   SFTP_PORT=65002 (optional)
 *   SFTP_REMOTE_PATH=domains/homeishome.in/public_html/ (optional)
 *
 * Also accepts FTP_HOST / FTP_USER / FTP_PASSWORD for GitHub secret parity.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import SftpClient from 'ssh2-sftp-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env.deploy') });

const host = process.env.SFTP_HOST || process.env.FTP_HOST;
const username = process.env.SFTP_USER || process.env.FTP_USER;
const password = process.env.SFTP_PASSWORD || process.env.FTP_PASSWORD;
const port = Number(process.env.SFTP_PORT || process.env.FTP_PORT || 65002);
const remotePath = (
  process.env.SFTP_REMOTE_PATH || 'domains/homeishome.in/public_html/'
).replace(/\\/g, '/');
const localPath = path.join(root, 'dist', 'public');
const MAX_RETRIES = 3;
const CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function requireConfig() {
  const missing = [];
  if (!host) missing.push('SFTP_HOST (or FTP_HOST)');
  if (!username) missing.push('SFTP_USER (or FTP_USER)');
  if (!password) missing.push('SFTP_PASSWORD (or FTP_PASSWORD)');
  if (missing.length) {
    console.error('Missing:', missing.join(', '));
    console.error('Create .env.deploy in the project root or export these variables.');
    process.exit(1);
  }
  if (!fs.existsSync(localPath)) {
    console.error(`Build output not found: ${localPath}`);
    console.error('Run: npm run build:client');
    process.exit(1);
  }
}

function collectFiles(dir, baseDir = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push({
        local: fullPath,
        relative: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
      });
    }
  }
  return files;
}

function getConnectOptions() {
  return {
    host,
    port,
    username,
    password,
    readyTimeout: 120000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 12,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadFileWithRetry(sftp, localFile, remoteFile) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sftp.fastPut(localFile, remoteFile);
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `Retry ${attempt}/${MAX_RETRIES} for ${remoteFile}: ${error.message}`
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

async function ensureRemoteDir(sftp, remoteDir) {
  const normalized = remoteDir.endsWith('/') ? remoteDir : `${remoteDir}/`;
  await sftp.mkdir(normalized, true);
}

async function uploadAll(sftp) {
  const files = collectFiles(localPath);
  const remoteBase = remotePath.endsWith('/') ? remotePath : `${remotePath}/`;

  console.log(`Uploading ${files.length} files to ${remoteBase}`);

  let uploaded = 0;
  for (const file of files) {
    const remoteFile = `${remoteBase}${file.relative}`;
    const remoteDir = remoteFile.slice(0, remoteFile.lastIndexOf('/') + 1);
    await ensureRemoteDir(sftp, remoteDir);
    await uploadFileWithRetry(sftp, file.local, remoteFile);
    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === files.length) {
      console.log(`Progress: ${uploaded}/${files.length}`);
    }
  }
}

async function connectSftp() {
  let lastError;

  for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
    const sftp = new SftpClient();
    try {
      console.log(`SFTP connect attempt ${attempt}/${CONNECT_RETRIES} → ${host}:${port}`);
      await sftp.connect(getConnectOptions());
      return sftp;
    } catch (error) {
      lastError = error;
      console.warn(`Connect failed: ${error.message}`);
      try {
        await sftp.end();
      } catch {
        // ignore
      }
      if (attempt < CONNECT_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(
    `Could not connect to ${host}:${port} after ${CONNECT_RETRIES} attempts. ` +
      'Check FTP_HOST (use hPanel server IP), SSH/SFTP enabled, and port 65002. ' +
      'If GitHub Actions cannot reach Hostinger, deploy locally: npm run release:sftp'
  );
}

async function main() {
  requireConfig();

  console.log(`Connecting to ${host}:${port} as ${username} ...`);
  let sftp = await connectSftp();

  try {
    console.log(`Uploading ${localPath} → ${remotePath}`);
    await uploadAll(sftp);
    console.log('SFTP deploy completed.');
  } catch (err) {
    console.warn(`Upload interrupted (${err.message}). Reconnecting once...`);
    try {
      await sftp.end();
    } catch {
      // ignore disconnect errors
    }

    sftp = await connectSftp();
    await uploadAll(sftp);
    console.log('SFTP deploy completed after reconnect.');
  } finally {
    await sftp.end();
  }
}

export { main as deployViaSftp };

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error('SFTP deploy failed:', err.message);
    process.exit(1);
  });
}
