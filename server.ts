import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { config, initDirectories } from './server/config.ts';
import authRouter from './server/routes/auth.ts';
import filesRouter from './server/routes/files.ts';
import uploadRouter from './server/routes/upload.ts';
import storageRouter from './server/routes/storage.ts';
import publicFileRouter, { sclRouter, inlineRouter } from './server/routes/publicFile.ts';

const currentFilename = typeof __filename !== 'undefined' ? __filename : '';
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : (currentFilename ? path.dirname(currentFilename) : process.cwd());

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
  // Resolve dist directory path safely across different launch contexts (root or dist subfolder)
  const candidateDistDirs = [
    path.join(process.cwd(), 'dist'),
    path.join(currentDirname, 'dist'),
    currentDirname,
  ];
  const distPath = candidateDistDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || path.join(process.cwd(), 'dist');
  const hasBuiltDist = fs.existsSync(path.join(distPath, 'index.html'));

  // If dist has been built and NODE_ENV is not explicitly 'development', serve production SPA
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(currentFilename && currentFilename.endsWith('server.cjs')) ||
    (hasBuiltDist && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets (CSS, JS, images, fonts)
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          // Allow cross-origin asset loading for stylesheets, scripts, fonts, and images
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
          } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          }
        },
      })
    );

    // SPA fallback: return index.html for page navigation, but return 404 for missing static assets
    app.get('*', (req, res, next) => {
      // If the request was for an asset (/assets/*, or file extension) that wasn't found by express.static,
      // return 404 instead of index.html so browsers don't fail MIME type checks on CSS/JS!
      if (
        req.path.startsWith('/assets/') ||
        /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i.test(req.path)
      ) {
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }

      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Production build not found. Please run "npm run build" first.');
      }
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
