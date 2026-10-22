import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileText,
  Film,
  Music,
  Archive,
  Copy,
  Check,
  Trash2,
  Edit2,
  ExternalLink,
  Play,
  Sparkles,
} from 'lucide-react';
import { StoredFile } from '../types.ts';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface FileCardProps {
  file: StoredFile;
  onSelect: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
  onRename: (file: StoredFile) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
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

  const renderThumbnail = () => {
    if (category === 'image') {
      return (
        <div className="relative w-full h-full group/img overflow-hidden">
          <img
            src={file.public_url}
            alt={file.original_name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-medium text-white border border-white/20">
              Preview Image
            </span>
          </div>
        </div>
      );
    }
    if (category === 'video') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950/20 flex flex-col items-center justify-center text-zinc-400 relative overflow-hidden group/vid">
          {/* Animated pulsing play circle */}
          <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-1.5 shadow-lg group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
            <Play className="w-5 h-5 text-orange-400 group-hover:text-white fill-current ml-0.5" />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-orange-400 font-semibold">
            Video Stream (?raw=1)
          </span>
        </div>
      );
    }
    if (category === 'audio') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-purple-950/10 to-zinc-900 flex flex-col items-center justify-center text-zinc-400 relative">
          {/* Animated waveform bars */}
          <div className="flex items-end space-x-1.5 h-7 mb-2">
            <div className="w-1 bg-purple-400 rounded-full animate-wave-1" />
            <div className="w-1 bg-purple-500 rounded-full animate-wave-2" />
            <div className="w-1 bg-indigo-400 rounded-full animate-wave-3" />
            <div className="w-1 bg-purple-300 rounded-full animate-wave-4" />
            <div className="w-1 bg-purple-400 rounded-full animate-wave-2" />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-purple-300 font-semibold">Audio Track</span>
        </div>
      );
    }
    if (category === 'archive') {
      return (
        <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-1.5 shadow-inner">
            <Archive className="w-5 h-5 text-rose-400" />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-rose-300 font-semibold">Archive Package</span>
        </div>
      );
    }
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-1.5 shadow-inner">
          <FileText className="w-5 h-5 text-amber-400" />
        </div>
        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-300 font-semibold">Document</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={() => {
        playClickSound();
        onSelect(file);
      }}
      className="group bg-[#121216]/90 backdrop-blur-md rounded-2xl border border-zinc-800/90 hover:border-orange-500/50 shadow-lg shadow-black/40 hover:shadow-2xl hover:shadow-orange-500/15 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col relative"
    >
      {/* Thumbnail Aspect Box */}
      <div className="relative w-full aspect-video bg-zinc-950 overflow-hidden border-b border-zinc-800/80">
        {renderThumbnail()}

        {/* Floating ID badge */}
        <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md text-orange-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-orange-500/30 flex items-center space-x-1 shadow-md">
          <span>/f/{file.id}</span>
          {isVideo && <span className="text-orange-400 font-bold">?raw=1</span>}
        </div>

        {/* Top-Right Direct Copy Action */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={copyUrl}
          title="Copy Direct Public URL"
          className="absolute top-2.5 right-2.5 bg-zinc-900/90 hover:bg-orange-500 text-zinc-200 hover:text-white p-1.5 rounded-xl border border-zinc-700/80 hover:border-orange-400 shadow-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-white" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </motion.button>
      </div>

      {/* Content Area */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <h3
            className="text-xs font-semibold text-white truncate group-hover:text-orange-400 transition-colors"
            title={file.original_name}
          >
            {file.original_name}
          </h3>
          <div className="flex items-center space-x-2 text-[11px] text-zinc-400 mt-1 font-mono">
            <span className="text-zinc-300 font-semibold">{formatBytes(file.size)}</span>
            <span className="text-zinc-600">•</span>
            <span className="truncate max-w-[120px] text-zinc-400">{file.mime_type}</span>
          </div>
        </div>

        {/* Footer actions row */}
        <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-zinc-500">{formatDate(file.created_at)}</span>

          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
            {/* Direct 1-click copy */}
            <button
              onClick={copyUrl}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                copied
                  ? 'text-white bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                  : 'text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/80'
              }`}
              title="Copy Raw URL"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Direct Open in new tab */}
            <a
              href={file.public_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/80 transition-colors"
              title="Open raw file in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Rename */}
            <button
              onClick={() => onRename(file)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Rename file"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(file)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Delete file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
