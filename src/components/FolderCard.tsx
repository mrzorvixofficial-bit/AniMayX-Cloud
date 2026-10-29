import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Folder,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { FolderItem } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface FolderCardProps {
  folder: FolderItem;
  onOpen: (folder: FolderItem) => void;
  onRename: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void;
  onCopyLinks?: (folder: FolderItem) => void;
  onDropFiles?: (folder: FolderItem, files: FileList | File[]) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onRename,
  onDelete,
  onCopyLinks,
  onDropFiles,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileCount = folder.file_count || 0;
  const totalSize = folder.total_size || 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopyLinks) {
      onCopyLinks(folder);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFiles) {
      onDropFiles(folder, e.dataTransfer.files);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={() => {
        playClickSound();
        onOpen(folder);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative bg-zinc-900/40 hover:bg-zinc-900/80 border rounded-2xl p-4 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
        isDragOver
          ? 'border-orange-500 bg-orange-500/15 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-[1.02]'
          : 'border-zinc-800/80 hover:border-orange-500/40 hover:shadow-xl hover:shadow-black/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Folder Icon */}
        <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400 group-hover:scale-105 group-hover:bg-orange-500/15 transition-all shadow-inner shrink-0">
          <Folder className="w-6 h-6 text-orange-400 fill-orange-400/20 group-hover:fill-orange-400/30 transition-colors" />
        </div>

        {/* Action Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer"
            title="Folder Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-40 w-44 bg-[#141418] border border-zinc-800 rounded-xl shadow-2xl shadow-black p-1 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpen(folder);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
                  <span>Open Folder</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onRename(folder);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Rename</span>
                </button>

                {onCopyLinks && fileCount > 0 && (
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                    <span>{isCopied ? 'Copied Links!' : 'Copy File URLs'}</span>
                  </button>
                )}

                <div className="border-t border-zinc-800 my-1" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(folder);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Folder</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Folder Name & Info */}
      <div className="mt-3.5">
        <h4 className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors truncate tracking-wide">
          {folder.name}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mt-1">
          <span>{fileCount === 0 ? 'Empty' : `${fileCount} file${fileCount > 1 ? 's' : ''}`}</span>
          {totalSize > 0 && <span>{formatBytes(totalSize)}</span>}
        </div>
      </div>

      {/* Drag & Drop hint overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-orange-500/20 backdrop-blur-xs rounded-2xl flex items-center justify-center border-2 border-orange-500 text-xs font-bold text-white shadow-inner">
          Drop files to upload here
        </div>
      )}
    </motion.div>
  );
};
