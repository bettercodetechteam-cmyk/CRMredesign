import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import react from "@vitejs/plugin-react";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // Explicitly set root to client directory
  const clientRoot = path.resolve(import.meta.dirname, "..", "client");
  const projectRoot = path.resolve(import.meta.dirname, "..");

  // Call viteConfig as a function to get the actual config object
  const baseConfig = typeof viteConfig === 'function' 
    ? viteConfig({ command: 'serve', mode: process.env.NODE_ENV || 'development', isSsrBuild: false })
    : viteConfig;

  const vite = await createViteServer({
    ...baseConfig,
    root: clientRoot,
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
    resolve: {
      ...baseConfig.resolve,
      alias: {
        "@": path.resolve(projectRoot, "client", "src"),
        "@shared": path.resolve(projectRoot, "shared"),
        "@assets": path.resolve(projectRoot, "attached_assets"),
      },
    },
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Do not exit — keeps dev server running so HMR/transform errors can be fixed
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Only use Vite middleware for non-API routes
  // Wrap vite.middlewares to skip API routes
  app.use((req, res, next) => {
    // Skip API routes and auth endpoints - let Express handle them
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/nest-api/') ||
      req.path === '/auth' ||
      req.path === '/api/auth'
    ) {
      return next();
    }
    // For all other routes, use Vite middleware
    vite.middlewares(req, res, next);
  });
  
  // Handle SPA routing for non-API routes
  app.use(async (req, res, next) => {
    // Skip API routes and auth endpoints
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/nest-api/') ||
      req.path === '/auth' ||
      req.path === '/api/auth'
    ) {
      return next();
    }
    
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
