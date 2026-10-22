import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Server,
  AlertCircle,
  Globe,
  Flame,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { api, getBaseApiUrl, setCustomApiUrl } from '../services/api.ts';

interface LoginViewProps {
  onLoginSuccess: () => void;
  onOpenGuide: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onOpenGuide,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customApiUrl, setCustomApiState] = useState(
    localStorage.getItem('vps_custom_api_url') || ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (customApiUrl.trim()) {
        setCustomApiUrl(customApiUrl);
      }
      await api.login(password);
      onLoginSuccess();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Invalid admin password or network error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-orange-500 selection:text-white">
      {/* Subtle warm ambient glow in background */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-orange-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Sleek AniMayX Cloud Logo */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-zinc-900 via-zinc-900 to-black border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/10 mb-4 group hover:border-orange-500/60 transition-all">
          <Flame className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform duration-300" />
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-2.5">
          <Lock className="w-3.5 h-3.5" />
          <span>ADMINISTRATOR GATEWAY</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          AniMay<span className="text-orange-500">X</span> Cloud
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
          High-performance private VPS storage & raw binary delivery system
        </p>
      </div>

      <div className="relative z-10 mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#121215] py-8 px-6 sm:px-8 rounded-3xl border border-zinc-800/80 shadow-2xl shadow-black/60 hover:border-zinc-700/80 transition-all">
          {/* Admin Policy Notice */}
          <div className="mb-5 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center space-x-1.5 text-zinc-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Restricted Admin-Only System</span>
            </div>
            <p className="text-zinc-400 leading-normal">
              Public registration is disabled. Normal user accounts do not exist. Only verified administrators can access the console to upload, rename, or delete files.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-zinc-300 mb-1.5"
              >
                Administrator Master Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  required
                  autoFocus
                  className="w-full bg-[#18181c] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 pr-11 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-orange-400 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-red-950/40 border border-red-900/50 text-xs text-red-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="admin-login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-sm font-semibold py-3 px-4 rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Public links guarantee banner */}
          <div className="mt-3.5 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center space-x-1 text-zinc-400">
              <Radio className="w-3.5 h-3.5 text-orange-500" />
              <span>Public /f/:id links</span>
            </span>
            <span className="text-zinc-400">Streamable without login</span>
          </div>

          {/* Separately Hosted Frontend Option */}
          <div className="mt-3.5 pt-3.5 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-zinc-400 hover:text-orange-400 flex items-center justify-between w-full cursor-pointer transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-orange-500" />
                <span>Separately Hosted Frontend? (Custom VPS URL)</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {showAdvanced ? 'Hide' : 'Configure'}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-1.5 text-xs">
                <label className="text-[11px] text-zinc-400 block">
                  VPS API Host (e.g. <code className="font-mono text-orange-400">https://files.example.com</code>):
                </label>
                <input
                  type="url"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiState(e.target.value)}
                  placeholder="https://files.example.com"
                  className="w-full bg-[#18181c] border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                />
                <p className="text-[10px] text-zinc-500">
                  Leave blank if serving from the same domain or local environment.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* VPS Deployment Guide Link */}
        <div className="mt-5 text-center">
          <button
            onClick={onOpenGuide}
            className="text-xs text-zinc-400 hover:text-orange-400 transition-colors cursor-pointer inline-flex items-center space-x-1"
          >
            <span>Need Ubuntu VPS setup or Nginx instructions?</span>
            <span className="text-orange-400 font-medium underline underline-offset-4">View Guide</span>
          </button>
        </div>
      </div>
    </div>
  );
};
