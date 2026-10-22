import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAdmin } from '../auth.ts';
import { dbService } from '../db.ts';
import { config } from '../config.ts';
import { deleteFromMega, regenerateMegaLink } from '../mega.ts';
import {
  generateFileId,
  sanitizeFilename,
  getSafeFilePath,
  resolveMimeType,
  saveChunk,
  assembleChunks,
} from '../storage.ts';

const router = Router();

// Configure multer storage for direct file uploads
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storagePath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = generateFileId(8);
    // Attach generated id to file object for retrieval in route
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
    fileSize: 50 * 1024 * 1024, // 50MB per chunk max
  },
});

import { buildPublicUrl } from '../urlHelper.ts';

// 1. List files (Search, Category Filter, Sort)
router.get('/', requireAdmin, (req: Request, res: Response): void => {
  const { search, category, sort } = req.query as {
    search?: string;
    category?: string;
    sort?: string;
  };

  const files = dbService.getAllFiles(search, category, sort);
  const formatted = files.map((file) => ({
    ...file,
    public_url: buildPublicUrl(req, file.id, file.mime_type, file.original_name),
  }));

  res.json({ files: formatted });
});

// 2. Get single file details
router.get('/:id', requireAdmin, (req: Request, res: Response): void => {
  const file = dbService.getFileById(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.json({
    file: {
      ...file,
      public_url: buildPublicUrl(req, file.id, file.mime_type, file.original_name),
    },
  });
});

// 3. Direct upload (single or multiple)
router.post('/upload', requireAdmin, upload.single('file'), (req: Request, res: Response): void => {
  const uploaded = req.file as (Express.Multer.File & { customId?: string }) | undefined;
  if (!uploaded) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const id = uploaded.customId || generateFileId(8);
  const originalName = uploaded.originalname || 'file';
  const sanitized = sanitizeFilename(originalName);
  const mimeType = resolveMimeType(originalName, uploaded.mimetype);

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

// 4. Chunked Upload - Upload a single chunk
router.post('/upload/chunk', requireAdmin, chunkUpload.single('chunk'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body;
    const chunkFile = req.file;

    if (!uploadId || chunkIndex === undefined || !chunkFile) {
      res.status(400).json({ error: 'Missing chunk parameters' });
      return;
    }

    const index = parseInt(chunkIndex, 10);
    await saveChunk(uploadId, index, chunkFile.buffer);

    res.json({ success: true, chunkIndex: index });
  } catch (err) {
    console.error('Chunk upload failed:', err);
    res.status(500).json({ error: 'Failed to save chunk' });
  }
});

// 5. Chunked Upload - Complete & Assemble chunks
router.post('/upload/complete', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { uploadId, originalName, totalChunks, mimeType } = req.body;

    if (!uploadId || !originalName || !totalChunks) {
      res.status(400).json({ error: 'Missing completion parameters' });
      return;
    }

    const id = generateFileId(8);
    const ext = path.extname(originalName);
    const sanitized = sanitizeFilename(originalName);
    const internalFilename = `${id}_${Date.now()}${ext}`;

    const totalBytes = await assembleChunks(uploadId, parseInt(totalChunks, 10), internalFilename);
    const resolvedMime = resolveMimeType(originalName, mimeType);

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

// 6. Rename file
router.patch('/:id', requireAdmin, (req: Request, res: Response): void => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Valid file name is required' });
    return;
  }

  const existing = dbService.getFileById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const updated = dbService.updateFileName(req.params.id, name.trim());
  if (!updated) {
    res.status(500).json({ error: 'Failed to update filename' });
    return;
  }

  const file = dbService.getFileById(req.params.id);
  res.json({
    success: true,
    file: {
      ...file,
      public_url: buildPublicUrl(req, req.params.id, file?.mime_type, file?.original_name),
    },
  });
});

// 7. Delete file
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const existing = dbService.getFileById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Delete from MEGA if it's stored there
  if (existing.storage_backend === 'mega' && existing.mega_file_id) {
    try {
      await deleteFromMega(existing.mega_file_id);
    } catch (err) {
      console.warn('[MEGA] File deletion warning:', err);
    }
  } else {
    // Delete physical file
    try {
      const fullPath = getSafeFilePath(existing.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn('Physical file deletion warning:', err);
    }
  }

  // Delete database record
  dbService.deleteFile(req.params.id);
  res.json({ success: true, message: 'File deleted successfully' });
});

// 8. Regenerate MEGA share link
router.post('/:id/regenerate-link', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const existing = dbService.getFileById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  if (existing.storage_backend !== 'mega' || !existing.mega_file_id) {
    res.status(400).json({ error: 'This file is not stored on MEGA' });
    return;
  }

  try {
    const newLink = await regenerateMegaLink(existing.mega_file_id);
    dbService.updateMegaShareLink(existing.id, newLink);
    res.json({
      success: true,
      message: 'MEGA share link regenerated successfully',
      mega_share_link: newLink,
    });
  } catch (err: any) {
    console.error('[MEGA] Failed to regenerate link:', err);
    res.status(500).json({ error: `Failed to regenerate MEGA link: ${err.message || err}` });
  }
});

export default router;
