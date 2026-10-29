import { StoredFile, FolderItem, StorageStats, FileCategory, SortOption } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';

const TOKEN_KEY = 'vps_storage_admin_token';
const CUSTOM_API_URL_KEY = 'vps_custom_api_url';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getBaseApiUrl(): string {
  const custom = localStorage.getItem(CUSTOM_API_URL_KEY);
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  return window.location.origin;
}

export function setCustomApiUrl(url: string): void {
  if (!url || !url.trim()) {
    localStorage.removeItem(CUSTOM_API_URL_KEY);
  } else {
    localStorage.setItem(CUSTOM_API_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
}

/**
 * Helper to determine if a file is a video by extension or mime type.
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

export function generateDropboxKeysClient(fileId: string): { rlkey: string; st: string } {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < fileId.length; i++) {
    const char = fileId.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 0x01000193);
    h2 = Math.imul(h2 ^ char, 0x5bd1e995);
  }
  const s1 = Math.abs(h1).toString(36);
  const s2 = Math.abs(h2).toString(36);
  const rlkey = (s1 + s2 + '0dzl8kpjk2eupway062i5b6d2').slice(0, 25);
  const st = (s2 + 'cl4u0103').slice(0, 8);
  return { rlkey, st };
}

export function buildDropboxMainUrlClient(
  effectiveDomain: string,
  fileId: string,
  fileName: string,
  mimeType?: string
): string {
  const { rlkey, st } = generateDropboxKeysClient(fileId);
  const isVid = isVideoFile(fileName, mimeType);
  const cleanBase = effectiveDomain.replace(/\/+$/, '');
  const encodedName = encodeURIComponent(fileName || 'file');
  const rawParam = isVid ? '&raw=1' : '&raw=1';
  return `${cleanBase}/scl/fi/${fileId}/${encodedName}?rlkey=${rlkey}&st=${st}${rawParam}`;
}

export function normalizeFile(file: StoredFile): StoredFile {
  if (!file) return file;
  const currentOrigin = window.location.origin;
  const customPublicBase = localStorage.getItem('vps_custom_public_base_url');

  // 1. Determine effective domain (strictly replacing localhost/127.0.0.1 with website domain)
  let effectiveDomain = currentOrigin;
  if (customPublicBase && customPublicBase.trim()) {
    effectiveDomain = customPublicBase.trim().replace(/\/+$/, '');
  } else if (file.public_url && file.public_url.startsWith('http')) {
    try {
      const parsed = new URL(file.public_url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        effectiveDomain = currentOrigin;
      } else {
        effectiveDomain = parsed.origin;
      }
    } catch {
      effectiveDomain = currentOrigin;
    }
  }

  // 2. Format Dropbox main link
  let publicUrl = file.public_url;
  if (publicUrl && publicUrl.includes('/scl/fi/')) {
    try {
      const parsed = new URL(publicUrl.startsWith('http') ? publicUrl : `${effectiveDomain}${publicUrl}`);
      publicUrl = `${effectiveDomain}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      publicUrl = buildDropboxMainUrlClient(effectiveDomain, file.id, file.original_name, file.mime_type);
    }
  } else {
    publicUrl = buildDropboxMainUrlClient(effectiveDomain, file.id, file.original_name, file.mime_type);
  }

  return {
    ...file,
    public_url: publicUrl,
  };
}

export function setCustomPublicBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    localStorage.removeItem('vps_custom_public_base_url');
  } else {
    localStorage.setItem('vps_custom_public_base_url', url.trim().replace(/\/+$/, ''));
  }
}

export function getCustomPublicBaseUrl(): string {
  return localStorage.getItem('vps_custom_public_base_url') || '';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseApiUrl();
  const token = getStoredToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired or unauthorized. Please log in again.');
  }

  if (!res.ok) {
    let errorMsg = `Server returned ${res.status}`;
    try {
      const errData = await res.json();
      if (errData && errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  isAuthenticated(): boolean {
    return !!getStoredToken();
  },

  logout(): void {
    clearStoredToken();
  },

  async login(password: string): Promise<{ token: string; user: { username: string } }> {
    const data = await request<{ token: string; user: { username: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async checkAuth(): Promise<boolean> {
    const token = getStoredToken();
    if (!token) return false;
    try {
      await request('/api/auth/me');
      return true;
    } catch {
      return false;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async getStorageStats(): Promise<StorageStats & { server_info: Record<string, unknown> }> {
    return request('/api/storage');
  },

  async getFiles(
    filterOrSearch?: string | { search?: string; category?: FileCategory; sort?: SortOption },
    categoryParam?: FileCategory,
    sortParam?: SortOption
  ): Promise<StoredFile[]> {
    let search = '';
    let category: FileCategory | undefined;
    let sort: SortOption | undefined;

    if (typeof filterOrSearch === 'object' && filterOrSearch !== null) {
      search = filterOrSearch.search || '';
      category = filterOrSearch.category;
      sort = filterOrSearch.sort;
    } else if (typeof filterOrSearch === 'string') {
      search = filterOrSearch;
      category = categoryParam;
      sort = sortParam;
    } else {
      category = categoryParam;
      sort = sortParam;
    }

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category && category !== 'all') params.set('category', category);
    if (sort) params.set('sort', sort);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ files: StoredFile[] }>(`/api/files${query}`);
    return res.files.map(normalizeFile);
  },

  async getFile(id: string): Promise<StoredFile> {
    const res = await request<{ file: StoredFile }>(`/api/files/${id}`);
    return normalizeFile(res.file);
  },

  async renameFile(id: string, name: string): Promise<StoredFile> {
    const res = await request<{ file: StoredFile }>(`/api/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    return normalizeFile(res.file);
  },

  async deleteFile(id: string): Promise<void> {
    await request(`/api/files/${id}`, {
      method: 'DELETE',
    });
  },

  async getFolders(): Promise<FolderItem[]> {
    const res = await request<{ folders: FolderItem[] }>('/api/folders');
    return res.folders || [];
  },

  async createFolder(name: string, parentPath?: string): Promise<{ success: boolean; folder: FolderItem }> {
    return request<{ success: boolean; folder: FolderItem }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_path: parentPath || '' }),
    });
  },

  async renameFolder(id: string, name: string): Promise<{ success: boolean; folder: FolderItem }> {
    return request<{ success: boolean; folder: FolderItem }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  async deleteFolder(id: string, deleteFiles: boolean = false): Promise<{ success: boolean; deletedCount: number }> {
    return request<{ success: boolean; deletedCount: number }>(`/api/folders/${id}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE',
    });
  },

  async getUrlConfig(): Promise<{ auto_detected_url: string; custom_url: string; effective_url: string }> {
    return request('/api/storage/url-config');
  },

  async updateUrlConfig(custom_url: string): Promise<{ success: boolean; auto_detected_url: string; custom_url: string; effective_url: string }> {
    return request('/api/storage/url-config', {
      method: 'POST',
      body: JSON.stringify({ custom_url }),
    });
  },

  async regenerateMegaLink(id: string): Promise<{ success: boolean; mega_share_link: string }> {
    return request<{ success: boolean; mega_share_link: string }>(`/api/files/${id}/regenerate-link`, {
      method: 'POST',
    });
  },

  // Upload file with progress tracking (automatically chunks large files > 15MB)
  uploadFile(
    file: File,
    onProgress: (progress: number, speed: string) => void,
    folderPath?: string
  ): Promise<StoredFile> {
    const MAX_LIMIT = 100 * 1024 * 1024 * 1024; // 100GB max limit
    if (file.size > MAX_LIMIT) {
      return Promise.reject(
        new Error(`File too large (${formatBytes(file.size)}). The maximum allowed upload limit is 100GB.`)
      );
    }

    const CHUNK_THRESHOLD = 15 * 1024 * 1024; // 15MB

    if (file.size > CHUNK_THRESHOLD) {
      return this.uploadChunked(file, onProgress, folderPath);
    } else {
      return this.uploadDirect(file, onProgress, folderPath);
    }
  },

  // Direct upload for smaller files using XMLHttpRequest for progress
  uploadDirect(
    file: File,
    onProgress: (progress: number, speed: string) => void,
    folderPath?: string
  ): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const baseUrl = getBaseApiUrl();
      const token = getStoredToken();
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file, file.name);
      if (folderPath) {
        formData.append('folderPath', folderPath);
      }

      let startTime = Date.now();
      let lastLoaded = 0;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          const now = Date.now();
          const timeDiff = (now - startTime) / 1000;
          let speedStr = '';
          if (timeDiff > 0.5) {
            const bytesPerSec = (e.loaded - lastLoaded) / timeDiff;
            speedStr = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            startTime = now;
            lastLoaded = e.loaded;
          }
          onProgress(percent, speedStr);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            onProgress(100, '');
            resolve(normalizeFile(data.file));
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('POST', `${baseUrl}/api/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },

  // Resumable Chunked upload for large files (MP4, MKV, ZIP, etc.)
  async uploadChunked(
    file: File,
    onProgress: (progress: number, speed: string) => void,
    folderPath?: string
  ): Promise<StoredFile> {
    // Adaptive chunk sizing: 20MB chunks for files > 1GB, 5MB chunks for smaller files
    const CHUNK_SIZE = file.size > 1024 * 1024 * 1024 ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const baseUrl = getBaseApiUrl();
    const token = getStoredToken();

    let uploadedBytes = 0;
    const startTime = Date.now();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('chunk', chunkBlob, file.name);

      const res = await fetch(`${baseUrl}/api/upload/chunk`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Failed to upload chunk ${chunkIndex + 1} of ${totalChunks}`);
      }

      uploadedBytes += (end - start);
      const percent = Math.round((uploadedBytes / file.size) * 98); // 98% until assembly completes
      const elapsed = (Date.now() - startTime) / 1000;
      const speedStr = elapsed > 0 ? `${(uploadedBytes / elapsed / (1024 * 1024)).toFixed(1)} MB/s` : '';
      onProgress(percent, speedStr);
    }

    onProgress(99, 'Assembling chunks...');

    // Complete and assemble
    const completeRes = await fetch(`${baseUrl}/api/upload/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        uploadId,
        originalName: file.name,
        totalChunks,
        mimeType: file.type || 'application/octet-stream',
        folderPath,
      }),
    });

    if (!completeRes.ok) {
      throw new Error('Failed to assemble file chunks on server');
    }

    const data = await completeRes.json();
    onProgress(100, '');
    return normalizeFile(data.file);
  },
};
