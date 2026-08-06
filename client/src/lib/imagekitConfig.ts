// ImageKit: use env (set in .env, never commit real values). No secrets in source.
export const IMAGEKIT_CONFIG = {
  // Use VITE vars first; fall back to project defaults for local/dev stability.
  PUBLIC_KEY: import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || "public_5ORSVIMtmbq8ogMv5frGNTwzLVY=",
  URL_ENDPOINT: import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/u31cbj79j",
  AUTH_ENDPOINT: import.meta.env.PROD
    ? `${window.location.origin}/api/auth`
    : "/api/auth",
};

// Validate configuration
export const validateImageKitConfig = () => {
  const errors: string[] = [];
  
  if (!IMAGEKIT_CONFIG.PUBLIC_KEY) {
    errors.push("ImageKit public key is missing");
  }
  
  if (!IMAGEKIT_CONFIG.URL_ENDPOINT) {
    errors.push("ImageKit URL endpoint is missing");
  }
  
  if (!IMAGEKIT_CONFIG.AUTH_ENDPOINT) {
    errors.push("ImageKit auth endpoint is missing");
  }
  
  if (errors.length > 0) {
    if (process.env.NODE_ENV === 'development') {
    console.error("ImageKit Configuration Errors:", errors);
    }
    return false;
  }
  
  return true;
};

// Test configuration and connectivity
export const testImageKitConfig = async () => {
  if (process.env.NODE_ENV === 'development') {
  console.log("🔧 Testing ImageKit Configuration...");
  console.log("Environment:", import.meta.env.PROD ? "Production" : "Development");
  console.log("Auth Endpoint:", IMAGEKIT_CONFIG.AUTH_ENDPOINT);
  }
  
  // Validate configuration
  if (!validateImageKitConfig()) {
    if (process.env.NODE_ENV === 'development') {
    console.error("❌ ImageKit configuration validation failed");
    }
    return false;
  }
  
  try {
    // Test auth endpoint connectivity
    const response = await fetch(IMAGEKIT_CONFIG.AUTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
      console.error(`❌ Auth endpoint test failed: ${response.status} ${response.statusText}`);
      }
      return false;
    }
    
    // Check if response is actually JSON (not HTML)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (process.env.NODE_ENV === 'development') {
      console.error(`❌ Auth endpoint returned non-JSON response: ${contentType}`);
      }
      return false;
    }
    
    const data = await response.json();
    if (!data.token || data.expire === undefined || !data.signature) {
      if (process.env.NODE_ENV === 'development') {
      console.error("❌ Auth endpoint returned invalid data");
      }
      return false;
    }
    
    if (process.env.NODE_ENV === 'development') {
    console.log("✅ ImageKit configuration test passed");
    }
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error("❌ ImageKit configuration test failed:", error);
    }
    return false;
  }
};

// Get ImageKit authentication parameters
export const getImageKitAuthParams = async (): Promise<{
  token: string;
  expire: number;
  signature: string;
}> => {
  try {
    const response = await fetch(IMAGEKIT_CONFIG.AUTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.token || !data.expire || !data.signature) {
      throw new Error('Invalid authentication response from server');
    }

    return data;
  } catch (error) {
    console.error('Failed to get ImageKit auth params:', error);
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Initialize ImageKit instance
export const initializeImageKit = () => {
  if (typeof window === 'undefined') {
    throw new Error('ImageKit can only be initialized in browser environment');
  }

  // Dynamic import to avoid SSR issues
  return import('imagekit-javascript').then(({ default: ImageKit }) => {
    return new ImageKit({
      publicKey: IMAGEKIT_CONFIG.PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_CONFIG.URL_ENDPOINT,
    });
  });
}; 