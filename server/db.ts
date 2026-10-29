import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config, initDirectories } from './config.ts';
import { generateFileId, sanitizeFilename, resolveMimeType } from './storage.ts';

initDirectories();

export interface DbFile {
  id: string;
  original_name: string;
  sanitized_name: string;
  file_path: string;
  mime_type: string;
  size: number;
  created_at: number;
  updated_at: number;
  download_count: number;
  folder_path?: string | null;
  storage_backend?: 'local' | 'mega';
  mega_file_id?: string | null;
  mega_share_link?: string | null;
  upload_status?: string | null;
}

export interface DbFolder {
  id: string;
  name: string;
  path: string;
  parent_path: string;
  created_at: number;
  updated_at: number;
  file_count?: number;
  total_size?: number;
}

let dbInstance: DatabaseSync | null = null;

/**
 * Reconciles physical files in storage directory with SQLite database records.
 * Ensures existing files on VPS storage are indexed, counted, and searchable.
 */
export function syncStorageRecordsWithDisk(db: DatabaseSync): void {
  try {
    const uploadDir = config.storagePath;
    if (!fs.existsSync(uploadDir)) return;

    const entries = fs.readdirSync(uploadDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      // Skip hidden files, system files, chunks directory, or temporary files
      if (entry.name.startsWith('.') || entry.name.endsWith('.db') || entry.name.endsWith('.tmp')) continue;

      const fullPath = path.join(uploadDir, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile() || stat.size === 0) continue;

        // Check if file is already in the database by file_path or sanitized_name
        const stmt = db.prepare('SELECT id FROM files WHERE file_path = ? OR sanitized_name = ?');
        const existing = stmt.get(entry.name, entry.name) as { id: string } | undefined;

        if (!existing) {
          // Check if filename has format <id>_<timestamp>.<ext>
          const match = entry.name.match(/^([a-zA-Z0-9_-]{8})_\d+(\.[a-zA-Z0-9]+)$/);
          const id = match ? match[1] : generateFileId(8);
          const originalName = match ? entry.name.substring(9) : entry.name;
          const mimeType = resolveMimeType(entry.name);

          const insertStmt = db.prepare(`
            INSERT INTO files (id, original_name, sanitized_name, file_path, mime_type, size, created_at, updated_at, download_count, storage_backend, upload_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertStmt.run(
            id,
            originalName,
            sanitizeFilename(entry.name),
            entry.name,
            mimeType,
            stat.size,
            Math.floor(stat.birthtimeMs || stat.mtimeMs || Date.now()),
            Math.floor(stat.mtimeMs || Date.now()),
            0,
            'local',
            'completed'
          );
          console.log(`[Storage] Synced disk file to database: ${entry.name} (${stat.size} bytes, id=${id})`);
        }
      } catch (err) {
        console.warn(`[Storage] Skipping file ${entry.name}:`, err);
      }
    }
  } catch (err) {
    console.warn('[Storage] Sync with disk warning:', err);
  }
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(config.databasePath);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    initSchema(dbInstance);
    syncStorageRecordsWithDisk(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      sanitized_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      download_count INTEGER DEFAULT 0
    );
  `);

  // Safely alter table to add columns if they don't exist
  try {
    db.exec(`ALTER TABLE files ADD COLUMN folder_path TEXT;`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE files ADD COLUMN storage_backend TEXT DEFAULT 'local';`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE files ADD COLUMN mega_file_id TEXT;`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE files ADD COLUMN mega_share_link TEXT;`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE files ADD COLUMN upload_status TEXT DEFAULT 'completed';`);
  } catch (err) {}

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type);
    CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_path);

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      parent_path TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_path);

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrate/ensure existing folder_paths from files table exist in folders table
  try {
    const existingFolderRows = db.prepare(`SELECT DISTINCT folder_path FROM files WHERE folder_path IS NOT NULL AND folder_path != ''`).all() as { folder_path: string }[];
    for (const row of existingFolderRows) {
      if (!row.folder_path) continue;
      const parts = row.folder_path.split('/').map(p => p.trim()).filter(Boolean);
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${seg}` : seg;
        try {
          db.prepare(`
            INSERT OR IGNORE INTO folders (id, name, path, parent_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            seg,
            currentPath,
            parentPath,
            Date.now(),
            Date.now()
          );
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[Folders] Syncing initial folders warning:', err);
  }
}

export const dbService = {
  insertFile(file: DbFile): void {
    const db = getDb();
    if (file.folder_path && file.folder_path.trim()) {
      dbService.ensureFolderPath(file.folder_path.trim());
    }
    const stmt = db.prepare(`
      INSERT INTO files (id, original_name, sanitized_name, file_path, mime_type, size, created_at, updated_at, download_count, folder_path, storage_backend, mega_file_id, mega_share_link, upload_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      file.id,
      file.original_name,
      file.sanitized_name,
      file.file_path,
      file.mime_type,
      file.size,
      file.created_at,
      file.updated_at,
      file.download_count || 0,
      file.folder_path || null,
      file.storage_backend || 'local',
      file.mega_file_id || null,
      file.mega_share_link || null,
      file.upload_status || 'completed'
    );
  },

  getFileById(id: string): DbFile | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
    const result = stmt.get(id) as unknown as DbFile | undefined;
    return result || null;
  },

  getAllFiles(search?: string, category?: string, sort: string = 'date_desc'): DbFile[] {
    const db = getDb();
    let query = 'SELECT * FROM files WHERE 1=1';
    const params: (string | number)[] = [];

    if (search && search.trim().length > 0) {
      query += ' AND (original_name LIKE ? OR sanitized_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (category && category !== 'all') {
      if (category === 'image') {
        query += " AND mime_type LIKE 'image/%'";
      } else if (category === 'video') {
        query += " AND (mime_type LIKE 'video/%' OR mime_type = 'application/x-matroska')";
      } else if (category === 'audio') {
        query += " AND mime_type LIKE 'audio/%'";
      } else if (category === 'document') {
        query += " AND (mime_type LIKE '%pdf%' OR mime_type LIKE '%text%' OR mime_type LIKE '%word%' OR mime_type LIKE '%document%' OR mime_type LIKE '%sheet%' OR mime_type LIKE '%presentation%')";
      } else if (category === 'archive') {
        query += " AND (mime_type LIKE '%zip%' OR mime_type LIKE '%tar%' OR mime_type LIKE '%rar%' OR mime_type LIKE '%7z%' OR mime_type LIKE '%compressed%')";
      } else if (category === 'other') {
        query += " AND mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%' AND mime_type NOT LIKE 'audio/%' AND mime_type NOT LIKE '%pdf%' AND mime_type NOT LIKE '%text%' AND mime_type NOT LIKE '%zip%'";
      }
    }

    switch (sort) {
      case 'date_asc':
        query += ' ORDER BY created_at ASC';
        break;
      case 'size_desc':
        query += ' ORDER BY size DESC';
        break;
      case 'size_asc':
        query += ' ORDER BY size ASC';
        break;
      case 'name_asc':
        query += ' ORDER BY original_name COLLATE NOCASE ASC';
        break;
      case 'name_desc':
        query += ' ORDER BY original_name COLLATE NOCASE DESC';
        break;
      case 'date_desc':
      default:
        query += ' ORDER BY created_at DESC';
        break;
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as unknown as DbFile[];
    return results || [];
  },

  updateFileName(id: string, newOriginalName: string): boolean {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE files 
      SET original_name = ?, updated_at = ?
      WHERE id = ?
    `);
    const info = stmt.run(newOriginalName, Date.now(), id);
    return (info as { changes?: number }).changes !== 0;
  },

  updateMegaShareLink(id: string, link: string): boolean {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE files 
      SET mega_share_link = ?, updated_at = ?
      WHERE id = ?
    `);
    const info = stmt.run(link, Date.now(), id);
    return (info as { changes?: number }).changes !== 0;
  },

  deleteFile(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM files WHERE id = ?');
    const info = stmt.run(id);
    return (info as { changes?: number }).changes !== 0;
  },

  incrementDownload(id: string): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?');
    stmt.run(id);
  },

  getStats() {
    const db = getDb();
    const totalStmt = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM files');
    const total = totalStmt.get() as unknown as { count: number; total_size: number };

    const typeStmt = db.prepare('SELECT mime_type, size FROM files');
    const allFiles = typeStmt.all() as unknown as { mime_type: string; size: number }[];

    const byType = {
      images: { count: 0, bytes: 0 },
      videos: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      documents: { count: 0, bytes: 0 },
      archives: { count: 0, bytes: 0 },
      others: { count: 0, bytes: 0 },
    };

    for (const f of allFiles) {
      const mime = (f.mime_type || '').toLowerCase();
      if (mime.startsWith('image/')) {
        byType.images.count++;
        byType.images.bytes += f.size;
      } else if (mime.startsWith('video/') || mime === 'application/x-matroska') {
        byType.videos.count++;
        byType.videos.bytes += f.size;
      } else if (mime.startsWith('audio/')) {
        byType.audio.count++;
        byType.audio.bytes += f.size;
      } else if (mime.includes('pdf') || mime.includes('text') || mime.includes('document') || mime.includes('sheet')) {
        byType.documents.count++;
        byType.documents.bytes += f.size;
      } else if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('compressed')) {
        byType.archives.count++;
        byType.archives.bytes += f.size;
      } else {
        byType.others.count++;
        byType.others.bytes += f.size;
      }
    }

    return {
      used_bytes: total.total_size || 0,
      file_count: total.count || 0,
      by_type: byType,
    };
  },

  getSetting(key: string): string | null {
    const db = getDb();
    const stmt = db.prepare('SELECT value FROM admin_settings WHERE key = ?');
    const row = stmt.get(key) as unknown as { value: string } | undefined;
    return row ? row.value : null;
  },

  setSetting(key: string, value: string): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO admin_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  },

  ensureFolderPath(folderPath: string): void {
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '').trim();
    if (!cleanPath) return;
    const db = getDb();
    const parts = cleanPath.split('/').map((p) => p.trim()).filter(Boolean);
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      try {
        db.prepare(`
          INSERT OR IGNORE INTO folders (id, name, path, parent_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          seg,
          currentPath,
          parentPath,
          Date.now(),
          Date.now()
        );
      } catch {}
    }
  },

  createFolder(name: string, parentPath: string = ''): DbFolder {
    const db = getDb();
    const trimmedName = name.trim().replace(/[\/\\]/g, '-');
    if (!trimmedName) {
      throw new Error('Folder name cannot be empty');
    }
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '').trim();
    const fullPath = cleanParent ? `${cleanParent}/${trimmedName}` : trimmedName;

    // Check if exists
    const checkStmt = db.prepare('SELECT * FROM folders WHERE path = ?');
    const existing = checkStmt.get(fullPath) as unknown as DbFolder | undefined;
    if (existing) {
      return existing;
    }

    if (cleanParent) {
      this.ensureFolderPath(cleanParent);
    }

    const id = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO folders (id, name, path, parent_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, trimmedName, fullPath, cleanParent, now, now);

    return {
      id,
      name: trimmedName,
      path: fullPath,
      parent_path: cleanParent,
      created_at: now,
      updated_at: now,
      file_count: 0,
      total_size: 0,
    };
  },

  getAllFolders(): (DbFolder & { file_count: number; total_size: number })[] {
    const db = getDb();
    const foldersStmt = db.prepare('SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC');
    const folders = foldersStmt.all() as unknown as DbFolder[];

    const statsStmt = db.prepare(`
      SELECT folder_path, COUNT(*) as count, COALESCE(SUM(size), 0) as total_size 
      FROM files 
      WHERE folder_path IS NOT NULL AND folder_path != '' 
      GROUP BY folder_path
    `);
    const fileStats = statsStmt.all() as unknown as { folder_path: string; count: number; total_size: number }[];
    const statsMap = new Map<string, { count: number; total_size: number }>();
    for (const stat of fileStats) {
      statsMap.set(stat.folder_path, { count: stat.count, total_size: stat.total_size });
    }

    return folders.map((f) => {
      // Calculate files directly inside or recursively inside
      let fileCount = 0;
      let totalSize = 0;
      for (const [fPath, stat] of statsMap.entries()) {
        if (fPath === f.path || fPath.startsWith(f.path + '/')) {
          fileCount += stat.count;
          totalSize += stat.total_size;
        }
      }
      return {
        ...f,
        file_count: fileCount,
        total_size: totalSize,
      };
    });
  },

  getFolderByPath(folderPath: string): DbFolder | null {
    const db = getDb();
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '').trim();
    const stmt = db.prepare('SELECT * FROM folders WHERE path = ?');
    const result = stmt.get(cleanPath) as unknown as DbFolder | undefined;
    return result || null;
  },

  getFolderById(id: string): DbFolder | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM folders WHERE id = ?');
    const result = stmt.get(id) as unknown as DbFolder | undefined;
    return result || null;
  },

  renameFolder(id: string, newName: string): DbFolder | null {
    const db = getDb();
    const current = this.getFolderById(id);
    if (!current) return null;

    const trimmedNewName = newName.trim().replace(/[\/\\]/g, '-');
    if (!trimmedNewName) throw new Error('Folder name cannot be empty');

    const oldPath = current.path;
    const newPath = current.parent_path ? `${current.parent_path}/${trimmedNewName}` : trimmedNewName;
    const now = Date.now();

    // 1. Update this folder
    const updateStmt = db.prepare('UPDATE folders SET name = ?, path = ?, updated_at = ? WHERE id = ?');
    updateStmt.run(trimmedNewName, newPath, now, id);

    // 2. Update subfolder paths
    const childFolders = db.prepare('SELECT * FROM folders WHERE path LIKE ?').all(`${oldPath}/%`) as unknown as DbFolder[];
    for (const child of childFolders) {
      const childNewPath = newPath + child.path.substring(oldPath.length);
      const childNewParent = newPath + child.parent_path.substring(oldPath.length);
      db.prepare('UPDATE folders SET path = ?, parent_path = ?, updated_at = ? WHERE id = ?').run(
        childNewPath,
        childNewParent,
        now,
        child.id
      );
    }

    // 3. Update files folder_path
    db.prepare('UPDATE files SET folder_path = ? WHERE folder_path = ?').run(newPath, oldPath);
    const nestedFiles = db.prepare('SELECT id, folder_path FROM files WHERE folder_path LIKE ?').all(`${oldPath}/%`) as unknown as { id: string; folder_path: string }[];
    for (const nf of nestedFiles) {
      const updatedPath = newPath + nf.folder_path.substring(oldPath.length);
      db.prepare('UPDATE files SET folder_path = ? WHERE id = ?').run(updatedPath, nf.id);
    }

    return {
      ...current,
      name: trimmedNewName,
      path: newPath,
      updated_at: now,
    };
  },

  deleteFolder(id: string, deleteFiles: boolean): { success: boolean; deletedFilePaths: string[] } {
    const db = getDb();
    const current = this.getFolderById(id);
    if (!current) return { success: false, deletedFilePaths: [] };

    const folderPath = current.path;
    const deletedFilePaths: string[] = [];

    // Find all files in this folder and subfolders
    const affectedFiles = db.prepare(`
      SELECT id, file_path, storage_backend 
      FROM files 
      WHERE folder_path = ? OR folder_path LIKE ?
    `).all(folderPath, `${folderPath}/%`) as unknown as { id: string; file_path: string; storage_backend?: string }[];

    if (deleteFiles) {
      for (const f of affectedFiles) {
        deletedFilePaths.push(f.file_path);
        db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
      }
    } else {
      // Move files to parent or root
      const targetPath = current.parent_path || null;
      db.prepare(`
        UPDATE files 
        SET folder_path = ? 
        WHERE folder_path = ?
      `).run(targetPath, folderPath);

      for (const f of affectedFiles) {
        if (f.file_path.startsWith(`${folderPath}/`)) {
          // Keep relative subfolder under parent
          const remainder = f.file_path.substring(folderPath.length + 1);
          const newFPath = current.parent_path ? `${current.parent_path}/${remainder}` : remainder;
          db.prepare('UPDATE files SET folder_path = ? WHERE id = ?').run(newFPath, f.id);
        }
      }
    }

    // Delete folder and all subfolders from folders table
    db.prepare('DELETE FROM folders WHERE path = ? OR path LIKE ?').run(folderPath, `${folderPath}/%`);

    return { success: true, deletedFilePaths };
  },
};
