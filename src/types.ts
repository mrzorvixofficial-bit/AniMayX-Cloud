export interface StoredFile {
  id: string;
  original_name: string;
  sanitized_name: string;
  mime_type: string;
  size: number;
  created_at: number;
  updated_at: number;
  download_count: number;
  public_url: string;
  folder_path?: string | null;
  storage_backend?: 'local' | 'mega';
  mega_file_id?: string | null;
  mega_share_link?: string | null;
  upload_status?: string | null;
}

export interface StorageStats {
  used_bytes: number;
  disk_used_bytes?: number;
  total_bytes: number;
  free_bytes: number;
  file_count: number;
  storage_path?: string;
  by_type: {
    images: { count: number; bytes: number };
    videos: { count: number; bytes: number };
    audio: { count: number; bytes: number };
    documents: { count: number; bytes: number };
    archives: { count: number; bytes: number };
    others: { count: number; bytes: number };
  };
  server_info?: {
    storage_path?: string;
    database_path?: string;
    max_upload_size?: number;
    public_base_url?: string;
    custom_public_base_url?: string;
    auto_detected_url?: string;
    frontend_url?: string;
  };
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  username?: string;
}

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  speed?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  publicUrl?: string;
  uploadedFileId?: string;
  folderPath?: string;
}

export type FileCategory = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
export type SortOption = 'date_desc' | 'date_asc' | 'size_desc' | 'size_asc' | 'name_asc' | 'name_desc';
