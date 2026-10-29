import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  FileQuestion,
  UploadCloud,
  Folder,
  FolderPlus,
  FolderUp,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Home,
  Copy,
  Check,
  Sparkles,
  Command,
} from 'lucide-react';
import { StoredFile, FolderItem, FileCategory, SortOption } from '../types.ts';
import { FileCard } from './FileCard.tsx';
import { FileRow } from './FileRow.tsx';
import { FolderCard } from './FolderCard.tsx';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';
import { formatBytes } from '../utils/formatters.ts';

interface FileListProps {
  files: StoredFile[];
  folders: FolderItem[];
  currentFolder: string;
  onCurrentFolderChange: (path: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  category: FileCategory;
  onCategoryChange: (cat: FileCategory) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onSelectFile: (file: StoredFile) => void;
  onDeleteFile: (file: StoredFile) => void;
  onRenameFile: (file: StoredFile) => void;
  onOpenUpload: (targetFolder?: string) => void;
  onOpenCreateFolder: (currentFolder: string) => void;
  onRenameFolder: (folder: FolderItem) => void;
  onDeleteFolder: (folder: FolderItem) => void;
  onCopyFolderLinks?: (folder: FolderItem) => void;
  onDropFilesToFolder?: (folder: FolderItem, files: FileList | File[]) => void;
  onDropFilesToCurrent?: (files: FileList | File[]) => void;
  loading: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  folders,
  currentFolder,
  onCurrentFolderChange,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  onOpenUpload,
  onOpenCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCopyFolderLinks,
  onDropFilesToFolder,
  onDropFilesToCurrent,
  loading,
}) => {
  const [copiedFolder, setCopiedFolder] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press '/' or 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Split breadcrumbs
  const breadcrumbSegments = useMemo(() => {
    if (!currentFolder) return [];
    return currentFolder.split('/').filter(Boolean);
  }, [currentFolder]);

  // Navigate back one level
  const handleGoBack = () => {
    playClickSound();
    if (!currentFolder) return;
    const parts = currentFolder.split('/').filter(Boolean);
    parts.pop();
    onCurrentFolderChange(parts.join('/'));
  };

  // Navigate to specific breadcrumb segment
  const handleNavigateBreadcrumb = (index: number) => {
    playClickSound();
    if (index < 0) {
      onCurrentFolderChange('');
      return;
    }
    const target = breadcrumbSegments.slice(0, index + 1).join('/');
    onCurrentFolderChange(target);
  };

  // Subfolders in the current directory (when not in global search)
  const subfolders = useMemo(() => {
    if (search.trim()) {
      // If search query is entered, match folder names too
      const term = search.trim().toLowerCase();
      return folders.filter((f) => f.name.toLowerCase().includes(term));
    }
    const cleanCurrent = currentFolder.replace(/^\/+|\/+$/g, '').trim();
    return folders.filter((f) => {
      const parent = (f.parent_path || '').replace(/^\/+|\/+$/g, '').trim();
      return parent === cleanCurrent;
    });
  }, [folders, currentFolder, search]);

  // Files in the current directory (or filtered by search)
  const currentFiles = useMemo(() => {
    if (search.trim()) {
      // Search matches globally
      return files;
    }
    const cleanCurrent = currentFolder.replace(/^\/+|\/+$/g, '').trim();
    return files.filter((f) => {
      const fFolder = (f.folder_path || '').replace(/^\/+|\/+$/g, '').trim();
      return fFolder === cleanCurrent;
    });
  }, [files, currentFolder, search]);

  const copyFolderPublicLinks = (folder: FolderItem) => {
    const folderFiles = files.filter((f) => {
      const fPath = (f.folder_path || '').replace(/^\/+|\/+$/g, '').trim();
      return fPath === folder.path || fPath.startsWith(folder.path + '/');
    });

    if (folderFiles.length === 0) return;
    const links = folderFiles.map((f) => f.public_url).join('\n');
    navigator.clipboard.writeText(links);
    playSuccessSound();
    setCopiedFolder(folder.id);
    setTimeout(() => setCopiedFolder(null), 2000);
  };

  // Drag and drop onto FileList workspace
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(true);
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFilesToCurrent) {
      onDropFilesToCurrent(e.dataTransfer.files);
    }
  };

  const renderFilesGridOrList = (filesList: StoredFile[]) => {
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filesList.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onSelect={onSelectFile}
              onDelete={onDeleteFile}
              onRename={onRenameFile}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto -mx-4 sm:-mx-5 border border-zinc-800/80 rounded-2xl bg-zinc-950/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-900/60">
              <th className="py-3 px-4">File Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4 hidden md:table-cell">Type</th>
              <th className="py-3 px-4 hidden sm:table-cell">Date Uploaded</th>
              <th className="py-3 px-4 text-right">Direct Public URL & Actions</th>
            </tr>
          </thead>
          <tbody>
            {filesList.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                onSelect={onSelectFile}
                onDelete={onDeleteFile}
                onRename={onRenameFile}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
      className={`bg-[#0f0f13]/90 backdrop-blur-xl rounded-3xl border border-zinc-800/80 shadow-2xl shadow-black/70 overflow-hidden relative ${
        isDropActive ? 'ring-2 ring-orange-500 bg-zinc-900/40' : ''
      }`}
    >
      {/* 1. Breadcrumbs & Primary Action Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Path Bar */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-full text-xs">
          {currentFolder ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleGoBack}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-orange-500/50 text-zinc-300 hover:text-white transition-all cursor-pointer mr-1"
              title="Go back up one level"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-semibold">Back</span>
            </motion.button>
          ) : null}

          {/* Root button */}
          <button
            onClick={() => handleNavigateBreadcrumb(-1)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-semibold ${
              !currentFolder
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Root</span>
          </button>

          {/* Nested path segments */}
          {breadcrumbSegments.map((seg, idx) => {
            const isLast = idx === breadcrumbSegments.length - 1;
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <button
                  onClick={() => handleNavigateBreadcrumb(idx)}
                  className={`px-2.5 py-1.5 rounded-xl transition-all font-semibold font-mono truncate max-w-[140px] cursor-pointer ${
                    isLast
                      ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30 shadow-xs'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                  title={seg}
                >
                  {seg}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Folder Management & Upload Quick Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* New Folder Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              playClickSound();
              onOpenCreateFolder(currentFolder);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-orange-500/50 text-zinc-200 hover:text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Create a new folder inside current directory"
          >
            <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
            <span>New Folder</span>
          </motion.button>

          {/* Upload Folder Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              playClickSound();
              onOpenUpload(currentFolder);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            title="Upload files or full folders to current directory"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload</span>
          </motion.button>
        </div>
      </div>

      {/* 2. Search, Sort, and View Switcher Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-zinc-900/20">
        {/* Search input with keyboard shortcut */}
        <div className="relative w-full sm:w-88">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            id="file-search-input"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by filename or ID..."
            className="w-full pl-9 pr-14 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all font-medium"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 select-none">
            <span>/</span>
          </div>
        </div>

        {/* Right tools: Sort & View switcher */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
          {/* Sort dropdown */}
          <div className="flex items-center space-x-2 bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 hover:border-orange-500/30 transition-all shadow-inner">
            <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
            <select
              id="file-sort-select"
              value={sort}
              onChange={(e) => {
                playClickSound();
                onSortChange(e.target.value as SortOption);
              }}
              className="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="date_desc" className="bg-zinc-900 text-zinc-200">Newest Uploads</option>
              <option value="date_asc" className="bg-zinc-900 text-zinc-200">Oldest Uploads</option>
              <option value="size_desc" className="bg-zinc-900 text-zinc-200">Largest Size</option>
              <option value="size_asc" className="bg-zinc-900 text-zinc-200">Smallest Size</option>
              <option value="name_asc" className="bg-zinc-900 text-zinc-200">Name (A - Z)</option>
              <option value="name_desc" className="bg-zinc-900 text-zinc-200">Name (Z - A)</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-950 rounded-xl p-1 border border-zinc-800">
            <motion.button
              whileTap={{ scale: 0.95 }}
              id="view-mode-grid"
              onClick={() => {
                playClickSound();
                onViewModeChange('grid');
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              id="view-mode-list"
              onClick={() => {
                playClickSound();
                onViewModeChange('list');
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* 3. Main File & Folder Explorer View */}
      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="py-24 text-center">
            <div className="relative w-10 h-10 mx-auto mb-3">
              <div className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              </div>
            </div>
            <p className="text-xs font-mono text-zinc-400">Fetching VPS Storage Records...</p>
          </div>
        ) : subfolders.length === 0 && currentFiles.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-20 text-center max-w-sm mx-auto"
          >
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-4 shadow-inner">
              {currentFolder ? (
                <FolderOpen className="w-8 h-8 text-orange-400/80 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
              ) : (
                <FileQuestion className="w-8 h-8 text-orange-400/80 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
              )}
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {currentFolder ? `Folder "${breadcrumbSegments[breadcrumbSegments.length - 1] || currentFolder}" is empty` : 'No files or folders found'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1.5 mb-6 leading-relaxed">
              {search
                ? `No items match "${search}". Try clearing search or choosing a different directory.`
                : currentFolder
                ? `There are no files or subfolders inside /${currentFolder} yet. Upload files or create a subfolder here.`
                : 'Your VPS storage is empty. Upload your first file or create a folder.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  playClickSound();
                  onOpenCreateFolder(currentFolder);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-700 transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-orange-400" />
                <span>+ New Folder</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  playClickSound();
                  onOpenUpload(currentFolder);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-white" />
                <span>Upload Files Here</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* 3a. Subfolders Grid */}
            {subfolders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <Folder className="w-4 h-4 text-orange-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Folders ({subfolders.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Click to open • Drag files to drop inside
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {subfolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onOpen={(f) => {
                        onCurrentFolderChange(f.path);
                      }}
                      onRename={onRenameFolder}
                      onDelete={onDeleteFolder}
                      onCopyLinks={copyFolderPublicLinks}
                      onDropFiles={onDropFilesToFolder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3b. Files in Current Directory */}
            {currentFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {search ? `Matching Files (${currentFiles.length})` : `Files in /${currentFolder || 'Root'} (${currentFiles.length})`}
                    </h4>
                  </div>
                  {search && (
                    <span className="text-[11px] text-orange-400 font-mono">
                      Showing global search results
                    </span>
                  )}
                </div>

                {renderFilesGridOrList(currentFiles)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-view Drag & Drop Overlay */}
      {isDropActive && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm border-2 border-dashed border-orange-500 z-50 rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(249,115,22,0.4)]">
            <UploadCloud className="w-8 h-8 animate-bounce text-orange-400" />
          </div>
          <h3 className="text-base font-bold text-white">Drop files or folder here</h3>
          <p className="text-xs text-zinc-300 mt-1 font-mono">
            Uploading directly to: <span className="text-orange-400 font-bold">/{currentFolder || '(Root)'}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};
