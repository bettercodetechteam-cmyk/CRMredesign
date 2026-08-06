import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(import.meta.dirname);
  const clientDir = path.resolve(import.meta.dirname, "client");

  // Local dev: always use root .env.example (testing/local Firebase).
  // Production build: Firebase vars are overridden from root .env.
  let env: Record<string, string> = {};
  if (mode === 'development') {
    const localExamplePath = path.join(rootDir, '.env.example');
    if (fs.existsSync(localExamplePath)) {
      const parsed = dotenv.parse(fs.readFileSync(localExamplePath, 'utf-8'));
      env = { ...parsed };
      console.log('✅ Vite (local): using', localExamplePath);
    } else {
      console.warn('⚠️ Vite (local): root .env.example not found');
    }
  }
  if (Object.keys(env).length === 0) {
    const rootEnv = loadEnv(mode, rootDir, '');
    const clientEnv = loadEnv(mode, clientDir, '');
    env = { ...rootEnv, ...clientEnv };
  }

  // Log Firebase env vars during build (for debugging)
  if (mode === 'production') {
    const firebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];
    
    const missing = firebaseVars.filter(v => !env[v] || env[v].trim() === '');
    if (missing.length > 0) {
      console.warn('⚠️ WARNING: Missing Firebase env vars during build:', missing.join(', '));
      console.warn('⚠️ The production build may not work correctly without these variables.');
    } else {
      console.log('✅ All Firebase environment variables found during build');
    }
  }

  // In development: inject ONLY .env.example so production .env is never used locally
  const define: Record<string, string> = {};
  if (mode === 'development' && Object.keys(env).length > 0) {
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith('VITE_')) {
        define[`import.meta.env.${key}`] = JSON.stringify(value);
      }
    }
  }

  if (mode === 'production') {
    const rootProdEnvPath = path.join(rootDir, '.env');
    if (fs.existsSync(rootProdEnvPath)) {
      const prodEnv = dotenv.parse(fs.readFileSync(rootProdEnvPath, 'utf-8'));
      const firebaseKeys = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
        'VITE_FIREBASE_MEASUREMENT_ID'
      ];
      for (const key of firebaseKeys) {
        if (prodEnv[key]) {
          define[`import.meta.env.${key}`] = JSON.stringify(prodEnv[key]);
        }
      }
      // Keep writeFirebaseConfigPlugin in sync with the same production Firebase values.
      env = { ...env, ...Object.fromEntries(firebaseKeys.map((k) => [k, prodEnv[k] ?? env[k]])) };
      console.log('✅ Vite (production): Firebase vars overridden from root .env');
    } else {
      console.warn('⚠️ Vite (production): root .env not found, using default env resolution');
    }
  }

  // In dev: use a dir without .env so only .env.example (via define) is used.
  // In production: use clientDir so Vite loads client/.env and injects VITE_* into the bundle.
  const envDirForMode = mode === 'development'
    ? path.join(clientDir, 'src')  // no .env here → only define from .env.example is used
    : clientDir;                    // production: load client/.env so Firebase config is in the build

  const outDir = path.resolve(import.meta.dirname, "dist/public");

  // Production: write config/firebase.json into build output when env is set, so the deployed app can load it (avoids SPA fallback returning index.html)
  const writeFirebaseConfigPlugin = mode === 'production' ? {
    name: 'write-firebase-config',
    closeBundle() {
      const apiKey = env.VITE_FIREBASE_API_KEY?.trim();
      const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
      if (!apiKey || !projectId) return;
      const configDir = path.join(outDir, 'config');
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'firebase.json');
      const config = {
        apiKey: env.VITE_FIREBASE_API_KEY || '',
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: env.VITE_FIREBASE_APP_ID || '',
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('✅ Wrote config/firebase.json into build output (for runtime config on server).');
    },
  } : null;

  return {
  envDir: envDirForMode,
  define,
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    ...(writeFirebaseConfigPlugin ? [writeFirebaseConfigPlugin] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // CRITICAL: Deduplicate React to prevent multiple instances
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@tanstack/react-query', 'react-router-dom'],
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Base path for production deployment (empty string = root domain)
  base: '/',
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    target: 'esnext', // Use modern ES to avoid transformation issues
    minify: 'esbuild', // Use esbuild instead of terser - better handles TDZ issues
    // esbuild minification is faster and handles module initialization better
    cssMinify: true,
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // CRITICAL FIX: Check for React-related packages FIRST with most inclusive logic
          // This prevents any React code from being split into separate chunks
          
          // Check if it's ANY React-related package (most inclusive)
          const isReactPackage = 
            id.includes('/react') || 
            id.includes('\\react') ||
            id.includes('react-dom') ||
            id.includes('react/') ||
            id.includes('react\\') ||
            id.includes('@tanstack/react-query') ||
            id.includes('react-router') ||
            id.includes('react-hook-form') ||
            id.includes('@hookform/resolvers') ||
            id.includes('react-icons') ||
            id.includes('react-day-picker') ||
            id.includes('react-resizable') ||
            id.includes('react-stripe') ||
            id.includes('@radix-ui') ||
            id.includes('@emotion') ||
            id.includes('framer-motion') ||
            id.includes('@mui/material') ||
            id.includes('@mui/icons-material') ||
            id.includes('recharts') ||
            id.includes('embla-carousel-react') ||
            id.includes('lucide-react') ||
            id.includes('next-themes') ||
            id.includes('cmdk') ||
            id.includes('input-otp') ||
            id.includes('vaul') ||
            id.includes('wouter');
          
          // Only exclude if it's clearly NOT a React dependency
          const isExcluded = 
            id.includes('react-transition-group') && 
            !id.includes('react-dom') &&
            !id.includes('react/') &&
            !id.includes('react\\');
          
          if (id.includes('node_modules')) {
            // CRITICAL: Put ALL React-related code in vendor-react chunk
            if (isReactPackage && !isExcluded) {
              return 'vendor-react';
            }
            
            // Safe non-React packages that can go in separate chunks
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('date-fns') || id.includes('xlsx')) {
              return 'vendor-utils';
            }
            
            // CRITICAL: If we're not sure, put it in vendor-react to be safe
            // This prevents React-dependent packages from ending up in vendor-other
            // Only put truly safe packages in vendor-other
            const isSafeForOther = 
              id.includes('express') ||
              id.includes('cors') ||
              id.includes('helmet') ||
              id.includes('dotenv') ||
              id.includes('zod') ||
              id.includes('class-variance-authority') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge');
            
            if (isSafeForOther) {
              return 'vendor-other';
            }
            
            // Default: put in vendor-react to be safe (prevents TDZ errors)
            return 'vendor-react';
          }
          // Split large service files
          if (id.includes('reminderService') || id.includes('enhancedReminderService')) {
            return 'service-reminder';
          }
          if (id.includes('staffSyncService') || id.includes('dataSyncService')) {
            return 'service-sync';
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        // Ensure proper module format
        format: 'es',
        // Preserve module structure
        preserveModules: false,
        // Add proper exports
        exports: 'auto',
        // Ensure proper interop - critical for React
        interop: 'compat',
        // Ensure proper chunk dependency order
        generatedCode: {
          constBindings: true, // Keep const for tree-shaking
          objectShorthand: false
        }
      }
    },
    // Ensure module preloading for critical chunks
    modulePreload: {
      polyfill: true
    }
  },
  server: {
    port: 3000,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    },
    // Phase 8: proxy NestJS CRM API (runs on :4000) without CORS friction in Vite.
    proxy: {
      '/nest-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/nest-api/, ''),
      },
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom', 
      'react-dom/client',
      '@tanstack/react-query',
      'react-router-dom'
    ],
    // Force re-optimization when dependencies change
    force: false,
    // Ensure React is properly deduplicated
    esbuildOptions: {
      jsx: 'automatic'
    }
  },
  // Clear cache on server start issues
  clearScreen: false,
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
  };
});
