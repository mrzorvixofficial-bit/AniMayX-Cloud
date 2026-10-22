import React, { useState, useEffect } from 'react';
import { Edit2, X, Flame } from 'lucide-react';
import { StoredFile } from '../types.ts';

interface RenameModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (file: StoredFile, newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  file,
  isOpen,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (file) {
      setName(file.original_name);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== file.original_name) {
      onRename(file, name.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] rounded-3xl max-w-md w-full border border-zinc-800 shadow-2xl shadow-black overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-inner">
              <Edit2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">Rename File</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              File Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-all"
              required
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
