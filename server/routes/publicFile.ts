import { Router, Request, Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import { dbService, DbFile } from '../db.ts';
import { getSafeFilePath, resolveMimeType } from '../storage.ts';
import {
  getAutoDetectedBaseUrl,
  createInlineToken,
  resolveFileIdFromInlineToken,
} from '../urlHelper.ts';
import { getMegaDownloadStream } from '../mega.ts';

/**
 * Handles proxy streaming for files stored in MEGA storage.
 * Supports Range Requests (HTTP 206) for video seeking.
 */
export function streamMegaFileContent(fileRecord: DbFile, req: Request, res: Response): void {
  if (!fileRecord.mega_share_link) {
    res.status(404).send('MEGA share link missing');
    return;
  }

  const fileSize = fileRecord.size;

  // Track download / access asynchronously
  try {
    dbService.incrementDownload(fileRecord.id);
  } catch {}

  // Generate ETag from size and ID
  const etag = `"${crypto.createHash('md5').update(`mega-${fileRecord.id}-${fileSize}`).digest('hex')}"`;

  // Headers for cross-origin embedding (allowing <video>, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, If-None-Match, If-Modified-Since');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);

  // Cache-Control: Cache aggressively for static assets
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  // Check If-None-Match header for 304 Not Modified
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  const mimeType = resolveMimeType(fileRecord.original_name, fileRecord.mime_type);
  res.setHeader('Content-Type', mimeType);

  // Content-Disposition: inline by default, or attachment if ?download=1 or ?dl=1
  const forceDownload = req.query.download === '1' || req.query.dl === '1';
  const dispositionType = forceDownload ? 'attachment' : 'inline';
  const encodedName = encodeURIComponent(fileRecord.original_name).replace(/['()]/g, escape);
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${fileRecord.sanitized_name}"; filename*=UTF-8''${encodedName}`
  );

  // If HEAD request, return headers only
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', fileSize);
    res.status(200).end();
    return;
  }

  // Handle Range Requests (seeking)
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Check valid range
    if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).send('Requested Range Not Satisfiable');
      return;
    }

    const chunkLength = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkLength);

    try {
      const stream = getMegaDownloadStream(fileRecord.mega_share_link, { start, end });
      let streamCleaned = false;
      const cleanup = () => {
        if (!streamCleaned) {
          streamCleaned = true;
          try {
            (stream as any)?.destroy?.();
          } catch {}
        }
      };
      req.on('close', cleanup);
      res.on('close', cleanup);

      stream.on('error', (err: any) => {
        cleanup();
        console.warn('[MEGA] Cloud stream notice for range request:', err?.message || err);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Cloud streaming range request failed',
            details: err?.message || 'Object not found or expired',
          });
        }
      });
      stream.pipe(res);
    } catch (err: any) {
      console.warn('[MEGA] Cloud stream range init notice:', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Cloud stream initialization failed',
          details: err?.message || 'Object not found or expired',
        });
      }
    }
  } else {
    // Standard full-file response
    res.setHeader('Content-Length', fileSize);
    res.status(200);

    try {
      const stream = getMegaDownloadStream(fileRecord.mega_share_link);
      let streamCleaned = false;
      const cleanup = () => {
        if (!streamCleaned) {
          streamCleaned = true;
          try {
            (stream as any)?.destroy?.();
          } catch {}
        }
      };
      req.on('close', cleanup);
      res.on('close', cleanup);

      stream.on('error', (err: any) => {
        cleanup();
        console.warn('[MEGA] Cloud stream notice:', err?.message || err);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Cloud streaming failed',
            details: err?.message || 'Object not found or expired',
          });
        }
      });
      stream.pipe(res);
    } catch (err: any) {
      console.warn('[MEGA] Cloud stream init notice:', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Cloud stream initialization failed',
          details: err?.message || 'Object not found or expired',
        });
      }
    }
  }
}

/**
 * Common high-performance streaming engine for files.
 * Handles HTTP 206 Partial Content (Range requests for video seeking),
 * ETags, Cache-Control, and cross-origin resource sharing headers.
 */
export function streamFileContent(fileRecord: DbFile, req: Request, res: Response): void {
  // If local physical file exists on disk (cached or primary), stream it with ultra-fast zero-latency local I/O
  if (fileRecord.file_path) {
    try {
      const fullPath = getSafeFilePath(fileRecord.file_path);
      if (fs.existsSync(fullPath)) {
        return streamLocalFileContent(fileRecord, fullPath, req, res);
      }
    } catch {}
  }

  // Fallback to MEGA cloud stream if storage backend is MEGA
  if (fileRecord.storage_backend === 'mega') {
    return streamMegaFileContent(fileRecord, req, res);
  }

  let fullPath: string;
  try {
    fullPath = getSafeFilePath(fileRecord.file_path);
  } catch {
    res.status(403).send('Forbidden');
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.status(404).send('Physical file missing from storage');
    return;
  }

  streamLocalFileContent(fileRecord, fullPath, req, res);
}

