import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Play,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { StoredFile } from '../types.ts';
import { getBaseApiUrl } from '../services/api.ts';

interface DirectTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: StoredFile[];
}

export const DirectTesterModal: React.FC<DirectTesterModalProps> = ({
  isOpen,
  onClose,
  files,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [rangeInput, setRangeInput] = useState<string>('0-1024');
  const [useRange, setUseRange] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    bodySnippet: string;
    durationMs: number;
    finalUrl?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  if (!isOpen) return null;

  const activeFile = files.find((f) => f.id === selectedFileId);
  const targetUrl = activeFile?.public_url || (selectedFileId
    ? `${getBaseApiUrl()}/f/${selectedFileId}?raw=1`
    : '');

  const runTest = async () => {
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const start = performance.now();
    try {
      const headers: Record<string, string> = {};
      if (useRange && rangeInput.trim()) {
        headers['Range'] = `bytes=${rangeInput.trim()}`;
      }

      // Important: fetch WITHOUT Authorization header to prove public access without login!
      const res = await fetch(targetUrl, {
        headers,
      });

      const durationMs = Math.round(performance.now() - start);

      const headerMap: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headerMap[key] = val;
      });

      // Get sample snippet of body
      let bodySnippet = '';
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text') || contentType.includes('json')) {
        const text = await res.text();
        bodySnippet = text.slice(0, 500);
      } else {
        const blob = await res.blob();
        bodySnippet = `[Binary Payload: ${blob.type || contentType}, size: ${blob.size.toLocaleString()} bytes received]`;
      }

      setResult({
        status: res.status,
        statusText: res.statusText || (res.status === 206 ? 'Partial Content' : 'OK'),
        headers: headerMap,
        bodySnippet,
        durationMs,
        finalUrl: res.url,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network request failed');
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] rounded-3xl max-w-3xl w-full border border-zinc-800 shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Direct /f/:id Endpoint & Range Tester
              </h3>
              <p className="text-xs text-zinc-400">
                Verify unauthenticated raw file streaming & HTTP byte-range seeking on AniMayX Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target File Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Target File to Test:
            </label>
            {files.length === 0 ? (
              <p className="text-xs text-zinc-400 italic bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                No files uploaded yet. Please upload a file first to test its direct URL.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {files.map((f) => (
                    <option key={f.id} value={f.id} className="bg-zinc-900 text-white">
                      {f.original_name} ({f.mime_type}) - ID: {f.id}
                    </option>
                  ))}
                </select>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={copyUrl}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/30 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-orange-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                    <span>Copy URL</span>
                  </button>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/30 rounded-xl transition-colors"
                    title="Open directly in browser"
                  >
                    <ExternalLink className="w-4 h-4 text-orange-400" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Test Configuration */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-medium text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRange}
                  onChange={(e) => setUseRange(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500 accent-orange-500"
                />
                <span>Include HTTP Range Header (<code className="font-mono text-orange-400 text-[11px]">Range: bytes=...</code>)</span>
              </label>
              <span className="text-[11px] text-zinc-400">Essential for video scrubbing</span>
            </div>

            {useRange && (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-zinc-400">Range: bytes=</span>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="0-1024"
                  className="w-36 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
                <span className="text-xs text-zinc-500 font-mono">
                  (e.g. 0-1024, 1024-4096, 500000-)
                </span>
              </div>
            )}

            <button
              onClick={runTest}
              disabled={loading || !selectedFileId}
              className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white text-xs font-semibold py-3 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Send Unauthenticated Request to /f/{selectedFileId || ':id'}?raw=1</span>
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-3.5 flex items-center space-x-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Test Result Display */}
          {result && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                  result.status === 200 || result.status === 206
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-200'
                    : 'bg-red-950/40 border-red-900/50 text-red-300'
                }`}
              >
                <div className="flex items-center space-x-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-orange-400" />
                  <span className="font-bold text-white">HTTP {result.status} {result.statusText}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-orange-400 font-semibold">{result.durationMs}ms</span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-400 bg-black/40 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {result.status === 206 ? 'Range Seek Confirmed' : 'Full File Served'}
                </span>
              </div>

              {/* Key HTTP Headers table */}
              <div className="bg-zinc-950 rounded-2xl p-4 text-white font-mono text-xs border border-zinc-800">
                <div className="text-zinc-400 text-[11px] uppercase tracking-wider mb-2.5 font-bold flex items-center justify-between">
                  <span>Server Response Headers</span>
                  <span className="text-orange-400 font-normal">Direct VPS Binary Response</span>
                </div>
                <div className="space-y-1.5 text-zinc-300 divide-y divide-zinc-800/80">
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Content-Type:</span>
                    <span className="text-orange-300 font-semibold">{result.headers['content-type'] || 'n/a'}</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Content-Range:</span>
                    <span className="text-orange-400 font-semibold">{result.headers['content-range'] || 'n/a (full body)'}</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Content-Length:</span>
                    <span>{result.headers['content-length'] || 'n/a'} bytes</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Accept-Ranges:</span>
                    <span className="text-amber-300">{result.headers['accept-ranges'] || 'bytes'}</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Content-Disposition:</span>
                    <span className="text-zinc-400">{result.headers['content-disposition'] || 'inline'}</span>
                  </div>
                  {result.finalUrl && result.finalUrl !== targetUrl && (
                    <div className="pt-1.5 flex justify-between items-center gap-2">
                      <span className="text-zinc-500 shrink-0">Redirected Inline URL:</span>
                      <span className="text-emerald-400 font-bold truncate text-[10px]">{result.finalUrl}</span>
                    </div>
                  )}
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Access-Control-Allow-Origin:</span>
                    <span className="text-orange-400 font-semibold">{result.headers['access-control-allow-origin'] || '*'} (Embedding allowed)</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">Cache-Control:</span>
                    <span>{result.headers['cache-control'] || 'public, max-age=31536000'}</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-zinc-500">ETag:</span>
                    <span className="text-zinc-400">{result.headers['etag'] || 'n/a'}</span>
                  </div>
                </div>
              </div>

              {/* Payload snippet */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5">
                <span className="text-xs font-semibold text-zinc-300 block mb-1">
                  Received Payload Chunk:
                </span>
                <pre className="text-xs font-mono text-zinc-300 bg-black/60 p-3 rounded-xl border border-zinc-800/80 overflow-x-auto selection:bg-orange-500 selection:text-white">
                  {result.bodySnippet}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span>Target public route: <code className="font-mono text-orange-400">GET /f/:id</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-sm shadow-orange-500/20 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
