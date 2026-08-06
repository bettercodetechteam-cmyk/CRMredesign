// Firebase configuration from env (Vite bakes VITE_* into the bundle at build time).
// In production, if env is empty, config can be loaded at runtime from /config/firebase.json.
export const getFirebaseConfig = () => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
  };

  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingFields = requiredFields.filter(field => !config[field as keyof typeof config] || config[field as keyof typeof config].trim() === '');
  
  if (missingFields.length > 0) {
    const errorMsg = `Missing Firebase environment variables: ${missingFields.join(', ')}. Please check your .env file.`;
    if (import.meta.env.DEV) {
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
    console.warn('⚠️', errorMsg);
    if (import.meta.env.PROD) {
      console.warn('⚠️ Will try loading from /config/firebase.json (place firebase.json in server public/config/).');
    }
  }
  
  if (import.meta.env.PROD && typeof window !== 'undefined' && config.projectId) {
    console.log('📋 Firebase project:', config.projectId);
  }
  
  return config;
};

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export function isFirebaseConfigValid(c: Record<string, string>): boolean {
  return REQUIRED_KEYS.every(k => c[k] && String(c[k]).trim() !== '');
}

/** In production, load Firebase config from /config/firebase.json (e.g. on Contabo). */
export async function fetchRuntimeFirebaseConfig(): Promise<Record<string, string> | null> {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return null;
  const url = `${window.location.origin}/config/firebase.json`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`⚠️ /config/firebase.json not found (${res.status}). Add config/firebase.json to the deployed folder.`);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      console.warn('⚠️ Server returned HTML instead of JSON for /config/firebase.json (SPA fallback). Add config/firebase.json to the deployed folder so the server serves it.');
      return null;
    }
    const data = JSON.parse(text) as Record<string, string>;
    const config = {
      apiKey: data.apiKey || '',
      authDomain: data.authDomain || '',
      projectId: data.projectId || '',
      storageBucket: data.storageBucket || '',
      messagingSenderId: data.messagingSenderId || '',
      appId: data.appId || '',
      measurementId: data.measurementId || ''
    };
    if (!isFirebaseConfigValid(config)) {
      console.warn('⚠️ /config/firebase.json missing required keys: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId');
      return null;
    }
    return config;
  } catch (e) {
    console.warn('⚠️ Failed to load /config/firebase.json:', e);
    return null;
  }
}
