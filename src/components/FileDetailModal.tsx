import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  Trash2,
  Edit2,
  Code,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Archive,
  Terminal,
  Radio,
  Flame,
  Sparkles,
} from 'lucide-react';
import { StoredFile } from '../types.ts';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters.ts';
import { playClickSound, playDeleteSound, playSuccessSound } from '../utils/sound.ts';
import { api } from '../services/api.ts';

interface FileDetailModalProps {
  file: StoredFile | null;
  onClose: () => void;
  onDelete: (file: StoredFile) => void;
  onRename: (file: StoredFile, newName: string) => void;
}

export const FileDetailModal: React.FC<FileDetailModalProps> = ({
  file,
  onClose,
  onDelete,
  onRename,
}) => {
  if (!file) return null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(file.original_name);
  const [activeTab, setActiveTab] = useState<'preview' | 'embed' | 'technical'>('preview');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenSuccessMsg, setRegenSuccessMsg] = useState('');
  const [regenErrorMsg, setRegenErrorMsg] = useState('');

  const handleRegenerateLink = async () => {
    setIsRegenerating(true);
    setRegenSuccessMsg('');
    setRegenErrorMsg('');
    playClickSound();
    try {
      const res = await api.regenerateMegaLink(file.id);
      if (res.success) {
        setRegenSuccessMsg('MEGA share link regenerated successfully!');
        playSuccessSound();
        file.mega_share_link = res.mega_share_link;
      }
    } catch (err: any) {
      setRegenErrorMsg(err.message || 'Failed to regenerate link');
    } finally {
      setIsRegenerating(false);
    }
  };

  const category = getFileCategory(file.mime_type, file.original_name);

  const copySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    playSuccessSound();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName !== file.original_name) {
      onRename(file, newName.trim());
      playSuccessSound();
    }
    setIsEditing(false);
  };

  const rawBase = file.public_url.split('?')[0];
  const downloadUrl = file.public_url.includes('?') ? `${file.public_url}&dl=1` : `${file.public_url}?dl=1`;

  const embedSnippets = [
    {
      label: category === 'video' ? 'Direct Video Stream URL (?raw=1)' : 'Dropbox-Style Direct Link',
      key: 'raw',
      code: file.public_url,
      description: 'Dropbox-style link with original filename and token keys. When opened, it automatically redirects to your website inline stream (/cd/0/inline/.../file#).',
    },
    {
      label: 'Force Download URL (?dl=1)',
      key: 'download',
      code: downloadUrl,
      description: 'Triggers Content-Disposition: attachment for direct file download.',
    },
    {
      label: 'HTML Video Tag (Range Seekable)',
      key: 'html_video',
      code: `<video src="${file.public_url}" controls playsinline preload="metadata"></video>`,
      description: 'Supports HTTP Range byte requests for rapid video seeking.',
    },
    {
      label: 'HTML Image Tag',
      key: 'html_img',
      code: `<img src="${file.public_url}" alt="${file.original_name}" loading="lazy" />`,
      description: 'Direct embedding on external websites without CORS issues.',
    },
    {
      label: 'HTML Audio Tag',
      key: 'html_audio',
      code: `<audio src="${file.public_url}" controls preload="metadata"></audio>`,
      description: 'Direct audio player embedding.',
    },
    {
      label: 'Markdown Image / Link',
      key: 'markdown',
      code: category === 'image' ? `![${file.original_name}](${file.public_url})` : `[${file.original_name}](${file.public_url})`,
      description: 'Ready for READMEs, blogs, and documentation.',
    },
  ];

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

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 bg-[#111116] rounded-3xl max-w-3xl w-full border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center space-x-3.5 truncate max-w-lg">
            <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
              {category === 'image' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
              {category === 'video' && <Film className="w-5 h-5 text-orange-400" />}
              {category === 'audio' && <Music className="w-5 h-5 text-purple-400" />}
              {category === 'archive' && <Archive className="w-5 h-5 text-rose-400" />}
              {category === 'document' && <FileText className="w-5 h-5 text-amber-400" />}
              {category === 'other' && <FileText className="w-5 h-5 text-zinc-400" />}
            </div>

            <div className="truncate">
              {isEditing ? (
                <form onSubmit={handleSaveName} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-sm font-semibold text-white bg-zinc-900 border border-orange-500/50 rounded-xl px-3 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1 rounded-xl cursor-pointer transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setNewName(file.original_name);
                    }}
                    className="text-xs text-zinc-400 hover:text-white px-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white tracking-wide truncate" title={file.original_name}>
                    {file.original_name}
                  </h3>
                  <button
                    onClick={() => {
                      playClickSound();
                      setIsEditing(true);
                    }}
                    className="text-zinc-400 hover:text-orange-400 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Rename"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Direct ID: <span className="text-orange-400 font-bold">{file.id}</span> • {formatBytes(file.size)}
              </p>
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

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800/80 px-6 bg-zinc-950/60">
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('preview');
            }}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-orange-500 text-orange-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Live Direct Preview
          </button>
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('embed');
            }}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'embed'
                ? 'border-orange-500 text-orange-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Direct Embed Codes
          </button>
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('technical');
            }}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === 'technical'
                ? 'border-orange-500 text-orange-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            HTTP Headers & VPS Storage
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Direct Embed Preview Area */}
              <div className="bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800/80 flex items-center justify-center min-h-[260px] max-h-[380px] relative shadow-inner">
                {category === 'image' && (
                  <img
                    src={file.public_url}
                    alt={file.original_name}
                    className="max-h-[360px] max-w-full object-contain"
                  />
                )}
                {category === 'video' && (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <video
                      key={file.public_url}
                      src={file.public_url}
                      controls
                      playsInline
                      preload="metadata"
                      crossOrigin="anonymous"
                      className="w-full max-h-[360px] rounded-xl object-contain bg-black"
                    />
                  </div>
                )}
                {category === 'audio' && (
                  <div className="p-8 w-full max-w-md text-center">
                    <div className="flex items-end justify-center space-x-1 h-8 mb-4">
                      <div className="w-1.5 bg-orange-500 rounded-full animate-wave-1" />
                      <div className="w-1.5 bg-amber-400 rounded-full animate-wave-2" />
                      <div className="w-1.5 bg-orange-400 rounded-full animate-wave-3" />
                      <div className="w-1.5 bg-amber-500 rounded-full animate-wave-4" />
                      <div className="w-1.5 bg-orange-500 rounded-full animate-wave-1" />
                    </div>
                    <div className="text-zinc-400 text-xs mb-4 font-mono">
                      Streaming audio directly from VPS with byte-range seek
                    </div>
                    <audio src={file.public_url} controls className="w-full" />
                  </div>
                )}
                {(category === 'document' || category === 'archive' || category === 'other') && (
                  <div className="text-center p-8">
                    <div className="mx-auto w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3.5 shadow-inner">
                      <FileText className="w-8 h-8 text-orange-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">{file.original_name}</p>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">{file.mime_type}</p>
                    <div className="mt-5 flex items-center justify-center space-x-2.5">
                      <a
                        href={file.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/40 text-zinc-200 text-xs font-semibold transition-all shadow-md"
                      >
                        <ExternalLink className="w-4 h-4 text-orange-400" />
                        <span>Open Raw Stream</span>
                      </a>
                      <a
                        href={downloadUrl}
                        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct URL Bar */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="truncate text-xs font-mono text-zinc-300 min-w-0">
                  <div className="flex items-center space-x-1.5 text-[10px] text-orange-400 font-bold tracking-wider mb-1 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                    <span>DROPBOX FORMAT LINK (AUTO-REDIRECTS TO INLINE STREAM)</span>
                  </div>
                  <div className="truncate text-white font-semibold">
                    {file.public_url}
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => copySnippet(file.public_url, 'main_url')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer"
                  >
                    {copiedKey === 'main_url' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                  <a
                    href={file.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
                    title="Open in new tab (auto-redirects to /cd/0/inline/.../file#)"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 text-xs text-orange-200 flex items-start space-x-3 shadow-inner">
                <Radio className="w-5 h-5 text-orange-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold text-orange-300 block mb-1 text-xs">Cross-Origin Raw Embeds Ready</span>
                  These URLs can be embedded directly into external websites, mobile apps, HTML templates, or video players without CORS blockage or authentication requirements.
                </div>
              </div>

              <div className="space-y-3.5">
                {embedSnippets.map((snippet) => (
                  <div key={snippet.key} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">{snippet.label}</span>
                      <button
                        onClick={() => copySnippet(snippet.code, snippet.key)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-orange-500 hover:text-white border border-zinc-700 text-zinc-300 text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        {copiedKey === snippet.key ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span className="text-white">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-orange-400" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-black/70 text-zinc-200 p-3 rounded-xl text-xs font-mono overflow-x-auto border border-zinc-800/80 selection:bg-orange-500 selection:text-white">
                      {snippet.code}
                    </pre>
                    <p className="text-[11px] text-zinc-400 mt-2 font-medium">{snippet.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">FILE IDENTIFIER</span>
                  <span className="font-mono font-bold text-orange-400">{file.id}</span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">MIME TYPE</span>
                  <span className="font-mono font-bold text-zinc-200">{file.mime_type}</span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">EXACT BYTE SIZE</span>
                  <span className="font-mono font-bold text-zinc-200">{file.size.toLocaleString()} bytes</span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">TOTAL ACCESS COUNT</span>
                  <span className="font-mono font-bold text-orange-400">{file.download_count} requests</span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl col-span-1 sm:col-span-2">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">UPLOAD TIMESTAMP</span>
                  <span className="font-semibold text-zinc-200">{formatDate(file.created_at)}</span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">STORAGE BACKEND</span>
                  <span className={`font-mono font-bold ${file.storage_backend === 'mega' ? 'text-teal-400' : 'text-zinc-200'}`}>
                    {file.storage_backend === 'mega' ? 'MEGA Cloud Storage' : 'Local VPS Storage'}
                  </span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                  <span className="text-zinc-500 block font-mono text-[11px] font-semibold">
                    {file.storage_backend === 'mega' ? 'MEGA CLOUD STORAGE IDENTIFIER' : 'INTERNAL VPS DISK PATH'}
                  </span>
                  <span className="font-mono text-zinc-400 text-[11px] truncate block">
                    {file.storage_backend === 'mega' 
                      ? `node_id: ${file.mega_file_id || 'N/A'}` 
                      : `/storage/uploads/${file.sanitized_name}`}
                  </span>
                </div>
              </div>

              {file.storage_backend === 'mega' && (
                <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800 text-white space-y-3 shadow-inner">
                  <div className="flex items-center space-x-2 text-xs font-mono text-teal-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-semibold">MEGA Cloud Storage Connection Info</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-zinc-300">
                    <div className="flex justify-between font-mono bg-black/40 p-2 rounded-xl">
                      <span className="text-zinc-500">Node ID:</span>
                      <span className="font-bold">{file.mega_file_id || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col space-y-1 bg-black/40 p-2.5 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 font-mono">Decryption Key Share Link:</span>
                        {file.mega_share_link && (
                          <button
                            onClick={() => copySnippet(file.mega_share_link!, 'mega_link')}
                            className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedKey === 'mega_link' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'mega_link' ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 break-all select-all">
                        {file.mega_share_link || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1.5">
                    <button
                      onClick={handleRegenerateLink}
                      disabled={isRegenerating}
                      className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-950/40 hover:bg-teal-900/60 border border-teal-800/60 hover:border-teal-700/80 text-teal-300 hover:text-teal-200 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isRegenerating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-teal-300 border-t-transparent rounded-full animate-spin" />
                          <span>Regenerating Share Link...</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 text-teal-400 animate-pulse" />
                          <span>Regenerate & Refresh MEGA Share Link</span>
                        </>
                      )}
                    </button>
                    {regenSuccessMsg && (
                      <p className="text-xs text-emerald-400 font-medium mt-2">{regenSuccessMsg}</p>
                    )}
                    {regenErrorMsg && (
                      <p className="text-xs text-rose-400 font-medium mt-2">{regenErrorMsg}</p>
                    )}
                  </div>
                </div>
              )}

              {/* cURL range test command */}
              <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-xs font-mono text-orange-400">
                    <Terminal className="w-4 h-4" />
                    <span className="font-semibold">Test HTTP Range Request in Terminal</span>
                  </div>
                  <button
                    onClick={() =>
                      copySnippet(
                        `curl -i -H "Range: bytes=0-1024" "${file.public_url}"`,
                        'curl_cmd'
                      )
                    }
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedKey === 'curl_cmd' ? <Check className="w-3 h-3 text-orange-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                    <span>Copy cURL</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-zinc-300 overflow-x-auto p-3 bg-black/70 rounded-xl border border-zinc-800">
                  {`curl -i -H "Range: bytes=0-1024" "${file.public_url}"`}
                </pre>
                <p className="text-[11px] text-zinc-400 mt-2 font-medium">
                  Returns <code className="text-orange-400 font-mono font-bold">HTTP/1.1 206 Partial Content</code> with byte range headers for instant video seeking.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between">
          <button
            onClick={() => {
              playDeleteSound();
              onDelete(file);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete File from VPS</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <a
              href={downloadUrl}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/30 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>Download</span>
            </a>
            <button
              onClick={() => {
                playClickSound();
                onClose();
              }}
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-orange-500/20"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
