import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const rootDir = process.cwd();

// Load environment variables from .env if present
dotenv.config();

// Always read .env.example with override for MEGA credentials and defaults
const envExamplePath = path.resolve(rootDir, '.env.example');
if (fs.existsSync(envExamplePath)) {
  try {
    const exampleParsed = dotenv.parse(fs.readFileSync(envExamplePath, 'utf8'));
    if (exampleParsed.MEGA_EMAIL) {
      process.env.MEGA_EMAIL = exampleParsed.MEGA_EMAIL;
    }
    if (exampleParsed.MEGA_PASSWORD) {
      process.env.MEGA_PASSWORD = exampleParsed.MEGA_PASSWORD;
    }
    dotenv.config({ path: envExamplePath });
  } catch (err) {
    console.warn('Failed to parse .env.example:', err);
  }
}

// 100GB in bytes (100 * 1024 * 1024 * 1024)
const DEFAULT_100GB = 100 * 1024 * 1024 * 1024;

function parseMaxUploadSize(): number {
  const envVal = process.env.MAX_UPLOAD_SIZE;
  if (!envVal) return DEFAULT_100GB;
  const parsed = parseInt(envVal, 10);
  // If the env variable was set to a placeholder or smaller than 10MB (like 100000), default to 100GB
  if (isNaN(parsed) || parsed < 10 * 1024 * 1024) {
    return DEFAULT_100GB;
  }
  return parsed;
}

/**
 * Resolves the storage directory for uploaded files.
 * Default: /opt/AniMayX-Cloud/storage/uploads on VPS, with environment override support.
 */
function resolveStoragePath(): string {
  const envPath = process.env.STORAGE_PATH?.trim();
  if (envPath && envPath !== './storage/uploads') {
    return path.resolve(envPath);
  }

  const vpsDefault = '/opt/AniMayX-Cloud/storage/uploads';

  // If running at /opt/AniMayX-Cloud or that path exists
  if (fs.existsSync('/opt/AniMayX-Cloud') || process.cwd() === '/opt/AniMayX-Cloud') {
    return vpsDefault;
  }

  // If /opt is accessible and writable on Linux VPS
  try {
    if (fs.existsSync('/opt') && process.platform === 'linux' && !fs.existsSync('/app/applet')) {
      return vpsDefault;
    }
  } catch {}

  // If vpsDefault exists or can be used
  if (fs.existsSync(vpsDefault)) {
    return vpsDefault;
  }

  // Fallback to local workspace if running in developer sandbox
  return path.resolve(rootDir, 'storage/uploads');
}

/**
 * Resolves the SQLite metadata database path.
 * Default: /opt/AniMayX-Cloud/storage/metadata/storage.db on VPS, with environment override support.
 */
function resolveDatabasePath(): string {
  const envPath = process.env.DATABASE_PATH?.trim();
  if (envPath && envPath !== './storage/metadata/storage.db') {
    return path.resolve(envPath);
  }

  const vpsDefault = '/opt/AniMayX-Cloud/storage/metadata/storage.db';

  if (fs.existsSync('/opt/AniMayX-Cloud') || process.cwd() === '/opt/AniMayX-Cloud') {
    return vpsDefault;
  }

  try {
    if (fs.existsSync('/opt') && process.platform === 'linux' && !fs.existsSync('/app/applet')) {
      return vpsDefault;
    }
  } catch {}

  if (fs.existsSync(vpsDefault)) {
    return vpsDefault;
  }

  return path.resolve(rootDir, 'storage/metadata/storage.db');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  storagePath: resolveStoragePath(),
  databasePath: resolveDatabasePath(),
  jwtSecret: process.env.JWT_SECRET || 'private-cloud-storage-super-secret-jwt-key-998877',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  adminPassword: process.env.ADMIN_PASSWORD || 'Master',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000,https://localhost:3000',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  maxUploadSize: parseMaxUploadSize(),
  get megaEmail(): string {
    if (fs.existsSync(envExamplePath)) {
      try {
        const parsed = dotenv.parse(fs.readFileSync(envExamplePath, 'utf8'));
        if (parsed.MEGA_EMAIL) return parsed.MEGA_EMAIL.trim();
      } catch {}
    }
    return (process.env.MEGA_EMAIL || '').trim();
  },
  get megaPassword(): string {
    if (fs.existsSync(envExamplePath)) {
      try {
        const parsed = dotenv.parse(fs.readFileSync(envExamplePath, 'utf8'));
        if (parsed.MEGA_PASSWORD) return parsed.MEGA_PASSWORD.trim();
      } catch {}
    }
    return (process.env.MEGA_PASSWORD || '').trim();
  },
};

// Ensure required directories exist safely during startup
export function initDirectories() {
  const uploadDir = config.storagePath;
  const dbDir = path.dirname(config.databasePath);
  const chunksDir = path.join(uploadDir, '.temp_chunks');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }
}
