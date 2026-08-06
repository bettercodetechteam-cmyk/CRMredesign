import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixCors() {
  console.log('🚀 Starting Firebase Storage CORS fix...');

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.trim();
    // If it's wrapped in quotes, it's likely a JSON-escaped string from .env
    if (privateKey.startsWith('"')) {
      try {
        // Wrap in another set of quotes if needed, but here we just try to parse it
        // Actually, if it's "---", JSON.parse will work
        privateKey = JSON.parse(privateKey);
      } catch (e) {
        // Fallback to manual cleaning if JSON.parse fails
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.substring(1, privateKey.length - 1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    console.log(`Key length: ${privateKey.length}`);
    console.log(`Key starts with: "${privateKey.substring(0, 30)}..."`);
    console.log(`Key ends with: "...${privateKey.substring(privateKey.length - 30)}"`);
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env file.');
    console.log('Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    const buckets = [
      `${projectId}.firebasestorage.app`,
      `${projectId}.appspot.com`,
      'zica-zima-testing.firebasestorage.app',
      'zica-zima-crm.firebasestorage.app'
    ];

    const corsConfiguration = [
      {
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-*'],
        maxAgeSeconds: 3600,
      },
    ];

    for (const bucketName of buckets) {
      try {
        console.log(`\n📦 Checking bucket: ${bucketName}...`);
        const bucket = admin.storage().bucket(bucketName);
        
        // Check if bucket exists
        const [exists] = await bucket.exists();
        if (!exists) {
          console.log(`⚠️  Bucket ${bucketName} does not exist, skipping.`);
          continue;
        }

        console.log(`✅ Bucket found. Applying CORS policy...`);
        await bucket.setCorsConfiguration(corsConfiguration);
        console.log(`✨ CORS policy applied successfully to ${bucketName}!`);
      } catch (err) {
        console.error(`❌ Failed to update ${bucketName}:`, err.message);
      }
    }

    console.log('\n🏁 Finished! Please try uploading your image again.');
  } catch (error) {
    console.error('💥 Fatal Error:', error);
  }
}

fixCors();
