import React, { useState } from 'react';
import {
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Archive,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit2,
} from 'lucide-react';
import { StoredFile } from '../types.ts';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface FileRowProps {
  file: StoredFile;
  onSelect: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
  onRename: (file: StoredFile) => void;
}

export const FileRow: React.FC<FileRowProps> = ({
  file,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [copied, setCopied] = useState(false);
  const category = getFileCategory(file.mime_type, file.original_name);
  const isVideo = category === 'video';

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file.public_url);
    playSuccessSound();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderIcon = () => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'video':
        return <Film className="w-4 h-4 text-orange-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-400" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-rose-400" />;
      default:
        return <FileText className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <tr
      onClick={() => {
        playClickSound();
        onSelect(file);
      }}
      className="hover:bg-zinc-900/80 transition-colors cursor-pointer border-b border-zinc-800/80 last:border-0 group"
    >
      {/* Name and Icon */}
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-orange-500/40 group-hover:scale-105 transition-all shadow-inner">
            {renderIcon()}
          </div>
          <div className="truncate max-w-xs sm:max-w-md">
            <span className="text-xs font-semibold text-white group-hover:text-orange-400 transition-colors truncate block">
              {file.original_name}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              /f/<span className="text-orange-400/90">{file.id}</span>
              {isVideo && <span className="text-orange-400 font-bold ml-0.5">?raw=1</span>}
            </span>
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="py-3 px-4 text-xs text-zinc-300 font-mono whitespace-nowrap">
        {formatBytes(file.size)}
      </td>

      {/* Type */}
      <td className="py-3 px-4 text-xs text-zinc-400 font-mono whitespace-nowrap hidden md:table-cell">
        <span className="bg-zinc-900/90 text-zinc-300 border border-zinc-800 px-2.5 py-0.5 rounded-full text-[11px]">
          {file.mime_type}
        </span>
      </td>

      {/* Upload Date */}
      <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap hidden sm:table-cell">
        {formatDate(file.created_at)}
      </td>

      {/* Public URL & Actions */}
      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end space-x-1.5">
          {/* Copy URL Button */}
          <button
            onClick={copyUrl}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              copied
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/40 scale-105'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-orange-500/30'
            }`}
            title="Copy Direct Public URL"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden lg:inline">Copy URL</span>
              </>
            )}
          </button>

          {/* Open direct raw link */}
          <a
            href={file.public_url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="Open raw file"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Rename */}
          <button
            onClick={() => onRename(file)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Rename file"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(file)}
            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
            title="Delete file"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