function streamLocalFileContent(fileRecord: DbFile, fullPath: string, req: Request, res: Response): void {
  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;

  // Track download / access asynchronously
  try {
    dbService.incrementDownload(fileRecord.id);
  } catch {}

  // Generate ETag from size and modification timestamp
  const etag = `"${crypto.createHash('md5').update(`${stat.mtimeMs}-${fileSize}`).digest('hex')}"`;

  // Headers for cross-origin embedding (allowing <img>, <video>, <audio> on any site)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, If-None-Match, If-Modified-Since');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

  // Cache-Control: Cache aggressively for static raw assets
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  // Check If-None-Match header for 304 Not Modified
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  const mimeType = resolveMimeType(fileRecord.original_name, fileRecord.mime_type);
  res.setHeader('Content-Type', mimeType);

  // Content-Disposition: inline by default, or attachment if ?download=1 or ?dl=1
  const forceDownload = req.query.download === '1' || req.query.dl === '1';
  const dispositionType = forceDownload ? 'attachment' : 'inline';
  const encodedName = encodeURIComponent(fileRecord.original_name).replace(/['()]/g, escape);
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${fileRecord.sanitized_name}"; filename*=UTF-8''${encodedName}`
  );

  // If HEAD request, return headers only
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', fileSize);
    res.status(200).end();
    return;
  }

  // Handle HTTP Range Requests (Essential for video seeking and large media streaming)
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Check valid range
    if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).send('Requested Range Not Satisfiable');
      return;
    }

    const chunkLength = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkLength);

    const stream = fs.createReadStream(fullPath, { start, end });
    stream.on('error', (err) => {
      console.error('Error streaming range:', err);
      if (!res.headersSent) {
        res.status(500).send('Streaming error');
      }
    });
    stream.pipe(res);
  } else {
    // Standard full-file response
    res.setHeader('Content-Length', fileSize);
    res.status(200);

    const stream = fs.createReadStream(fullPath);
    stream.on('error', (err) => {
      console.error('Error streaming file:', err);
      if (!res.headersSent) {
        res.status(500).send('Streaming error');
      }
    });
    stream.pipe(res);
  }
}

/**
 * 1. DROPBOX MAIN LINK ROUTER: /scl/fi/:id or /scl/fi/:id/:filename
 * Example: https://animayx-cloud.oreox.qzz.io/scl/fi/t1hn1d9y3zwhdwd53bv1c/video.mkv?rlkey=0dzl8kpjk2eupway062i5b6d2&st=cl4u0103&raw=1
 * Directly serves and streams the file with HTTP 200/206 Range requests without redirects!
 */
export const sclRouter = Router();

sclRouter.get(['/:id', '/:id/:filename'], (req: Request, res: Response): void => {
  const fileId = req.params.id;

  // Validate ID format (alphanumeric only, 4 to 32 chars)
  if (!fileId || !/^[a-zA-Z0-9_-]{4,32}$/.test(fileId)) {
    res.status(404).send('File not found');
    return;
  }

  const fileRecord = dbService.getFileById(fileId);
  if (!fileRecord) {
    res.status(404).send('File not found');
    return;
  }

  // Directly stream the file content (range requests, audio, video, raw media)
  streamFileContent(fileRecord, req, res);
});

/**
 * 2. DROPBOX INLINE STREAM ROUTER: /cd/0/inline/:token/file or /cd/0/inline/:token/:filename
 * Example: https://animayx-cloud.oreox.qzz.io/cd/0/inline/DHkMc5M5-r47XoZm1Y9.../file#
 * Directly serves and streams the requested media file with HTTP Range seeking.
 */
export const inlineRouter = Router();

inlineRouter.get(['/:token/file', '/:token/:filename', '/:token'], (req: Request, res: Response): void => {
  const token = req.params.token;
  if (!token) {
    res.status(404).send('File token missing');
    return;
  }

  const fileId = resolveFileIdFromInlineToken(token);
  if (!fileId) {
    res.status(404).send('Invalid or expired file link');
    return;
  }

  const fileRecord = dbService.getFileById(fileId);
  if (!fileRecord) {
    res.status(404).send('File not found');
    return;
  }

  streamFileContent(fileRecord, req, res);
});

/**
 * 3. LEGACY PUBLIC FILE ROUTER: /f/:id or /f/:id/:filename
 * Directly serves and streams the requested media file without redirects.
 */
export const publicFileRouter = Router();

publicFileRouter.get(['/:id', '/:id/:filename'], (req: Request, res: Response): void => {
  const fileId = req.params.id;

  if (!fileId || !/^[a-zA-Z0-9_-]{4,32}$/.test(fileId)) {
    res.status(404).send('File not found');
    return;
  }

  const fileRecord = dbService.getFileById(fileId);
  if (!fileRecord) {
    res.status(404).send('File not found');
    return;
  }

  streamFileContent(fileRecord, req, res);
});

export default publicFileRouter;
