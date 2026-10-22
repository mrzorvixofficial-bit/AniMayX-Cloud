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
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Command,
} from 'lucide-react';
import { StoredFile, FileCategory, SortOption } from '../types.ts';
import { FileCard } from './FileCard.tsx';
import { FileRow } from './FileRow.tsx';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface FileListProps {
  files: StoredFile[];
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
  onOpenUpload: () => void;
  loading: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
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
  loading,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [copiedFolder, setCopiedFolder] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press '/' or 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Group files by folder_path
  const grouped = useMemo(() => {
    const foldersMap: Record<string, StoredFile[]> = {};
    const rootFiles: StoredFile[] = [];

    files.forEach((file) => {
      if (file.folder_path && file.folder_path.trim()) {
        const folderName = file.folder_path.trim();
        if (!foldersMap[folderName]) {
          foldersMap[folderName] = [];
        }
        foldersMap[folderName].push(file);
      } else {
        rootFiles.push(file);
      }
    });

    return { foldersMap, rootFiles };
  }, [files]);

  const toggleFolder = (folderName: string) => {
    playClickSound();
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const copyFolderLinks = (folderName: string, folderFiles: StoredFile[]) => {
    const links = folderFiles.map((f) => f.public_url).join('\n');
    navigator.clipboard.writeText(links);
    playSuccessSound();
    setCopiedFolder(folderName);
    setTimeout(() => setCopiedFolder(null), 2000);
  };

  const renderFilesList = (filesList: StoredFile[]) => {
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
      className="bg-[#0f0f13]/90 backdrop-blur-xl rounded-3xl border border-zinc-800/80 shadow-2xl shadow-black/70 overflow-hidden"
    >
      {/* Search and Filters Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-zinc-900/30">
        {/* Search input with shortcut badge */}
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

      {/* Main File Content Area */}
      <div className="p-4 sm:p-6">
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
        ) : files.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-20 text-center max-w-sm mx-auto"
          >
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-4 shadow-inner">
              <FileQuestion className="w-8 h-8 text-orange-400/80 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">No files found</h3>
            <p className="text-xs text-zinc-400 mt-1.5 mb-6 leading-relaxed">
              {search
                ? `No files match "${search}". Try clearing search or selecting a different category.`
                : 'Your AniMayX Cloud VPS storage is currently empty. Upload your first video, image, or document.'}
            </p>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playClickSound();
                onOpenUpload();
              }}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              <span>Upload New File</span>
            </motion.button>
          </motion.div>
        ) : Object.keys(grouped.foldersMap).length > 0 ? (
          <div className="space-y-6">
            {/* Render grouped folders */}
            {(Object.entries(grouped.foldersMap) as [string, StoredFile[]][]).map(([folderName, folderFiles]) => {
              const isCollapsed = !!collapsedFolders[folderName];
              const isCopied = copiedFolder === folderName;

              return (
                <div key={folderName} className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-950/20 shadow-lg">
                  {/* Folder header */}
                  <div
                    onClick={() => toggleFolder(folderName)}
                    className="p-4 bg-zinc-900/60 hover:bg-zinc-900/90 flex items-center justify-between cursor-pointer transition-all border-b border-zinc-800/60 select-none"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="text-zinc-500 shrink-0">
                        {isCollapsed ? <ChevronRight className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
                        <Folder className="w-5 h-5 text-orange-400 fill-orange-400/10" />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{folderName}</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{folderFiles.length} files inside</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {/* Copy All Links Button */}
                      <button
                        onClick={() => copyFolderLinks(folderName, folderFiles)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                            : 'bg-zinc-950 border-zinc-800 hover:border-orange-500 text-orange-400 hover:text-orange-300 shadow-sm shadow-black/45'
                        }`}
                        title="Copy direct raw URLs of all files inside this folder"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied Links!' : 'Copy All Links'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Folder contents */}
                  {!isCollapsed && (
                    <div className="p-4 bg-zinc-950/10">
                      {renderFilesList(folderFiles)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render remaining root files */}
            {grouped.rootFiles.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Root Directory Files</h4>
                  <span className="text-[11px] text-zinc-500 font-mono">({grouped.rootFiles.length} files)</span>
                </div>
                <div className="p-1">
                  {renderFilesList(grouped.rootFiles)}
                </div>
              </div>
            )}
          </div>
        ) : (
          renderFilesList(files)
        )}
      </div>
    </motion.div>
  );
};
