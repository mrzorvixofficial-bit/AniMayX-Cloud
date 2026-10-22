import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Key,
  Globe,
  HardDrive,
  Shield,
  Check,
  AlertCircle,
  Server,
  RefreshCw,
  Flame,
  Link2,
  Sparkles,
} from 'lucide-react';
import {
  api,
  getBaseApiUrl,
  setCustomApiUrl,
  setCustomPublicBaseUrl,
  getCustomPublicBaseUrl,
} from '../services/api.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [apiUrl, setApiUrl] = useState('');
  const [apiUrlSaved, setApiUrlSaved] = useState(false);

  // Public File Link URL Analyzer state
  const [customPublicUrl, setCustomPublicUrl] = useState('');
  const [autoDetectedUrl, setAutoDetectedUrl] = useState('');
  const [publicUrlSaved, setPublicUrlSaved] = useState(false);
  const [urlConfigLoading, setUrlConfigLoading] = useState(false);

  const [serverInfo, setServerInfo] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiUrl(localStorage.getItem('vps_custom_api_url') || '');
      setCustomPublicUrl(getCustomPublicBaseUrl());
      setAutoDetectedUrl(window.location.origin);
      loadServerInfo();
      loadUrlConfig();
    }
  }, [isOpen]);

  const loadUrlConfig = async () => {
    try {
      setUrlConfigLoading(true);
      const data = await api.getUrlConfig();
      const currentOrigin = window.location.origin;
      const isBrowserRemote = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      const detected = isBrowserRemote && (data.auto_detected_url?.includes('localhost') || data.auto_detected_url?.includes('127.0.0.1'))
        ? currentOrigin
        : (data.auto_detected_url || currentOrigin);
      setAutoDetectedUrl(detected);
      if (data.custom_url) {
        setCustomPublicUrl(data.custom_url);
      }
    } catch (err) {
      console.error('Failed to load url config:', err);
      setAutoDetectedUrl(window.location.origin);
    } finally {
      setUrlConfigLoading(false);
    }
  };

  const loadServerInfo = async () => {
    try {
      const stats = await api.getStorageStats();
      if (stats.server_info) {
        setServerInfo(stats.server_info);
      }
    } catch (err) {
      console.error('Failed to load server info:', err);
    }
  };

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({
        type: 'error',
        msg: 'New password must be at least 6 characters long',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      playSuccessSound();
      setPasswordStatus({
        type: 'success',
        msg: 'Admin password successfully updated in SQLite database!',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordStatus({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to change password',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiUrl(apiUrl);
    playSuccessSound();
    setApiUrlSaved(true);
    setTimeout(() => setApiUrlSaved(false), 2000);
    onRefresh();
  };

  const handleSavePublicUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customPublicUrl.trim();
    setCustomPublicBaseUrl(clean);
    try {
      await api.updateUrlConfig(clean);
      playSuccessSound();
    } catch (err) {
      console.warn('Could not sync URL config with server database:', err);
    }
    setPublicUrlSaved(true);
    setTimeout(() => setPublicUrlSaved(false), 2000);
    onRefresh();
  };

  const handleResetPublicUrl = async () => {
    setCustomPublicUrl('');
    setCustomPublicBaseUrl('');
    try {
      await api.updateUrlConfig('');
      playClickSound();
    } catch (err) {
      console.warn('Could not reset URL config on server:', err);
    }
    setPublicUrlSaved(true);
    setTimeout(() => setPublicUrlSaved(false), 2000);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 bg-[#111116] rounded-3xl max-w-xl w-full border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Admin & Server Settings</h3>
                <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-full font-bold">
                  ROOT ADMIN
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Security, VPS endpoints, and storage paths</p>
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

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Change Admin Password */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4.5 shadow-sm">
            <div className="flex items-center space-x-2 text-white font-bold mb-3">
              <Key className="w-4 h-4 text-orange-400" />
              <span>Change Admin Password</span>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Current Password:</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password (default: admin)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">New Password:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Confirm New Password:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              </div>

              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl flex items-center space-x-2 ${
                    passwordStatus.type === 'success'
                      ? 'bg-orange-500/10 text-orange-300 border border-orange-500/30'
                      : 'bg-red-950/40 text-red-300 border border-red-900/50'
                  }`}
                >
                  {passwordStatus.type === 'success' ? (
                    <Check className="w-4 h-4 shrink-0 text-orange-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span className="font-medium">{passwordStatus.msg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Website Link & Public URL Auto-Analyzer */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-white font-bold">
                <Link2 className="w-4 h-4 text-orange-400" />
                <span>Website Public File Link Analyzer</span>
              </div>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>AUTO-ANALYZE ACTIVE</span>
              </span>
            </div>

            <p className="text-zinc-400 mb-3 text-[11px] leading-relaxed">
              Files and folder links automatically analyze and adapt to your current website URL (<code className="text-orange-300 font-mono font-bold">{window.location.origin}</code>) so that direct copy links work instantly on any external player, browser, or device.
            </p>

            <div className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-2xl mb-3 space-y-2 font-mono text-[11px] shadow-inner">
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-zinc-500">Auto-Detected Website Domain:</span>
                <span className="text-emerald-400 font-bold truncate max-w-xs">{autoDetectedUrl || window.location.origin}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-zinc-500">Dropbox Main Link Format:</span>
                <span className="text-orange-300 font-bold truncate max-w-xs">
                  {(customPublicUrl || autoDetectedUrl || window.location.origin).replace(/\/+$/, '')}/scl/fi/&#123;id&#125;/&#123;name&#125;?rlkey=...&amp;st=...&amp;raw=1
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-zinc-500">Auto-Redirects When Opened:</span>
                <span className="text-emerald-300 font-bold truncate max-w-xs">
                  {(customPublicUrl || autoDetectedUrl || window.location.origin).replace(/\/+$/, '')}/cd/0/inline/&#123;token&#125;/file#
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePublicUrl} className="space-y-2">
              <label className="block text-zinc-400 text-[11px] font-medium">
                Custom Public Domain / CDN Override (optional - leave empty to auto-analyze website):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customPublicUrl}
                  onChange={(e) => setCustomPublicUrl(e.target.value)}
                  placeholder={`Auto-detect: ${window.location.origin}`}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="submit"
                  className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  {publicUrlSaved ? 'Saved!' : 'Save Domain'}
                </button>
                {customPublicUrl && (
                  <button
                    type="button"
                    onClick={handleResetPublicUrl}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0 text-[11px] font-medium"
                  >
                    Reset Auto
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Separately Hosted Frontend Connection */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4.5 shadow-sm">
            <div className="flex items-center space-x-2 text-white font-bold mb-1">
              <Globe className="w-4 h-4 text-orange-400" />
              <span>Separately Hosted Frontend Endpoint</span>
            </div>
            <p className="text-zinc-400 mb-3 font-medium">
              If this frontend is hosted separately (e.g. <code className="text-orange-300 font-mono">https://cloud.example.com</code>), specify your VPS backend URL (<code className="text-orange-300 font-mono">https://files.example.com</code>).
            </p>

            <form onSubmit={handleSaveApiUrl} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://files.example.com (or leave empty for same-origin)"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="submit"
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-orange-500/40 text-white font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  {apiUrlSaved ? 'Saved!' : 'Save Endpoint'}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Current active target: <code className="font-mono text-orange-400 font-bold">{getBaseApiUrl()}</code>
              </p>
            </form>
          </div>

          {/* Physical Storage Paths on VPS */}
          {serverInfo && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4.5 space-y-2 font-mono text-[11px] shadow-sm">
              <span className="font-bold font-sans text-xs text-white block">
                AniMayX Cloud VPS Environment
              </span>
              <div className="grid grid-cols-1 gap-2 text-zinc-400">
                <div className="flex justify-between py-1 border-b border-zinc-800/80">
                  <span className="text-zinc-500 font-semibold">Storage Dir:</span>
                  <span className="text-orange-300 font-bold truncate max-w-xs">{String(serverInfo.storage_path)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/80">
                  <span className="text-zinc-500 font-semibold">SQLite DB:</span>
                  <span className="text-orange-300 font-bold truncate max-w-xs">{String(serverInfo.database_path)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/80">
                  <span className="text-zinc-500 font-semibold">Allowed CORS Origin:</span>
                  <span className="text-white font-bold">{String(serverInfo.frontend_url)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500 font-semibold">Public Base URL:</span>
                  <span className="text-orange-400 font-bold">{String(serverInfo.public_base_url)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-end">
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
