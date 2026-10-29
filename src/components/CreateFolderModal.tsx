import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderPlus, X, Folder } from 'lucide-react';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onCreate: (folderName: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  onCreate,
}) => {
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = folderName.trim().replace(/[\/\\]/g, '-');
    if (!cleanName) {
      setError('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreate(cleanName);
      playSuccessSound();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 bg-[#111116] rounded-3xl max-w-md w-full border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/10">
                  <FolderPlus className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Create New Folder</h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    {currentPath ? (
                      <span>Inside: <code className="text-orange-400 font-mono">/{currentPath}</code></span>
                    ) : (
                      <span>Inside: <code className="text-orange-400 font-mono">/ (Root)</code></span>
                    )}
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="folder-name-input" className="block text-xs font-semibold text-zinc-300 mb-2">
                  Folder Name
                </label>
                <div className="relative">
                  <Folder className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    id="folder-name-input"
                    type="text"
                    value={folderName}
                    onChange={(e) => {
                      setFolderName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Anime, Movies, Season 01, Wallpapers"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all font-medium"
                    disabled={isSubmitting}
                  />
                </div>
                {error && (
                  <p className="mt-2 text-xs text-red-400 font-medium">{error}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !folderName.trim()}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Creating...' : 'Create Folder'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
