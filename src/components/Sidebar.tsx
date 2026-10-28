import React from 'react';
import {
  Layers,
  Image,
  Film,
  Music,
  FileText,
  Archive,
  UploadCloud,
  HardDrive,
  Radio,
  Terminal,
  Settings,
  LogOut,
  Flame,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { FileCategory, StorageStats } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import { playClickSound } from '../utils/sound.ts';

interface SidebarProps {
  activeView: 'overview' | 'files';
  setActiveView: (view: 'overview' | 'files') => void;
  activeCategory: FileCategory;
  onSelectCategory: (cat: FileCategory) => void;
  stats: StorageStats | null;
  onOpenUpload: () => void;
  onOpenTester: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  activeCategory,
  onSelectCategory,
  stats,
  onOpenUpload,
  onOpenTester,
  onOpenGuide,
  onOpenSettings,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const categories: {
    id: FileCategory;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'all', name: 'All Files', icon: Layers, count: stats?.file_count },
    { id: 'image', name: 'Images', icon: Image, count: stats?.by_type.images.count },
    { id: 'video', name: 'Videos', icon: Film, count: stats?.by_type.videos.count },
    { id: 'audio', name: 'Audio', icon: Music, count: stats?.by_type.audio.count },
    { id: 'document', name: 'Documents', icon: FileText, count: stats?.by_type.documents.count },
    { id: 'archive', name: 'Archives', icon: Archive, count: stats?.by_type.archives.count },
  ];

  const handleNavClick = (cat?: FileCategory) => {
    playClickSound();
    if (cat !== undefined) {
      setActiveView('files');
      onSelectCategory(cat);
    } else {
      setActiveView('overview');
    }
    if (isOpenMobile) onCloseMobile();
  };

  const usedPercentage = stats && stats.total_bytes > 0
    ? Math.min(100, (stats.used_bytes / stats.total_bytes) * 100)
    : 0;

  const content = (
    <div className="flex flex-col h-full bg-[#0d0d11] text-zinc-300 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 border border-orange-500/40 flex items-center justify-center text-orange-500 shadow-md shadow-orange-500/10">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-white text-base tracking-tight">
                AniMay<span className="text-orange-500">X</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                VPS
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">Engine v2.4 · Debian 13</p>
          </div>
        </div>

        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Nav Scroll */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Primary Views */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Navigation
          </div>
          <button
            onClick={() => handleNavClick()}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeView === 'overview'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="flex-1 text-left font-medium">Dashboard Overview</span>
          </button>
        </div>

        {/* Categories / Files */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Storage Files</span>
            <span className="text-[10px] font-mono text-zinc-400">{stats?.file_count ?? 0}</span>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeView === 'files' && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleNavClick(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                    isActive
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 font-medium'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
                    <span className="truncate">{cat.name}</span>
                  </div>
                  {typeof cat.count === 'number' && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-zinc-800/80 text-zinc-400'
                      }`}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* System & Tools */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            System & Tools
          </div>
          <div className="space-y-1">
            <button
              onClick={() => {
                playClickSound();
                onOpenUpload();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-all"
            >
              <UploadCloud className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="flex-1 text-left">Upload Files</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">POST</span>
            </button>

            <button
              onClick={() => {
                playClickSound();
                onOpenTester();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-all"
            >
              <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 text-left">Raw Stream Tester</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">/f/:id</span>
            </button>

            <button
              onClick={() => {
                playClickSound();
                onOpenGuide();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-all"
            >
              <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="flex-1 text-left">VPS Setup Guide</span>
            </button>

            <button
              onClick={() => {
                playClickSound();
                onOpenSettings();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-all"
            >
              <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="flex-1 text-left">Server Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Storage Footer Widget */}
      {stats && (
        <div className="p-4 m-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-zinc-200 font-medium text-[11px]">Storage Capacity</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">{usedPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(usedPercentage, stats.used_bytes > 0 ? 1 : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>{formatBytes(stats.used_bytes)} used</span>
            <span>{formatBytes(stats.total_bytes)}</span>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-zinc-800/80">
        <button
          onClick={() => {
            playClickSound();
            onLogout();
          }}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-all border border-transparent hover:border-red-900/40"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out of Admin</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-zinc-800/80 min-h-screen sticky top-0 h-screen">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
