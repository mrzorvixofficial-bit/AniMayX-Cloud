export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileCategory(mimeType: string, filename: string): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  const mime = (mimeType || '').toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || mime === 'application/x-matroska' || ['mp4', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('text') ||
    mime.includes('document') ||
    ['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'json'].includes(ext)
  ) {
    return 'document';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
  ) {
    return 'archive';
  }
  return 'other';
}
