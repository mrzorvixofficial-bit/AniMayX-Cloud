import { Storage, File } from 'megajs';
import { config } from './config.ts';
import fs from 'fs';

let cachedStorage: Storage | null = null;
let loginPromise: Promise<Storage> | null = null;

export function isMegaConfigured(): boolean {
  return !!(config.megaEmail && config.megaPassword);
}

export async function getMegaStorage(): Promise<Storage> {
  if (cachedStorage) {
    return cachedStorage;
  }

  if (loginPromise) {
    return loginPromise;
  }

  if (!isMegaConfigured()) {
    throw new Error('MEGA storage credentials are not configured in environment variables');
  }

  loginPromise = (async () => {
    try {
      console.log('[MEGA] Initializing Storage connection...');
      const storage = new Storage({
        email: config.megaEmail,
        password: config.megaPassword,
        autologin: true,
        autoload: true,
      });

      // Prevent unhandled error crashes from network dropouts or keepalive ping timeouts
      (storage as any).on('error', (err: any) => {
        console.warn('[MEGA] Storage background warning:', err?.message || err);
      });
      if ((storage as any).api && typeof (storage as any).api.on === 'function') {
        (storage as any).api.on('error', (err: any) => {
          console.warn('[MEGA] Storage API background warning:', err?.message || err);
        });
      }

      await storage.ready;
      console.log(`[MEGA] Connection established successfully as ${storage.name || 'User'} (${storage.email}).`);
      cachedStorage = storage;
      return storage;
    } catch (err) {
      loginPromise = null;
      cachedStorage = null;
      console.error('[MEGA] Failed to login to MEGA:', err);
      throw err;
    }
  })();

  return loginPromise;
}

/**
 * Uploads a local file to MEGA storage.
 */
export async function uploadToMega(
  filePath: string,
  originalName: string,
  size: number
): Promise<{ nodeId: string; shareLink: string }> {
  const storage = await getMegaStorage();

  return new Promise((resolve, reject) => {
    try {
      console.log(`[MEGA] Starting upload for: ${originalName} (${size} bytes)`);
      const fileStream = fs.createReadStream(filePath);
      
      const uploadStream = storage.upload({
        name: originalName,
        size: size,
      });

      // Pipe the local file read stream into the writable upload stream
      fileStream.pipe(uploadStream as any);

      uploadStream.on('progress', (info) => {
        const percent = Math.round((info.bytesLoaded / info.bytesTotal) * 100);
        console.log(`[MEGA] Uploading ${originalName}: ${percent}% (${info.bytesLoaded}/${info.bytesTotal} bytes)`);
      });

      uploadStream.complete.then(async (megaFile) => {
        try {
          console.log(`[MEGA] Upload completed, generating share link...`);
          const shareLink = await megaFile.link({});
          console.log(`[MEGA] Generated share link: ${shareLink}`);
          resolve({
            nodeId: megaFile.nodeId!,
            shareLink: shareLink,
          });
        } catch (linkErr) {
          reject(linkErr);
        }
      }).catch((err) => {
        reject(err);
      });

      fileStream.on('error', (streamErr) => {
        reject(streamErr);
      });
      uploadStream.on('error', (uploadErr) => {
        reject(uploadErr);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a file from MEGA storage by nodeId if possible.
 */
export async function deleteFromMega(nodeId: string): Promise<boolean> {
  try {
    const storage = await getMegaStorage();
    const file = storage.files[nodeId];
    if (!file) {
      console.warn(`[MEGA] File with nodeId ${nodeId} not found in account cache.`);
      return false;
    }

    console.log(`[MEGA] Deleting file ${file.name} (${nodeId}) permanently...`);
    await file.delete(true); // Permanent delete
    console.log(`[MEGA] Deleted successfully.`);
    return true;
  } catch (err) {
    console.error(`[MEGA] Failed to delete file with nodeId ${nodeId}:`, err);
    return false;
  }
}

/**
 * Regenerates the share link for a file on MEGA storage using nodeId.
 */
export async function regenerateMegaLink(nodeId: string): Promise<string> {
  const storage = await getMegaStorage();
  const file = storage.files[nodeId];
  if (!file) {
    throw new Error(`File with nodeId ${nodeId} not found in MEGA account`);
  }

  console.log(`[MEGA] Regenerating share link for file ${file.name} (${nodeId})...`);
  const shareLink = await file.link({});
  return shareLink;
}

const fileInstanceCache = new Map<string, File>();

/**
 * Helper to download from a MEGA URL with optional range support.
 */
export function getMegaDownloadStream(shareLink: string, options: { start?: number; end?: number } = {}) {
  let file = fileInstanceCache.get(shareLink);
  if (!file) {
    file = File.fromURL(shareLink);
    fileInstanceCache.set(shareLink, file);
  }
  return file.download(options);
}
