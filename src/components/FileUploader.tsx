import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Folder,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { UploadItem, StoredFile } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound, playSuccessSound, playUploadSound } from '../utils/sound.ts';

interface FileUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (file: StoredFile) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const startUpload = async (item: UploadItem, folderPath?: string) => {
    playUploadSound();
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 1 } : i))
    );

    try {
      const storedFile = await api.uploadFile(item.file, (progress, speed) => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, progress, speed }
              : i
          )
        );
      }, folderPath);

      playSuccessSound();
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'completed',
                progress: 100,
                publicUrl: storedFile.public_url,
                uploadedFileId: storedFile.id,
              }
            : i
        )
      );

      onUploadSuccess(storedFile);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error', errorMessage: errorMsg }
            : i
        )
      );
    }
  };

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
    }));

    setItems((prev) => [...newItems, ...prev]);

    // Start uploads
    newItems.forEach((item) => {
      startUpload(item);
    });
  }, []);

  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files) as File[];
    
    const newItems: UploadItem[] = fileList.map((file) => {
      let folderPath = '';
      const relativePath = (file as any).webkitRelativePath;
      if (relativePath) {
        const parts = relativePath.split('/');
        if (parts.length > 1) {
          folderPath = parts.slice(0, -1).join('/');
        }
      }
      return {
        id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending' as const,
        folderPath,
      };
    });

    setItems((prev) => [...newItems, ...prev]);

    newItems.forEach((item) => {
      startUpload(item, item.folderPath);
    });
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    playSuccessSound();
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 bg-[#111116] rounded-3xl max-w-2xl w-full border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/10">
                  <UploadCloud className="w-5 h-5 text-orange-400 animate-float" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Upload to AniMayX Cloud</h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    Resumable chunked upload for single files and folders (up to 100GB)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drop zone area */}
            <div className="p-6 overflow-y-auto flex-1">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
                  isDragging
                    ? 'border-orange-500 bg-orange-500/10 scale-[0.99] shadow-[0_0_30px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 hover:border-orange-500/50 bg-zinc-950/40 hover:bg-zinc-900/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderChange}
                  multiple
                  className="hidden"
                  {...{
                    webkitdirectory: "",
                    directory: ""
                  } as any}
                />
                <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 shadow-inner flex items-center justify-center text-orange-400 mb-3.5 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-8 h-8 text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Drag & drop files or folders directly here
                </p>
                <p className="text-xs text-zinc-400 mt-1.5 font-medium">
                  Instant public URLs are generated automatically. Supports files up to <span className="text-orange-400 font-semibold">100GB</span> each.
                </p>
                
                {/* Folder vs Files Upload Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5" onClick={(e) => e.stopPropagation()}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      fileInputRef.current?.click();
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 hover:border-orange-500 text-zinc-200 hover:text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    <UploadCloud className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>Select Files</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      folderInputRef.current?.click();
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35 transition-all cursor-pointer border border-orange-400/30"
                  >
                    <Folder className="w-4 h-4 text-white shrink-0" />
                    <span>Select Folder</span>
                  </motion.button>
                </div>
              </div>

              {/* Upload Items List */}
              {items.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Upload Queue ({items.length})
                  </h4>
                  <div className="divide-y divide-zinc-800/80 max-h-64 overflow-y-auto border border-zinc-800 rounded-2xl bg-zinc-950/40">
                    {items.map((item) => (
                      <div key={item.id} className="p-3.5 hover:bg-zinc-900/40 transition-colors">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center space-x-2 truncate max-w-xs sm:max-w-sm">
                            {item.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-orange-400 shrink-0 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]" />
                            ) : item.status === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin shrink-0" />
                            )}
                            <span className="font-medium text-white truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-zinc-400 shrink-0">
                            <span className="font-mono">{formatBytes(item.size)}</span>
                            {item.speed && (
                              <span className="text-orange-400 font-mono text-[11px] font-semibold">{item.speed}</span>
                            )}
                            <span className="font-medium text-zinc-300 font-mono">{item.progress}%</span>
                          </div>
                        </div>

                        {/* Progress bar with orange glow */}
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              item.status === 'completed'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]'
                                : item.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>

                        {/* Success state: Public URL & Copy button */}
                        {item.status === 'completed' && item.publicUrl && (
                          <div className="mt-2.5 flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2">
                            <div className="flex items-center space-x-2 truncate text-[11px] font-mono text-zinc-300">
                              <span className="text-orange-400 font-bold">
                                {item.publicUrl.includes('?raw=1') ? 'Video Stream URL:' : 'Direct File URL:'}
                              </span>
                              <span className="truncate text-zinc-200">{item.publicUrl}</span>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0 ml-2">
                              <button
                                onClick={() => copyToClipboard(item.publicUrl!, item.id)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-800 hover:bg-orange-500 hover:text-white border border-zinc-700 text-zinc-200 transition-all cursor-pointer shadow-sm"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                    <span className="text-white">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-orange-400" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                              <a
                                href={item.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-zinc-400 hover:text-orange-400 transition-colors"
                                title="Open direct raw file"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Error message */}
                        {item.status === 'error' && (
                          <p className="mt-1.5 text-[11px] text-red-400 font-medium">
                            {item.errorMessage || 'Upload failed. Please retry.'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px]">Direct disk target: <code className="text-orange-400">/storage/uploads</code></span>
              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
