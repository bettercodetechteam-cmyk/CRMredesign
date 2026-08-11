// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  getDocs,
  getDocsFromServer,
  type Firestore,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig, isFirebaseConfigValid, fetchRuntimeFirebaseConfig } from "@/config/firebase.config";

const firebaseConfig = getFirebaseConfig();
const validateFirebaseConfig = (config: Record<string, string>) => isFirebaseConfigValid(config);

// Check if current domain is authorized for Firebase Auth
const checkDomainAuthorization = () => {
  if (typeof window === 'undefined') return true;
  
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isFirebase = hostname.includes('firebaseapp.com');
  const isProduction =
    hostname.includes('zicazimapcmc.com') ||
    hostname.includes('homeishome.in') ||
    hostname === 'homeishome.in';
  
  if (import.meta.env.DEV) {
    console.log('🌐 Domain check:', {
      hostname,
      isLocalhost,
      isFirebase,
      isProduction
    });
  }
  
  if (isLocalhost) {
    if (import.meta.env.DEV) {
      console.log('✅ Local development - domain should be authorized');
    }
    return true;
  }
  
  if (isFirebase) {
    if (import.meta.env.DEV) {
      console.log('✅ Firebase hosting - domain is authorized');
    }
    return true;
  }
  
  if (isProduction) {
    if (import.meta.env.DEV) {
      console.log('Production domain detected — ensure crm.zicazimapcmc.com is authorized in Firebase Console (crmredesign)');
      console.log('📋 Go to: Firebase Console > Authentication > Settings > Authorized domains');
    }
    return true;
  }
  
  if (import.meta.env.DEV) {
    console.log('⚠️ Domain may need to be authorized in Firebase Console:', hostname);
  }
  return true; // Allow domains to proceed (they'll get proper Firebase errors if unauthorized)
};

// Debug: Log Firebase config presence (without exposing values)
if (import.meta.env.DEV) {
  const configKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'] as const;
  const configStatus = Object.fromEntries(
    configKeys.map((key) => [key, firebaseConfig[key] ? '✅ Set' : '❌ Missing'])
  );
  console.log('🔍 Firebase Config Debug:', configStatus);
  const allSet = configKeys
    .filter((k) => k !== 'measurementId')
    .every((key) => Boolean(firebaseConfig[key]));
  if (allSet) {
    console.log('✅ Local: Firebase from .env.example only → project:', firebaseConfig.projectId);
  } else {
    console.warn('⚠️ Put Firebase config in .env.example (local uses only .env.example). Add localhost in Firebase Console → Authentication → Authorized domains.');
  }
}

// Check domain authorization
checkDomainAuthorization();

// Singleton pattern to prevent duplicate initialization
let app: any;
let auth: any;
let db: any;
let storage: any;
let analytics: any;

// Check if Firebase is already initialized
const apps = getApps();
const isConfigValid = validateFirebaseConfig(firebaseConfig);

/** Prefer in-memory cache when IndexedDB is broken (avoids Firestore internal assertion crashes). */
function createFirestoreInstance(firebaseApp: ReturnType<typeof initializeApp>): Firestore {
  const useMemoryCache =
    typeof window !== "undefined" &&
    sessionStorage.getItem("firestore_memory_cache") === "1";

  if (useMemoryCache) {
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  }

  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    console.warn("Firestore: persistent cache unavailable, using memory cache", err);
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  }
}

export function isFirestorePersistenceError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name ?? "";
  const message = String((error as { message?: string }).message ?? "");
  const code = String((error as { code?: string }).code ?? "");
  return (
    name === "AbortError" ||
    name === "UnknownError" ||
    code === "unavailable" ||
    message.includes("indexedDB") ||
    message.includes("backing store") ||
    message.includes("transaction was aborted") ||
    message.includes("INTERNAL ASSERTION FAILED")
  );
}

/** Read a query; on IndexedDB/persistence failure, bypass local cache and read from server. */
export async function queryDocsWithServerFallback(q: Query): Promise<QuerySnapshot> {
  try {
    return await getDocs(q);
  } catch (error) {
    if (!isFirestorePersistenceError(error)) throw error;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("firestore_memory_cache", "1");
      if (!sessionStorage.getItem("firestore_reload_attempted")) {
        sessionStorage.setItem("firestore_reload_attempted", "1");
        window.location.reload();
        return await new Promise(() => {});
      }
    }
    console.warn("Firestore cache read failed; retrying from server", error);
    return await getDocsFromServer(q);
  }
}

function initServicesWithConfig(config: Record<string, string>) {
  const a = initializeApp(config);
  const au = getAuth(a);
  const d = createFirestoreInstance(a);
  const st = getStorage(a);
  setPersistence(au, browserSessionPersistence).catch(() => {});
  const hasAnalytics = config.measurementId && config.measurementId !== "G-XXXXXXXXXX" && config.appId;
  if (hasAnalytics) {
    isSupported().then(yes => (yes ? getAnalytics(a) : null)).then(inst => { analytics = inst ?? undefined; }).catch(() => {});
  }
  app = a;
  auth = au;
  db = d;
  storage = st;
}

let firebaseReadyPromise: Promise<void>;

if (apps.length > 0) {
  app = apps[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  firebaseReadyPromise = Promise.resolve();
  console.log("✅ Using existing Firebase App (client)");
} else if (isConfigValid) {
  try {
    initServicesWithConfig(firebaseConfig);
    console.log("✅ Firebase App initialized (client)");
    firebaseReadyPromise = Promise.resolve();
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    if (import.meta.env.DEV) throw error;
    app = null; auth = null; db = null; storage = null; analytics = null;
    firebaseReadyPromise = Promise.reject(error);
  }
} else if (import.meta.env.PROD) {
  // Production with no build-time config: try runtime /config/firebase.json
  firebaseReadyPromise = (async () => {
    const runtime = await fetchRuntimeFirebaseConfig();
    if (runtime) {
      try {
        initServicesWithConfig(runtime);
        console.log("✅ Firebase initialized from /config/firebase.json");
      } catch (e) {
        console.error("❌ Firebase init from runtime config failed:", e);
        throw e;
      }
    } else {
      const err = new Error("Firebase is not configured. Please contact your administrator. The application needs to be rebuilt with Firebase environment variables, or add config/firebase.json on the server.");
      console.error("❌", err.message);
      throw err;
    }
  })();
} else {
  console.error('❌ Firebase configuration is invalid. Cannot initialize Firebase services.');
  auth = null; db = null; storage = null;
  firebaseReadyPromise = Promise.reject(new Error('Firebase configuration is invalid. Set VITE_FIREBASE_* in .env.'));
}

/** Call this before using auth/db in production when build had no env (e.g. hosted). Resolves when Firebase is ready or rejects if config missing. */
export function ensureFirebaseReady(): Promise<void> {
  return firebaseReadyPromise;
}

export { app, analytics, auth, db, storage };