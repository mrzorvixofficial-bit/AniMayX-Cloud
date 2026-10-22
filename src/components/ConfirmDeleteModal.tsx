import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { StoredFile } from '../types.ts';

interface ConfirmDeleteModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: StoredFile) => void;
  deleting: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  file,
  isOpen,
  onClose,
  onConfirm,
  deleting,
}) => {
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] rounded-3xl max-w-md w-full border border-zinc-800 shadow-2xl shadow-black overflow-hidden p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-red-950/40 border border-red-900/50 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Delete File Permanently?</h3>
            <p className="text-xs text-zinc-400">This action cannot be undone.</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 mb-5 text-xs text-zinc-300">
          <p className="font-semibold text-white truncate mb-1">{file.original_name}</p>
          <p className="text-zinc-500 font-mono text-[11px]">
            Physical file on VPS: <code className="text-orange-400">/storage/uploads/{file.file_path}</code>
          </p>
          <p className="text-zinc-500 mt-2 text-[11px]">
            The public link <code className="text-orange-400 font-mono">/f/{file.id}?raw=1</code> will immediately return 404 Not Found.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(file)}
            disabled={deleting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-red-600/20 transition-all cursor-pointer"
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Delete File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
