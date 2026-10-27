import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import { config } from './config.ts';

// Generate short random URL-safe ID like '8xK92m' or 'aB39kX1'
export function generateFileId(length: number = 8): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Sanitize filename to prevent directory traversal or malicious characters
export function sanitizeFilename(rawName: string): string {
  // Strip null bytes and control chars
  let clean = rawName.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  // Base name only (strip path slashes)
  clean = path.basename(clean);
  // Remove leading dots to prevent hidden files or traversal tricks
  clean = clean.replace(/^\.+/, '');
  // Replace dangerous characters with underscore
  clean = clean.replace(/[<>:"/\\|?*]/g, '_');
  // Trim spaces
  clean = clean.trim();
  return clean || 'unnamed_file';
}

// Safe internal storage path resolution
export function getSafeFilePath(internalFilename: string): string {
  // If already an absolute path that starts with config.storagePath
  if (path.isAbsolute(internalFilename) && internalFilename.startsWith(config.storagePath)) {
    return internalFilename;
  }
  // Base name only to prevent traversal
  const safeBase = path.basename(internalFilename);
  const resolved = path.resolve(config.storagePath, safeBase);
  if (!resolved.startsWith(config.storagePath)) {
    throw new Error('Access denied: Path traversal detected');
  }
  return resolved;
}

// Detect MIME type reliably
export function resolveMimeType(filename: string, fallbackMime?: string): string {
  const detected = mime.lookup(filename);
  if (detected) return detected;
  if (fallbackMime && fallbackMime !== 'application/octet-stream') return fallbackMime;
  return 'application/octet-stream';
}

// Disk and quota metrics
export async function getDiskMetrics(usedBytes: number) {
  let totalBytes = 100 * 1024 * 1024 * 1024; // 100 GB default quota
  let freeBytes = totalBytes - usedBytes;

  try {
    if (fs.statfsSync) {
      // Query filesystem where storagePath is mounted
      const stats = fs.statfsSync(config.storagePath);
      totalBytes = stats.blocks * stats.bsize;
      // In POSIX, bavail is available blocks for unprivileged users (real free space)
      freeBytes = (typeof stats.bavail === 'number' && stats.bavail > 0 ? stats.bavail : stats.bfree) * stats.bsize;
    }
  } catch {
    try {
      if (fs.statfsSync) {
        const stats = fs.statfsSync(process.cwd());
        totalBytes = stats.blocks * stats.bsize;
        freeBytes = (typeof stats.bavail === 'number' && stats.bavail > 0 ? stats.bavail : stats.bfree) * stats.bsize;
      }
    } catch {
      freeBytes = Math.max(0, totalBytes - usedBytes);
    }
  }

  return {
    used_bytes: usedBytes, // Size of AniMayX uploaded files
    disk_used_bytes: Math.max(0, totalBytes - freeBytes), // Total filesystem disk usage
    total_bytes: totalBytes, // Physical disk capacity
    free_bytes: freeBytes, // Physical disk free space
  };
}

// Save uploaded chunk
export async function saveChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<void> {
  const chunkDir = path.join(config.storagePath, '.temp_chunks', uploadId);
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }

  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  await fs.promises.writeFile(chunkPath, chunkBuffer);
}

// Assemble all chunks into final destination
export async function assembleChunks(
  uploadId: string,
  totalChunks: number,
  destinationInternalName: string
): Promise<number> {
  const chunkDir = path.join(config.storagePath, '.temp_chunks', uploadId);
  const destPath = getSafeFilePath(destinationInternalName);
  const writeStream = fs.createWriteStream(destPath);

  let totalBytesWritten = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      writeStream.close();
      try {
        fs.unlinkSync(destPath);
      } catch {}
      throw new Error(`Missing chunk index ${i} for upload ${uploadId}`);
    }

    const chunkData = await fs.promises.readFile(chunkPath);
    totalBytesWritten += chunkData.length;
    const canWrite = writeStream.write(chunkData);
    if (!canWrite) {
      await new Promise<void>((resolve) => writeStream.once('drain', () => resolve()));
    }

    // Immediately remove chunk file to conserve storage space during 100GB assemblies
    try {
      fs.unlinkSync(chunkPath);
    } catch {}
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Clean up chunks
  try {
    fs.rmSync(chunkDir, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to clean up chunk directory:', err);
  }

  return totalBytesWritten;
}
