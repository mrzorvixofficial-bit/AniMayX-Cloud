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

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  storagePath: path.resolve(rootDir, process.env.STORAGE_PATH || './storage/uploads'),
  databasePath: path.resolve(rootDir, process.env.DATABASE_PATH || './storage/metadata/storage.db'),
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

// Ensure required directories exist
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
