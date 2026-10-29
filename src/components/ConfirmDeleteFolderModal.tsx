import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, X, Folder } from 'lucide-react';
import { FolderItem } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound } from '../utils/sound.ts';

interface ConfirmDeleteFolderModalProps {
  folder: FolderItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folder: FolderItem, deleteFiles: boolean) => Promise<void>;
  deleting: boolean;
}

export const ConfirmDeleteFolderModal: React.FC<ConfirmDeleteFolderModalProps> = ({
  folder,
  isOpen,
  onClose,
  onConfirm,
  deleting,
}) => {
  const [deleteFiles, setDeleteFiles] = useState(false);

  if (!folder) return null;

  const fileCount = folder.file_count || 0;
  const totalSize = folder.total_size || 0;

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
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 bg-[#111116] rounded-3xl max-w-md w-full border border-red-500/30 shadow-2xl shadow-black/90 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shadow-lg shadow-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Delete Folder</h3>
                  <p className="text-xs text-zinc-400 font-medium">Confirm folder removal</p>
                </div>
              </div>
              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                disabled={deleting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                  <Folder className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{folder.name}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    /{folder.path} • {fileCount} file{fileCount !== 1 ? 's' : ''} ({formatBytes(totalSize)})
                  </p>
                </div>
              </div>

              {fileCount > 0 ? (
                <div className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-2xl space-y-2.5">
                  <p className="text-xs text-red-300 font-medium leading-relaxed">
                    This folder contains <span className="font-bold text-white">{fileCount}</span> file(s). What would you like to do with the files?
                  </p>
                  <label className="flex items-start space-x-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteFiles}
                      onChange={(e) => setDeleteFiles(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-red-500 rounded bg-zinc-900 border-zinc-700 focus:ring-red-500 focus:ring-offset-zinc-900 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-300">
                      Permanently delete all <strong className="text-red-400">{fileCount} files</strong> from VPS disk storage too.
                    </span>
                  </label>
                  {!deleteFiles && (
                    <p className="text-[11px] text-zinc-400">
                      (If unchecked, the files will remain safe and be moved to the parent directory or Root).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Are you sure you want to delete this folder? This action cannot be undone.
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(folder, deleteFiles)}
                  disabled={deleting}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{deleting ? 'Deleting...' : 'Delete Folder'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
