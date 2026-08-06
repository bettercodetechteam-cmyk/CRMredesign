// Import the Firebase SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID
};

// Singleton pattern to prevent duplicate initialization
let app: any;
let auth: any;
let db: any;
let analytics: any;

// Check if Firebase is already initialized
const apps = getApps();
if (apps.length === 0) {
  // Initialize Firebase App only if not already initialized
  app = initializeApp(firebaseConfig);
  console.log("✅ Firebase App initialized");
} else {
  // Use existing app
  app = apps[0];
  console.log("✅ Using existing Firebase App");
}

// Initialize Firebase services
auth = getAuth(app);
db = getFirestore(app);

// Conditionally initialize Analytics
isAnalyticsSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("✅ Analytics initialized.");
    } else {
      console.log("⚠️ Analytics not supported in this environment.");
    }
  })
  .catch((err) => {
    console.error("❌ Analytics check failed:", err);
  });

export { app, auth, db, analytics };

// Firebase Admin for server-side operations
let adminApp: any;
let adminDb: any;

import { formatFirebasePrivateKey } from './firebasePrivateKey';

export { formatFirebasePrivateKey } from './firebasePrivateKey';

export const initializeFirebaseAdmin = async () => {
  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID;

    if (!projectId || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log("⚠️ Firebase Admin environment variables missing - skipping initialization");
      return null;
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (!clientEmail.includes(projectId.replace(/-/g, '')) && !clientEmail.includes(projectId)) {
      console.warn(
        `⚠️ FIREBASE_CLIENT_EMAIL (${clientEmail}) may not match project ${projectId}. ` +
          'Download a service account key from the same Firebase project as VITE_FIREBASE_PROJECT_ID.'
      );
    }

    const privateKey = formatFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    if (!privateKey) {
      console.error(
        "❌ FIREBASE_PRIVATE_KEY is set but not valid PEM. Use FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\" in .env"
      );
      return null;
    }

    // Use dynamic import for firebase-admin to avoid build issues
    const admin = await import('firebase-admin');
    
    if (!admin.apps.length) {
      // Initialize Firebase Admin
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        databaseURL: `https://${projectId}.firebaseio.com`
      });
      console.log("✅ Firebase Admin initialized for server");
    } else {
      adminApp = admin.apps[0];
      console.log("✅ Using existing Firebase Admin app");
    }
    
    adminDb = admin.firestore(adminApp);
    return { adminApp, adminDb };
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin:", error);
    return null;
  }
};

export const getFirebaseAdmin = async () => {
  if (!adminDb) {
    return await initializeFirebaseAdmin();
  }
  return { adminApp, adminDb };
};
