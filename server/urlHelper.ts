import { Request } from 'express';
import crypto from 'crypto';
import { config } from './config.ts';
import { dbService } from './db.ts';

// Deterministic 256-bit key for encrypting and decrypting Dropbox-style inline stream tokens
const INLINE_TOKEN_SECRET = crypto
  .createHash('sha256')
  .update((config.jwtSecret || 'animayx_cloud_secret_key') + '_animayx_inline_salt')
  .digest();

/**
 * Generates realistic Dropbox-style sharing keys for a file.
 * rlkey: 25-char alphanumeric key (e.g. 0dzl8kpjk2eupway062i5b6d2)
 * st: 8-char alphanumeric share token (e.g. cl4u0103)
 */
export function generateDropboxKeys(fileId: string): { rlkey: string; st: string } {
  const hash1 = crypto.createHash('sha256').update(fileId + '_animayx_rlkey_seed').digest('hex');
  const hash2 = crypto.createHash('md5').update(fileId + '_animayx_st_seed').digest('hex');

  // Generate 25 lowercase alphanumeric chars for rlkey, 8 for st
  const rlkey = hash1.slice(0, 25);
  const st = hash2.slice(0, 8);
  return { rlkey, st };
}

/**
 * Encrypts a file ID into a realistic Dropbox-style inline stream token (~140 base64url characters).
 * Example: DHkMc5M5-r47XoZm1Y9_-JBoDUrkP1UUEuFJXYo4rjT9HelsVDYWh_B3pcDbFddQqXUg_yfAHO2L-InNCdWDe7vony_4FbN8r4lPGiXstIrIK_axlyQLTlcYGWTC8gMBm7X5bxZkMlckoVXiecIl0thP
 */
