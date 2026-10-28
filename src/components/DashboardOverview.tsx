import React, { useState } from 'react';
import {
  Server,
  HardDrive,
  Files,
  Image,
  Film,
  Music,
  FileText,
  Archive,
  Copy,
  Check,
  Activity,
  ArrowRight,
  UploadCloud,
} from 'lucide-react';
import { StorageStats, FileCategory } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface DashboardOverviewProps {
  stats: StorageStats | null;
  onSelectCategory: (cat: FileCategory) => void;
  onOpenUpload: () => void;
  onViewFiles: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  onSelectCategory,
  onOpenUpload,
  onViewFiles,
}) => {
  const [copiedPath, setCopiedPath] = useState(false);

  if (!stats) return null;

  const storagePathDisplay =
    stats.storage_path ||
    stats.server_info?.storage_path ||
    '/opt/AniMayX-Cloud/storage/uploads';

  const usedPercentage =
    stats.total_bytes > 0
      ? Math.min(100, (stats.used_bytes / stats.total_bytes) * 100)
      : 0;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(storagePathDisplay);
    playSuccessSound();
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const categories = [
    {
      id: 'image' as FileCategory,
      name: 'Images',
      icon: Image,
      count: stats.by_type.images.count,
      bytes: stats.by_type.images.bytes,
      color: 'text-emerald-400',
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      bg: 'bg-emerald-500/10',
    },
    {
      id: 'video' as FileCategory,
      name: 'Videos',
      icon: Film,
      count: stats.by_type.videos.count,
      bytes: stats.by_type.videos.bytes,
      color: 'text-orange-400',
      border: 'border-orange-500/20 hover:border-orange-500/50',
      bg: 'bg-orange-500/10',
    },
    {
      id: 'audio' as FileCategory,
      name: 'Audio',
      icon: Music,
      count: stats.by_type.audio.count,
      bytes: stats.by_type.audio.bytes,
      color: 'text-cyan-400',
      border: 'border-cyan-500/20 hover:border-cyan-500/50',
      bg: 'bg-cyan-500/10',
    },
    {
      id: 'document' as FileCategory,
      name: 'Documents',
      icon: FileText,
      count: stats.by_type.documents.count,
      bytes: stats.by_type.documents.bytes,
      color: 'text-amber-400',
      border: 'border-amber-500/20 hover:border-amber-500/50',
      bg: 'bg-amber-500/10',
    },
    {
      id: 'archive' as FileCategory,
      name: 'Archives',
      icon: Archive,
      count: stats.by_type.archives.count,
      bytes: stats.by_type.archives.bytes,
      color: 'text-rose-400',
      border: 'border-rose-500/20 hover:border-rose-500/50',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Engine Status Card */}
        <div className="bg-[#0e0e12] rounded-2xl border border-zinc-800/80 p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono">
              Engine Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-white font-mono">ONLINE</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-emerald-400 border border-zinc-700/60">
                14ms ping
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">Debian 13 · EXT4</p>
          </div>
        </div>

        {/* 2. Disk Usage Card */}
        <div className="bg-[#0e0e12] rounded-2xl border border-zinc-800/80 p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono">
              Disk Usage
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-white font-mono">
              {formatBytes(stats.used_bytes)}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mt-1 font-mono">
              <span>{usedPercentage.toFixed(2)}% of {formatBytes(stats.total_bytes)}</span>
              <span>{formatBytes(stats.free_bytes)} free</span>
            </div>
          </div>
        </div>

        {/* 3. Total Files Card */}
        <div className="bg-[#0e0e12] rounded-2xl border border-zinc-800/80 p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono">
              Total Files
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Files className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold text-white font-mono">
                {stats.file_count}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Managed assets</p>
            </div>
            <button
              onClick={() => {
                playClickSound();
                onViewFiles();
              }}
              className="text-xs text-orange-400 hover:text-orange-300 font-medium inline-flex items-center space-x-1 transition-colors"
            >
              <span>Browse</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. Host Storage Mount Card */}
        <div className="bg-[#0e0e12] rounded-2xl border border-zinc-800/80 p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono">
              Host Mount
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <code className="text-xs text-orange-300/90 font-mono truncate max-w-[170px]" title={storagePathDisplay}>
                {storagePathDisplay}
              </code>
              <button
                onClick={handleCopyPath}
                title="Copy host path"
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
              >
                {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Direct read/write access</p>
          </div>
        </div>
      </div>

      {/* Storage Disk Bar Detailed Container */}
      <div className="bg-[#0e0e12] rounded-2xl border border-zinc-800/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Filesystem Capacity & Allocation</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Physical disk usage reported directly by Node.js statfs</p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-zinc-300">
              <span className="text-orange-400 font-bold">{formatBytes(stats.used_bytes)}</span> used
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">
              <span className="text-zinc-200 font-bold">{formatBytes(stats.free_bytes)}</span> available
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">
              <span className="text-white font-bold">{formatBytes(stats.total_bytes)}</span> total
            </span>
          </div>
        </div>

        {/* Bar */}
        <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5 flex">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full transition-all duration-700 shadow-sm"
            style={{ width: `${Math.max(usedPercentage, stats.used_bytes > 0 ? 0.8 : 0)}%` }}
          />
        </div>
      </div>

      {/* Categories Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">File Categories</h3>
          <span className="text-xs text-zinc-400">Click a category to view items</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  playClickSound();
                  onSelectCategory(cat.id);
                }}
                className={`p-4 rounded-xl bg-[#0e0e12] border ${cat.border} text-left transition-all hover:bg-zinc-900/60 group cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-zinc-200 group-hover:text-white">
                    {cat.count}
                  </span>
                </div>
                <div className="font-medium text-xs text-zinc-200 group-hover:text-white truncate">
                  {cat.name}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  {formatBytes(cat.bytes)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="p-4.5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white">Direct Raw File Delivery & Streaming</h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            AniMayX Cloud provides direct seekable HTTP Range byte streaming on <code className="text-orange-400">/f/:id</code>.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              playClickSound();
              onOpenUpload();
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
