import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  UploadCloud,
  Terminal,
  Settings,
  LogOut,
  Radio,
  Flame,
  Volume2,
  VolumeX,
  Activity,
  Zap,
} from 'lucide-react';
import { StorageStats } from '../types.ts';
import { formatBytes } from '../utils/formatters.ts';
import {
  isSoundEnabled,
  toggleSound,
  playClickSound,
  initSoundPreference,
} from '../utils/sound.ts';

interface NavbarProps {
  storageStats: StorageStats | null;
  onOpenUpload: () => void;
  onOpenTester: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  totalFiles?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  storageStats,
  onOpenUpload,
  onOpenTester,
  onOpenGuide,
  onOpenSettings,
  onLogout,
}) => {
  const [soundOn, setSoundOn] = useState(true);
  const [latency, setLatency] = useState<number>(14);

  useEffect(() => {
    initSoundPreference();
    setSoundOn(isSoundEnabled());

    // Randomize ping slightly to simulate live monitoring (12 - 24 ms)
    const interval = setInterval(() => {
      setLatency(Math.floor(12 + Math.random() * 8));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSoundToggle = () => {
    const updated = toggleSound();
    setSoundOn(updated);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#070709]/90 backdrop-blur-xl border-b border-zinc-800/80 shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Identity */}
        <div className="flex items-center space-x-3.5">
          <motion.div
            whileHover={{ scale: 1.08, rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.3 }}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-black via-zinc-900 to-orange-950/40 border border-orange-500/40 flex items-center justify-center text-white shadow-md shadow-orange-500/20 cursor-pointer"
          >
            <Flame className="w-5 h-5 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          </motion.div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-white text-base tracking-tight flex items-center">
                AniMay<span className="text-orange-500 ml-0.5">X</span>
                <span className="ml-1 text-zinc-400 font-medium text-xs">Cloud</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                VPS ENGINE
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-zinc-400 hidden sm:flex">
              <span className="text-zinc-500">Status:</span>
              <span className="inline-flex items-center text-emerald-400 font-mono text-[10px]">
                <Activity className="w-3 h-3 mr-1 text-emerald-400 animate-pulse" />
                ONLINE ({latency}ms)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Storage Capacity Metric */}
          {storageStats && (
            <div className="hidden lg:flex items-center text-xs text-zinc-300 bg-zinc-950/80 px-3.5 py-1.5 rounded-full border border-zinc-800/80 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2 animate-pulse" />
              <span className="font-medium text-zinc-400 mr-1.5">Disk:</span>
              <span className="text-white font-mono font-semibold">{formatBytes(storageStats.used_bytes)}</span>
              <span className="mx-1.5 text-zinc-600">/</span>
              <span className="text-zinc-400 font-mono">{formatBytes(storageStats.total_bytes)}</span>
            </div>
          )}

          {/* Sound FX Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSoundToggle}
            title={soundOn ? 'Sound FX On (Click to mute)' : 'Sound FX Muted (Click to turn on)'}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundOn
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </motion.button>

          {/* Upload CTA Button */}
          <motion.button
            id="nav-upload-btn"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playClickSound();
              onOpenUpload();
            }}
            className="relative overflow-hidden inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all cursor-pointer group"
          >
            <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />
            <UploadCloud className="w-4 h-4 text-white group-hover:animate-bounce" />
            <span>Upload</span>
          </motion.button>

          {/* Tester Modal Button */}
          <motion.button
            id="nav-tester-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playClickSound();
              onOpenTester();
            }}
            title="Inspect /f/:id raw file responses and Range requests"
            className="inline-flex items-center space-x-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl border border-zinc-800 hover:border-orange-500/40 transition-all cursor-pointer"
          >
            <Radio className="w-4 h-4 text-orange-400" />
            <span className="hidden md:inline">Raw Tester</span>
          </motion.button>

          {/* Ubuntu VPS Deployment Guide */}
          <motion.button
            id="nav-guide-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playClickSound();
              onOpenGuide();
            }}
            title="Ubuntu VPS Deployment & Nginx Guide"
            className="inline-flex items-center space-x-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl border border-zinc-800 hover:border-orange-500/40 transition-all cursor-pointer"
          >
            <Terminal className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">VPS Guide</span>
          </motion.button>

          {/* Settings */}
          <motion.button
            id="nav-settings-btn"
            whileHover={{ scale: 1.05, rotate: 30 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playClickSound();
              onOpenSettings();
            }}
            title="Admin & Server Settings"
            className="p-2 text-zinc-400 hover:text-orange-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </motion.button>

          {/* Logout */}
          <motion.button
            id="nav-logout-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playClickSound();
              onLogout();
            }}
            title="Sign out of Admin Console"
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
