import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config, initDirectories } from './server/config.ts';
import authRouter from './server/routes/auth.ts';
import filesRouter from './server/routes/files.ts';
import uploadRouter from './server/routes/upload.ts';
import storageRouter from './server/routes/storage.ts';
import publicFileRouter, { sclRouter, inlineRouter } from './server/routes/publicFile.ts';

async function startServer() {
  // Ensure physical directories exist (/storage/uploads and /storage/metadata)
  initDirectories();

  const app = express();
  const PORT = 3000;

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust reverse proxy (Nginx / Cloud Run) headers like X-Forwarded-For, X-Forwarded-Proto
  app.set('trust proxy', true);

  // 1. PUBLIC DROPBOX-COMPATIBLE AND RAW FILE ENDPOINTS
  // /scl/fi/:id/:filename -> Dropbox main share link (auto-redirects to /cd/0/inline/<token>/file#)
  // /cd/0/inline/:token/file -> Dropbox direct byte-range seekable inline stream
  // /f/:id -> Direct raw stream endpoint (with backwards compatibility)
  app.use('/scl/fi', sclRouter);
  app.use('/cd/0/inline', inlineRouter);
  app.use('/f', publicFileRouter);

  // 2. CORS CONFIGURATION FOR MANAGEMENT APIS (/api/*)
  const isAllowedOrigin = (origin: string, reqHost?: string): boolean => {
    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Allow all localhost, 127.0.0.1, 0.0.0.0, and IPv6 loopback origins on any port (HTTP & HTTPS)
    const isLoopbackOrLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(normalizedOrigin);
    if (isLoopbackOrLocalhost) return true;

    // Allow local private network IP addresses (LAN) on any port (HTTP & HTTPS)
    const isPrivateIp = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(normalizedOrigin);
    if (isPrivateIp) return true;

    // Allow same-host requests (if client is requesting from the same domain/port as this server)
    if (reqHost) {
      const cleanReqHost = reqHost.toLowerCase().trim();
      const originHost = normalizedOrigin.replace(/^https?:\/\//i, '').toLowerCase();
      if (originHost === cleanReqHost) return true;
    }

    // Allow AI Studio preview and common tunnel/developer proxy domains
    const isPreviewOrTunnel =
      normalizedOrigin.endsWith('.run.app') ||
      normalizedOrigin.endsWith('.loca.lt') ||
      normalizedOrigin.endsWith('.ngrok-free.app') ||
      normalizedOrigin.endsWith('.trycloudflare.com');
    if (isPreviewOrTunnel) return true;

    // Allow user-configured frontend URLs (comma-separated list, supporting '*' or both http/https)
    const rawConfigUrls = config.frontendUrl || '';
    const configuredOrigins = rawConfigUrls
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    if (configuredOrigins.includes('*') || process.env.ALLOW_ALL_CORS === 'true') {
      return true;
    }

    for (const cfg of configuredOrigins) {
      if (cfg.toLowerCase() === normalizedOrigin.toLowerCase()) return true;
      // Also match if user specified domain without protocol or with alternate protocol
      const strippedCfg = cfg.replace(/^https?:\/\//i, '').toLowerCase();
      const strippedOrigin = normalizedOrigin.replace(/^https?:\/\//i, '').toLowerCase();
      if (strippedCfg === strippedOrigin) return true;
    }

    return false;
  };

  const apiCorsMiddleware = cors((req, callback) => {
    const origin = req.headers.origin as string | undefined;
    if (!origin) {
      // Allow requests with no origin (curl, same-origin, mobile apps)
      return callback(null, { origin: true });
    }

    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;

    if (isAllowedOrigin(origin, reqHost)) {
      callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
      });
    } else {
      console.warn(`[CORS] Rejected unconfigured origin: ${origin} (Host: ${reqHost})`);
      callback(null, {
        origin: false,
      });
    }
  });

  app.use('/api', apiCorsMiddleware);
  app.options('/api/*', apiCorsMiddleware);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Private VPS Cloud Storage API',
      timestamp: Date.now(),
    });
  });

  // Mount API modules
  app.use('/api/auth', authRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/storage', storageRouter);

  // 3. FRONTEND SERVING (Vite in Dev or Compiled Static SPA in Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VPS Cloud Storage server listening on port ${PORT}`);
    console.log(`Storage path: ${config.storagePath}`);
    console.log(`Database path: ${config.databasePath}`);
    console.log(`Allowed Frontend URL: ${config.frontendUrl}`);
  });
}

startServer();
