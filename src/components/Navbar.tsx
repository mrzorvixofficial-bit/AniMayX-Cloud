import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  RefreshCw,
  Volume2,
  VolumeX,
  Menu,
  Activity,
  Search,
} from 'lucide-react';
import { StorageStats, FileCategory } from '../types.ts';
import {
  isSoundEnabled,
  toggleSound,
  playClickSound,
  initSoundPreference,
} from '../utils/sound.ts';

interface NavbarProps {
  storageStats: StorageStats | null;
  activeCategory: FileCategory;
  activeView: 'overview' | 'files';
  search: string;
  onSearchChange: (val: string) => void;
  onOpenUpload: () => void;
  onRefresh: () => void;
  onOpenMobileSidebar: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeCategory,
  activeView,
  search,
  onSearchChange,
  onOpenUpload,
  onRefresh,
  onOpenMobileSidebar,
  loading,
}) => {
  const [soundOn, setSoundOn] = useState(true);
  const [latency, setLatency] = useState<number>(14);

  useEffect(() => {
    initSoundPreference();
    setSoundOn(isSoundEnabled());

    const interval = setInterval(() => {
      setLatency(Math.floor(12 + Math.random() * 8));
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleSoundToggle = () => {
    const updated = toggleSound();
    setSoundOn(updated);
  };

  const getBreadcrumbTitle = () => {
    if (activeView === 'overview') return 'Overview';
    switch (activeCategory) {
      case 'image':
        return 'Images';
      case 'video':
        return 'Videos';
      case 'audio':
        return 'Audio Files';
      case 'document':
        return 'Documents';
      case 'archive':
        return 'Archives';
      default:
        return 'All Files';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Breadcrumbs */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={() => {
              playClickSound();
              onOpenMobileSidebar();
            }}
            className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/60 lg:hidden"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="flex items-center space-x-2 text-xs truncate">
            <span className="text-zinc-400 font-medium hidden sm:inline">AniMayX Cloud</span>
            <span className="text-zinc-600 hidden sm:inline">/</span>
            <span className="text-zinc-400 capitalize hidden sm:inline">{activeView}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-semibold capitalize truncate">{getBreadcrumbTitle()}</span>
          </nav>
        </div>

        {/* Center: Search Control */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files by name, extension, or ID... (Press /)"
              className="w-full bg-zinc-900/90 text-zinc-200 text-xs rounded-xl pl-9 pr-12 py-2 border border-zinc-800 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-zinc-400"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800 rounded border border-zinc-700/60">
                /
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Live Engine Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-mono text-[11px] font-medium flex items-center">
              <Activity className="w-3 h-3 mr-1" />
              ONLINE ({latency}ms)
            </span>
          </div>

          {/* Refresh Data */}
          <button
            onClick={() => {
              playClickSound();
              onRefresh();
            }}
            disabled={loading}
            title="Refresh Files & Storage Data"
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 border border-zinc-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          {/* Sound FX Toggle */}
          <button
            onClick={handleSoundToggle}
            title={soundOn ? 'Mute Sound FX' : 'Enable Sound FX'}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundOn
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Upload Button */}
          <button
            onClick={() => {
              playClickSound();
              onOpenUpload();
            }}
            className="inline-flex items-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md shadow-orange-950 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Files</span>
          </button>
        </div>
      </div>
    </header>
  );
};
