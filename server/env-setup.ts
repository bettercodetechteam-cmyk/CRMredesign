import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { isFirebasePrivateKeyConfigured } from "./firebasePrivateKey";

// Locally (development): use .env.example. Production: use .env
const isDev = process.env.NODE_ENV !== 'production';
const examplePaths = [
  path.join(process.cwd(), '.env.example'),
  path.join(process.cwd(), 'client', '.env.example'),
  './.env.example',
  './client/.env.example'
];
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'client', '.env'),
  path.join(process.cwd(), 'server', '.env'),
  './.env',
  './client/.env',
  './server/.env'
];

// Load environment variables
if (isDev) {
  let envLoaded = false;
  // Try loading .env first
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ Local: .env loaded from ${envPath}`);
      envLoaded = true;
      break;
    }
  }
  
  // Always load .env.example as a fallback (don't override existing)
  for (const envPath of examplePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ Local: using .env.example for fallbacks from ${envPath}`);
      
      // So server can use same project: map VITE_FIREBASE_* to FIREBASE_* when not set
      if (!process.env.FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID) {
        process.env.FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
      }
      if (!process.env.GOOGLE_API_KEY && process.env.VITE_FIREBASE_API_KEY) {
        process.env.GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
      }
      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.VITE_FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_PROJECT_ID !== process.env.VITE_FIREBASE_PROJECT_ID
      ) {
        console.warn(
          `⚠️ FIREBASE_PROJECT_ID (${process.env.FIREBASE_PROJECT_ID}) differs from VITE_FIREBASE_PROJECT_ID (${process.env.VITE_FIREBASE_PROJECT_ID}). ` +
            'Use matching projects or use only VITE_* for local dev (testing) and production .env on EC2.'
        );
      }
      break;
    }
  }
} else {
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ Production env loaded from: ${envPath}`);
      break;
    }
  }
}

if (process.env.NODE_ENV !== 'production') {
  console.log("Env status:", {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "Set" : "Missing",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "Set" : "Missing",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "Set" : "Missing",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "Set" : "Missing",
  });
}

// ImageKit Configuration - Updated with proper environment variable handling
export const IMAGEKIT_CONFIG = {
  PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY || "",
  URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT || "",
  PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY || ""
};

// Enhanced validation and logging
const validateImageKitConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!IMAGEKIT_CONFIG.PRIVATE_KEY || IMAGEKIT_CONFIG.PRIVATE_KEY === "your_private_key_here") {
    errors.push("ImageKit private key not properly configured");
  }

  if (!IMAGEKIT_CONFIG.PUBLIC_KEY) {
    errors.push("ImageKit public key is missing");
  }

  if (!IMAGEKIT_CONFIG.URL_ENDPOINT) {
    errors.push("ImageKit URL endpoint is missing");
  }

  // Check if using default values
  if (errors.length > 0) {
    console.error("❌ ImageKit Configuration Errors:", errors);
    return false;
  }

  if (warnings.length > 0) {
    console.warn("⚠️ ImageKit Configuration Warnings:", warnings);
  }

  console.log("✅ ImageKit configuration loaded successfully:", {
    publicKey: IMAGEKIT_CONFIG.PUBLIC_KEY,
    urlEndpoint: IMAGEKIT_CONFIG.URL_ENDPOINT,
    privateKeyConfigured: !!IMAGEKIT_CONFIG.PRIVATE_KEY && IMAGEKIT_CONFIG.PRIVATE_KEY !== "your_private_key_here"
  });

  return true;
};

// Firebase Admin Configuration Validation
const validateFirebaseAdminConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.FIREBASE_PROJECT_ID) {
    errors.push("FIREBASE_PROJECT_ID is missing");
  }

  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    errors.push("FIREBASE_CLIENT_EMAIL is missing");
  }

  if (!process.env.FIREBASE_PRIVATE_KEY) {
    errors.push("FIREBASE_PRIVATE_KEY is missing");
  } else if (!isFirebasePrivateKeyConfigured(process.env.FIREBASE_PRIVATE_KEY)) {
    warnings.push(
      "FIREBASE_PRIVATE_KEY is set but invalid PEM — paste the full key from Firebase Console JSON as one line with \\n (see server/firebase-env-example.txt)"
    );
  }

  if (errors.length > 0) {
    console.error("Firebase Admin Configuration Errors:", errors);
    if (process.env.NODE_ENV !== 'production') {
      console.warn("Firebase Admin will not be available without valid credentials.");
    }
    return false;
  }

  if (warnings.length > 0) {
    console.warn("⚠️ Firebase Admin Configuration Warnings:", warnings);
  }

  console.log("✅ Firebase Admin configuration loaded successfully");
  return true;
};

const validateS3Config = () => {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const hasKeys = process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !hasKeys) {
    console.warn(
      "⚠️ S3 storage not configured (AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). " +
        "File uploads will fall back to base64 or Firebase Storage where applicable."
    );
    return false;
  }

  console.log("✅ S3 storage configuration loaded:", {
    bucket,
    region: process.env.AWS_REGION || "ap-south-1",
  });
  return true;
};

// Validate configuration on startup
validateImageKitConfig();
validateFirebaseAdminConfig();
validateS3Config(); 