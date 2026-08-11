/**
 * Apply firebase-storage-cors.json to the Firebase Storage bucket.
 * Requires: billing enabled, Storage provisioned in Firebase Console, .env with Admin SDK creds.
 *
 * Usage: npm run storage:cors
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

function formatFirebasePrivateKey(raw) {
  if (!raw?.trim()) return undefined;
  let key = raw.trim().replace(/^\uFEFF/, '');
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, '\n');
  if (!key.includes('BEGIN PRIVATE KEY')) return undefined;
  return key;
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const bucketFromEnv =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = formatFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
const corsPath = path.join(rootDir, 'firebase-storage-cors.json');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in .env');
  process.exit(1);
}

if (!fs.existsSync(corsPath)) {
  console.error('❌ firebase-storage-cors.json not found at repo root');
  process.exit(1);
}

const corsConfig = JSON.parse(fs.readFileSync(corsPath, 'utf8'));

const storage = new Storage({
  projectId,
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function resolveBucketName() {
  if (bucketFromEnv) {
    const bucket = storage.bucket(bucketFromEnv);
    const [exists] = await bucket.exists();
    if (exists) return bucketFromEnv;
    console.warn(`⚠️ Bucket ${bucketFromEnv} not found — searching project buckets...`);
  }

  const [buckets] = await storage.getBuckets({ project: projectId });
  if (!buckets.length) {
    console.error(
      '❌ No Storage buckets in project "' +
        projectId +
        '".\n' +
        '   1. Enable billing: https://console.firebase.google.com/project/' +
        projectId +
        '/usage\n' +
        '   2. Open Storage → Get started: https://console.firebase.google.com/project/' +
        projectId +
        '/storage\n' +
        '   3. Run: firebase deploy --only storage --project ' +
        projectId +
        '\n' +
        '   4. Re-run: npm run storage:cors'
    );
    process.exit(1);
  }

  if (buckets.length === 1) return buckets[0].name;

  const preferred = buckets.find((b) =>
    [bucketFromEnv, `${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(b.name)
  );
  return (preferred ?? buckets[0]).name;
}

const bucketName = await resolveBucketName();
const bucket = storage.bucket(bucketName);

await bucket.setMetadata({ cors: corsConfig });
const [metadata] = await bucket.getMetadata();

console.log('✅ Storage CORS applied to:', bucketName);
console.log('   Origins:', metadata.cors?.[0]?.origin?.join(', '));
console.log('   Methods:', metadata.cors?.[0]?.method?.join(', '));
