import { Router, Request, Response } from 'express';
import { requireAdmin } from '../auth.ts';
import { dbService } from '../db.ts';
import { getDiskMetrics } from '../storage.ts';
import { config } from '../config.ts';
import { getAutoDetectedBaseUrl } from '../urlHelper.ts';

const router = Router();

router.get('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = dbService.getStats();
    const disk = await getDiskMetrics(stats.used_bytes);
    const autoBaseUrl = getAutoDetectedBaseUrl(req);
    const customUrl = dbService.getSetting('public_base_url');

    res.json({
      used_bytes: stats.used_bytes,
      disk_used_bytes: disk.disk_used_bytes,
      total_bytes: disk.total_bytes,
      free_bytes: disk.free_bytes,
      file_count: stats.file_count,
      storage_path: config.storagePath,
      by_type: stats.by_type,
      server_info: {
        storage_path: config.storagePath,
        database_path: config.databasePath,
        max_upload_size: config.maxUploadSize,
        public_base_url: autoBaseUrl,
        custom_public_base_url: customUrl || '',
        auto_detected_url: autoBaseUrl,
        frontend_url: config.frontendUrl,
      },
    });
  } catch (err) {
    console.error('Failed to get storage metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve storage statistics' });
  }
});

// GET /api/storage/url-config
router.get('/url-config', requireAdmin, (req: Request, res: Response): void => {
  const autoUrl = getAutoDetectedBaseUrl(req);
  const customUrl = dbService.getSetting('public_base_url') || '';
  res.json({
    auto_detected_url: autoUrl,
    custom_url: customUrl,
    effective_url: customUrl.trim() || autoUrl,
  });
});

// POST /api/storage/url-config
router.post('/url-config', requireAdmin, (req: Request, res: Response): void => {
  const { custom_url } = req.body;
  const trimmed = typeof custom_url === 'string' ? custom_url.trim() : '';
  if (trimmed) {
    dbService.setSetting('public_base_url', trimmed);
  } else {
    // If empty or null, clear it to revert to auto-detect
    dbService.setSetting('public_base_url', '');
  }

  const autoUrl = getAutoDetectedBaseUrl(req);
  const updatedCustom = dbService.getSetting('public_base_url') || '';
  res.json({
    success: true,
    auto_detected_url: autoUrl,
    custom_url: updatedCustom,
    effective_url: updatedCustom || autoUrl,
  });
});

export default router;
