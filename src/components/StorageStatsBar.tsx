import React from 'react';
import { motion } from 'motion/react';
import {
  Image,
  Film,
  Music,
  FileText,
  Archive,
  Layers,
  Database,
  HardDrive,
  Activity,
  Sparkles,
} from 'lucide-react';
import { StorageStats, FileCategory } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound } from '../utils/sound.ts';

interface StorageStatsBarProps {
  stats: StorageStats | null;
  activeCategory: FileCategory;
  onSelectCategory: (category: FileCategory) => void;
}

export const StorageStatsBar: React.FC<StorageStatsBarProps> = ({
  stats,
  activeCategory,
  onSelectCategory,
}) => {
  if (!stats) return null;

  const usedPercentage = Math.min(
    100,
    stats.total_bytes > 0 ? (stats.used_bytes / stats.total_bytes) * 100 : 0
  );

  const storagePathDisplay =
    stats.storage_path ||
    stats.server_info?.storage_path ||
    '/opt/AniMayX-Cloud/storage/uploads';

  const categories = [
    {
      id: 'all' as FileCategory,
      name: 'All Files',
      icon: Layers,
      count: stats.file_count,
      bytes: stats.used_bytes,
    },
    {
      id: 'image' as FileCategory,
      name: 'Images',
      icon: Image,
      count: stats.by_type.images.count,
      bytes: stats.by_type.images.bytes,
    },
    {
      id: 'video' as FileCategory,
      name: 'Videos',
      icon: Film,
      count: stats.by_type.videos.count,
      bytes: stats.by_type.videos.bytes,
    },
    {
      id: 'audio' as FileCategory,
      name: 'Audio',
      icon: Music,
      count: stats.by_type.audio.count,
      bytes: stats.by_type.audio.bytes,
    },
    {
      id: 'document' as FileCategory,
      name: 'Documents',
      icon: FileText,
      count: stats.by_type.documents.count,
      bytes: stats.by_type.documents.bytes,
    },
    {
      id: 'archive' as FileCategory,
      name: 'Archives',
      icon: Archive,
      count: stats.by_type.archives.count,
      bytes: stats.by_type.archives.bytes,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-[#0f0f13]/90 backdrop-blur-xl rounded-3xl border border-zinc-800/80 p-5 sm:p-6 shadow-2xl shadow-black/60 mb-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-500"
    >
      {/* Ambient background glow behind stats */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:bg-orange-500/10 transition-colors duration-700" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10" />

      {/* Top summary row */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center space-x-3.5">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 10 }}
            className="w-11 h-11 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-orange-500 shadow-inner group-hover:border-orange-500/40 group-hover:text-orange-400 transition-colors"
          >
            <Database className="w-5 h-5 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
          </motion.div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center">
                VPS Storage Capacity
                <Sparkles className="w-3.5 h-3.5 ml-1.5 text-orange-400" />
              </h2>
              <span className="text-[10px] font-mono bg-orange-500/10 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                EXT4 MOUNT
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Host path: <code className="text-orange-300/90 bg-zinc-900/90 px-1.5 py-0.5 rounded-md font-mono text-[11px] border border-zinc-800">{storagePathDisplay}</code>
            </p>
          </div>
        </div>

        {/* Big numbers */}
        <div className="flex items-center gap-6 text-sm">
          <motion.div whileHover={{ y: -2 }} className="cursor-default">
            <span className="text-[11px] text-zinc-400 block font-medium">Used Space</span>
            <span className="font-bold text-white font-mono text-base">{formatBytes(stats.used_bytes)}</span>
          </motion.div>
          <div className="w-px h-8 bg-zinc-800/80"></div>
          <motion.div whileHover={{ y: -2 }} className="cursor-default">
            <span className="text-[11px] text-zinc-400 block font-medium">Free Space</span>
            <span className="font-bold text-zinc-300 font-mono text-base">{formatBytes(stats.free_bytes)}</span>
          </motion.div>
          <div className="w-px h-8 bg-zinc-800/80"></div>
          <motion.div whileHover={{ y: -2 }} className="cursor-default">
            <span className="text-[11px] text-zinc-400 block font-medium">Total Files</span>
            <span className="font-bold text-orange-400 font-mono text-base">{stats.file_count}</span>
          </motion.div>
        </div>
      </div>

      {/* Visual progress bar with orange animated shimmer & glow */}
      <div className="mt-4 relative z-10">
        <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span className="text-zinc-200 font-semibold">{usedPercentage.toFixed(2)}% used ({formatBytes(stats.used_bytes)})</span>
          </span>
          <span className="font-mono text-zinc-400">{formatBytes(stats.total_bytes)} Total Disk ({formatBytes(stats.free_bytes)} free)</span>
        </div>
        <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80 p-0.5 flex relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(usedPercentage, stats.used_bytes > 0 ? 0.75 : 0)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 rounded-full relative overflow-hidden shadow-[0_0_14px_rgba(249,115,22,0.5)]"
          >
            {/* Shimmer sweep effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </div>

      {/* Interactive Category filter chips */}
      <div className="mt-5 flex flex-wrap gap-2 relative z-10">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playClickSound();
                onSelectCategory(cat.id);
              }}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 border border-orange-400/50'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/90 hover:border-orange-500/30'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {cat.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};