export function createInlineToken(fileId: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', INLINE_TOKEN_SECRET, iv);
  // Add 28 bytes of random padding to match the ~144 character token length of Dropbox
  const padding = crypto.randomBytes(28).toString('base64url');
  const payload = JSON.stringify({
    fid: fileId,
    t: Date.now(),
    p: padding,
  });
  let encrypted = cipher.update(payload, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const combined = Buffer.concat([iv, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypts and resolves a file ID from a Dropbox-style inline stream token.
 */
export function resolveFileIdFromInlineToken(token: string): string | null {
  if (!token) return null;

  // Try direct decryption
  try {
    const combined = Buffer.from(token, 'base64url');
    if (combined.length >= 32) {
      const iv = combined.subarray(0, 16);
      const encrypted = combined.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', INLINE_TOKEN_SECRET, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      const data = JSON.parse(decrypted.toString('utf8'));
      if (data && data.fid) {
        return data.fid;
      }
    }
  } catch {
    // Decryption failed; fall back to raw ID check
  }

  // Fallback: check if the token itself is a valid fileId or alias in the database
  try {
    const directFile = dbService.getFileById(token);
    if (directFile) return directFile.id;
  } catch {}

  return null;
}

/**
 * Determines if a file is a video based on mime type or file extension.
 */
export function isVideoFile(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().startsWith('video/')) {
    return true;
  }
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const videoExts = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp', 'ts', 'ogv'];
    if (ext && videoExts.includes(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Automatically analyzes and resolves the website's public base URL.
 * Checks persistent database setting -> environment variable -> request headers (Origin, Referer, X-Forwarded-Host).
 */
export function getAutoDetectedBaseUrl(req: Request): string {
  // 1. Check persistent SQLite database setting configured by Admin
  const dbCustomUrl = dbService.getSetting('public_base_url');
  if (dbCustomUrl && dbCustomUrl.trim() && !dbCustomUrl.includes('localhost') && !dbCustomUrl.includes('127.0.0.1')) {
    return dbCustomUrl.trim().replace(/\/+$/, '');
  }

  // 2. Auto-detect from X-Forwarded-Host & X-Forwarded-Proto (from Nginx, Cloud Run, Cloudflare, etc.)
  const forwardedHostRaw = req.headers['x-forwarded-host'];
  const forwardedHost = (Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : (forwardedHostRaw as string | undefined))
    ?.split(',')[0]
    ?.trim();

  const forwardedProtoRaw = req.headers['x-forwarded-proto'];
  const forwardedProto = (Array.isArray(forwardedProtoRaw) ? forwardedProtoRaw[0] : (forwardedProtoRaw as string | undefined))
    ?.split(',')[0]
    ?.trim();

  const proto = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host');

  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  // 3. Auto-detect from Origin header (sent by browser client on fetch/XHR)
  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    if (!cleanOrigin.includes('localhost') && !cleanOrigin.includes('127.0.0.1')) {
      return cleanOrigin;
    }
  }

  // 4. Auto-detect from Referer header (sent by browser during page visits/actions)
  const referer = req.headers.referer;
  if (referer && typeof referer === 'string') {
    try {
      const parsed = new URL(referer);
      if (!parsed.hostname.includes('localhost') && !parsed.hostname.includes('127.0.0.1')) {
        return parsed.origin.replace(/\/+$/, '');
      }
    } catch {
      // ignore parsing error
    }
  }

  // 5. Check process.env.PUBLIC_BASE_URL (only if NOT localhost/127.0.0.1)
  if (config.publicBaseUrl && config.publicBaseUrl.trim() && !config.publicBaseUrl.includes('localhost') && !config.publicBaseUrl.includes('127.0.0.1')) {
    return config.publicBaseUrl.trim().replace(/\/+$/, '');
  }

  // 6. Check FRONTEND_URL config for any non-localhost website domain
  if (config.frontendUrl && config.frontendUrl.trim()) {
    const candidate = config.frontendUrl.split(',').map((s) => s.trim()).find((u) => u.startsWith('http') && !u.includes('localhost') && !u.includes('127.0.0.1'));
    if (candidate) {
      return candidate.replace(/\/+$/, '');
    }
  }

  // 7. Fallback: if origin exists (even localhost/dev), use it
  if (origin && typeof origin === 'string') {
    return origin.trim().replace(/\/+$/, '');
  }

  // 8. Last fallback to req host
  return `${proto}://${host || 'localhost:3000'}`.replace(/\/+$/, '');
}

/**
 * Builds the Dropbox-style main sharing link.
 * Example: https://animayx-cloud.oreox.qzz.io/scl/fi/t1hn1d9y3zwhdwd53bv1c/video.mkv?rlkey=0dzl8kpjk2eupway062i5b6d2&st=cl4u0103&raw=1
 */
export function buildDropboxMainUrl(baseUrl: string, id: string, fileName?: string, mimeType?: string): string {
  const { rlkey, st } = generateDropboxKeys(id);
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const actualName = fileName || 'file';
  const encodedName = encodeURIComponent(actualName);
  const isVid = isVideoFile(actualName, mimeType);
  const rawParam = isVid ? '&raw=1' : '&raw=1'; // default raw streaming parameter for direct access
  return `${cleanBase}/scl/fi/${id}/${encodedName}?rlkey=${rlkey}&st=${st}${rawParam}`;
}

/**
 * Builds the Dropbox-style resolved inline streaming link.
 * Example: https://animayx-cloud.oreox.qzz.io/cd/0/inline/DHkMc5M5-r47XoZm.../file#
 */
export function buildDropboxInlineUrl(baseUrl: string, id: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const token = createInlineToken(id);
  return `${cleanBase}/cd/0/inline/${token}/file#`;
}

/**
 * Builds the public file URL for a given file ID in Dropbox main format.
 */
export function buildPublicUrl(req: Request, id: string, mimeType?: string, fileName?: string): string {
  const baseUrl = getAutoDetectedBaseUrl(req);
  return buildDropboxMainUrl(baseUrl, id, fileName, mimeType);
}
