import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../auth.ts';
import { dbService } from '../db.ts';
import { config } from '../config.ts';

const router = Router();

// 1. List all folders with aggregated file count and size
router.get('/', requireAdmin, (req: Request, res: Response): void => {
  try {
    const folders = dbService.getAllFolders();
    res.json({ folders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve folders';
    res.status(500).json({ error: msg });
  }
});

// 2. Create a new folder
router.post('/', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { name, parent_path } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }

    const folder = dbService.createFolder(name.trim(), parent_path || '');
    res.status(201).json({ success: true, folder });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create folder';
    res.status(400).json({ error: msg });
  }
});

// 3. Rename a folder
router.patch('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }

    const updated = dbService.renameFolder(req.params.id, name.trim());
    if (!updated) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    res.json({ success: true, folder: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename folder';
    res.status(400).json({ error: msg });
  }
});

// 4. Delete a folder (optionally cascading file deletion)
router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const deleteFiles = req.query.deleteFiles === 'true' || req.query.delete_files === 'true';
    const result = dbService.deleteFolder(req.params.id, deleteFiles);

    if (!result.success) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    // If deleteFiles was requested, remove local physical files from disk
    if (deleteFiles && result.deletedFilePaths && result.deletedFilePaths.length > 0) {
      for (const filePath of result.deletedFilePaths) {
        try {
          const fullPath = path.join(config.storagePath, filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (unlinkErr) {
          console.warn(`[Storage] Failed to delete disk file ${filePath}:`, unlinkErr);
        }
      }
    }

    res.json({ success: true, deletedCount: result.deletedFilePaths.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete folder';
    res.status(500).json({ error: msg });
  }
});

export default router;
