import "./env-setup";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import cors from "cors";
import { reminderScheduler } from "./services/reminderScheduler";
import { initializeFirebaseAdmin } from "./firebaseConfig";
import { logDevStackStatus } from "./devStackCheck";

console.log("Env check:", {
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "Set" : "Missing",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "Set" : "Missing",
});

if (process.env.GOOGLE_API_KEY) {
  console.info("Firebase API key loaded.");
} else if (process.env.NODE_ENV === 'production') {
  console.warn("Firebase API key missing in production.");
}

const app = express();

// Security middleware for production
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now
    crossOriginOpenerPolicy: false, // Allow Firebase popup authentication
    crossOriginEmbedderPolicy: false, // Allow cross-origin resources
  }));
  
  // CORS configuration for production
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'],
    credentials: true,
  }));
} else {
  // Development CORS
  app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  }));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    
    if (path.startsWith("/api")) {
      let logLine = `[${logLevel}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV === 'development') {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Firebase Admin
  console.log('🔧 Initializing Firebase Admin...');
  try {
    const firebaseAdmin = await initializeFirebaseAdmin();
    if (firebaseAdmin) {
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.warn('Firebase Admin initialization failed.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }

  // Enable if you need reminder scheduler later
  // console.log('🔧 Initializing reminder scheduler...');
  // reminderScheduler.init();
  // console.log('✅ Reminder scheduler initialized successfully');

  // Register API routes FIRST
  console.log('🔧 Registering API routes...');
  const server = await registerRoutes(app);
  console.log('✅ API routes registered');

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log error details
    console.error('Global error handler:', {
      status,
      message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Don't expose internal errors in production
    const responseMessage = process.env.NODE_ENV === 'production' && status === 500 
      ? "Internal Server Error" 
      : message;
    
    res.status(status).json({ 
      message: responseMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // 404 handler for API routes - should be before Vite
  app.use('/api/*', (req, res) => {
    console.log('🔍 API 404 handler triggered for:', req.path);
    res.status(404).json({ message: 'API endpoint not found' });
  });

  // Setup Vite or static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler for non-API routes - should be last
  app.use('*', (req, res) => {
    res.status(404).send('Page not found');
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    log(`✅ Server running at http://localhost:${port}`);
    log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`✅ Health check: http://localhost:${port}/api/health`);
    void logDevStackStatus();
  });
})();
