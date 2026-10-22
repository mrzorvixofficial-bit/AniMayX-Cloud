import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAdmin } from '../auth.ts';
import { dbService } from '../db.ts';
import { config } from '../config.ts';
import {
  generateFileId,
  sanitizeFilename,
  resolveMimeType,
  saveChunk,
  assembleChunks,
} from '../storage.ts';

const router = Router();

// Configure multer disk storage for file uploads
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storagePath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = generateFileId(8);
    (file as unknown as { customId: string }).customId = id;
    cb(null, `${id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: config.maxUploadSize,
  },
});

// Multer memory storage for chunked uploads
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per chunk max
  },
});

import { buildPublicUrl } from '../urlHelper.ts';
import fs from 'fs';
import { isMegaConfigured, uploadToMega } from '../mega.ts';

function isVideoFile(filename: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('video/') || mime === 'application/x-matroska') {
    return true;
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const videoExts = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp', 'ts', 'ogv'];
  return videoExts.includes(ext);
}

// 1. Direct Upload: POST /api/upload
router.post(
  '/',
  requireAdmin,
  (req: Request, res: Response, next: () => void) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File too large. Maximum file upload limit is 100GB.',
          });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(500).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
  const uploaded = req.file as (Express.Multer.File & { customId?: string }) | undefined;
  if (!uploaded) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const id = uploaded.customId || generateFileId(8);
  const originalName = uploaded.originalname || 'file';
  const sanitized = sanitizeFilename(originalName);
  const mimeType = resolveMimeType(originalName, uploaded.mimetype);
  const folderPath = req.body.folderPath || null;

  const localFilePath = path.join(config.storagePath, uploaded.filename);
  let storageBackend: 'local' | 'mega' = 'local';
  let megaFileId: string | null = null;
  let megaShareLink: string | null = null;

  const isVid = isVideoFile(originalName, mimeType);
  if (isVid && isMegaConfigured()) {
    try {
      const megaResult = await uploadToMega(localFilePath, originalName, uploaded.size);
      storageBackend = 'mega';
      megaFileId = megaResult.nodeId;
      megaShareLink = megaResult.shareLink;
    } catch (err: any) {
      console.warn('[MEGA] Direct upload failed, falling back to local storage:', err.message || err);
      storageBackend = 'local';
    }
  }

  const fileRecord = {
    id,
    original_name: originalName,
    sanitized_name: sanitized,
    file_path: uploaded.filename,
    mime_type: mimeType,
    size: uploaded.size,
    created_at: Date.now(),
    updated_at: Date.now(),
    download_count: 0,
    folder_path: folderPath,
    storage_backend: storageBackend,
    mega_file_id: megaFileId,
    mega_share_link: megaShareLink,
    upload_status: 'completed' as const,
  };

  dbService.insertFile(fileRecord);

  res.status(201).json({
    success: true,
    file: {
      ...fileRecord,
      public_url: buildPublicUrl(req, id, fileRecord.mime_type, fileRecord.original_name),
    },
  });
});

// 2. Chunk Upload: POST /api/upload/chunk
router.post(
  '/chunk',
  requireAdmin,
  (req: Request, res: Response, next: () => void) => {
    chunkUpload.single('chunk')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Chunk too large (maximum 100MB per chunk).' });
        }
        return res.status(400).json({ error: `Chunk upload error: ${err.message}` });
      } else if (err) {
        return res.status(500).json({ error: err.message || 'Chunk upload failed' });
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId, chunkIndex, totalChunks } = req.body;
      const chunkFile = req.file;

      if (!uploadId || chunkIndex === undefined || !chunkFile) {
        res.status(400).json({ error: 'Missing chunk parameters' });
        return;
      }

      const index = parseInt(chunkIndex, 10);
      await saveChunk(uploadId, index, chunkFile.buffer);

      res.json({ success: true, chunkIndex: index, totalChunks: parseInt(totalChunks, 10) });
    } catch (err) {
      console.error('Chunk upload failed:', err);
      res.status(500).json({ error: 'Failed to save chunk' });
    }
  }
);

// 3. Complete Chunked Upload: POST /api/upload/complete
router.post('/complete', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { uploadId, originalName, totalChunks, mimeType, folderPath } = req.body;

    if (!uploadId || !originalName || !totalChunks) {
      res.status(400).json({ error: 'Missing completion parameters' });
      return;
    }

    const id = generateFileId(8);
    const ext = path.extname(originalName);
    const sanitized = sanitizeFilename(originalName);
    const internalFilename = `${id}_${Date.now()}${ext}`;

    const totalBytes = await assembleChunks(uploadId, parseInt(totalChunks, 10), internalFilename);
    const localFilePath = path.join(config.storagePath, internalFilename);

    if (totalBytes > config.maxUploadSize) {
      try {
        fs.unlinkSync(localFilePath);
      } catch {}
      res.status(413).json({
        error: `File too large. Total assembled size exceeds the maximum limit of 100GB.`,
      });
      return;
    }

    const resolvedMime = resolveMimeType(originalName, mimeType);
    let storageBackend: 'local' | 'mega' = 'local';
    let megaFileId: string | null = null;
    let megaShareLink: string | null = null;

    const isVid = isVideoFile(originalName, resolvedMime);
    if (isVid && isMegaConfigured()) {
      try {
        const megaResult = await uploadToMega(localFilePath, originalName, totalBytes);
        storageBackend = 'mega';
        megaFileId = megaResult.nodeId;
        megaShareLink = megaResult.shareLink;
      } catch (err: any) {
        console.warn('[MEGA] Chunked upload failed to sync to MEGA, falling back to local storage:', err.message || err);
        storageBackend = 'local';
      }
    }

    const fileRecord = {
      id,
      original_name: originalName,
      sanitized_name: sanitized,
      file_path: internalFilename,
      mime_type: resolvedMime,
      size: totalBytes,
      created_at: Date.now(),
      updated_at: Date.now(),
      download_count: 0,
      folder_path: folderPath || null,
      storage_backend: storageBackend,
      mega_file_id: megaFileId,
      mega_share_link: megaShareLink,
      upload_status: 'completed' as const,
    };

    dbService.insertFile(fileRecord);

    res.status(201).json({
      success: true,
      file: {
        ...fileRecord,
        public_url: buildPublicUrl(req, id, fileRecord.mime_type, fileRecord.original_name),
      },
    });
  } catch (err) {
    console.error('Failed to assemble chunks:', err);
    res.status(500).json({ error: 'Failed to assemble uploaded chunks' });
  }
});

export default router;
