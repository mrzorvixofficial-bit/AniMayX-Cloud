import React, { useState } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  Server,
  Shield,
  Globe,
  HardDrive,
  FileCode,
  ExternalLink,
  Flame,
} from 'lucide-react';

interface DeploymentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'quickstart' | 'nginx' | 'systemd' | 'env' | 'dns_ssl' | 'testing'
  >('quickstart');

  if (!isOpen) return null;

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const quickstartScript = `#!/bin/bash
# AniMayX Cloud - VPS Setup for Debian 13 / Ubuntu 22.04 / 24.04
set -e

echo "=== 1. Updating Debian/Ubuntu packages and installing dependencies ==="
sudo apt-get update && sudo apt-get install -y curl git ufw nginx certbot python3-certbot-nginx

echo "=== 2. Installing Node.js 22 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 3. Setting up /opt/AniMayX-Cloud and storage directories ==="
sudo mkdir -p /opt/AniMayX-Cloud/storage/uploads
sudo mkdir -p /opt/AniMayX-Cloud/storage/metadata
sudo chown -R $USER:$USER /opt/AniMayX-Cloud
sudo chmod -R 775 /opt/AniMayX-Cloud/storage

echo "=== 4. Setting up Application Code in /opt/AniMayX-Cloud ==="
cd /opt/AniMayX-Cloud

# If deploying from git repo:
# git clone <your-repo-url> .
# npm install
# npm run build
# npm start

echo "Setup complete! Configure /opt/AniMayX-Cloud/.env and start the systemd service."
`;

  const envFileExample = `# /opt/AniMayX-Cloud/.env
# ========================================================
# AniMayX Cloud VPS Storage & Raw File Server Configuration
# ========================================================

PORT=3000

# Physical disk paths on VPS (Debian 13 default)
STORAGE_PATH="/opt/AniMayX-Cloud/storage/uploads"
DATABASE_PATH="/opt/AniMayX-Cloud/storage/metadata/storage.db"

# JWT Secret for admin session signing (generate random 32+ char string)
JWT_SECRET="replace-with-a-random-32-char-secret-string-here"

# Admin password hash or initial password
# Generate hash via: node -e 'console.log(require("bcryptjs").hashSync("MyStrongPassword!", 10))'
ADMIN_PASSWORD_HASH=""
ADMIN_PASSWORD="MyStrongPassword123"

# --------------------------------------------------------
# CORS CONFIGURATION:
# Change this to your frontend domain! Supports comma-separated origins or '*'
# Localhost (http/https) and same-host calls are automatically allowed.
# --------------------------------------------------------
FRONTEND_URL="https://cloud.example.com,http://localhost:3000,https://localhost:3000"

# Public Base URL for generated direct raw file links
# Example: https://files.example.com
PUBLIC_BASE_URL="https://files.example.com"

# Max upload limit in bytes (100GB = 107374182400)
MAX_UPLOAD_SIZE=107374182400
`;

  const nginxConfig = `# /etc/nginx/sites-available/files.example.com
# AniMayX Cloud Nginx Reverse Proxy for VPS Storage API & Raw File Server

server {
    server_name files.example.com;

    # Maximum file upload size (0 = unlimited for large chunked video uploads)
    client_max_body_size 0;

    # Public direct raw file endpoint: /f/:id
    # Passes Range requests directly so videos can seek instantly
    location /f/ {
        proxy_pass http://127.0.0.1:3000/f/;
        proxy_http_version 1.1;

        # Keep Range header intact for video playback
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;

        # Allow external websites to embed files (img/video/audio)
        add_header Access-Control-Allow-Origin * always;
        add_header Cross-Origin-Resource-Policy cross-origin always;
        add_header Accept-Ranges bytes always;

        # Disable proxy buffering for instant media streaming
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Authenticated Management APIs (/api/*)
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;

        # 10 minute timeout for large uploads
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 60s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback / optional root
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

  const systemdService = `# /etc/systemd/system/animayx-cloud.service
# Systemd unit file for auto-starting the AniMayX Cloud server on boot

[Unit]
Description=AniMayX Cloud VPS Storage Backend Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/AniMayX-Cloud
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Standard logging to journalctl
StandardOutput=journal
StandardError=journal
SyslogIdentifier=animayx-cloud

[Install]
WantedBy=multi-user.target
`;

  const testingCommands = `# 1. Test Admin Login (Get JWT Token)
TOKEN=$(curl -s -X POST https://files.example.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"password":"MyStrongPassword123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Admin Token: $TOKEN"

# 2. Test File Upload
curl -X POST https://files.example.com/api/upload \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@/path/to/myvideo.mp4"

# 3. Test Public Direct URL (WITHOUT ANY LOGIN / TOKEN)
# Replace 'abc123' with returned file ID:
curl -I https://files.example.com/f/abc123?raw=1

# 4. Test HTTP Range Request (seeking byte 0 to 1024)
curl -I -H "Range: bytes=0-1024" https://files.example.com/f/abc123?raw=1
# Expected Response: HTTP/2 206 Partial Content
`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] rounded-3xl max-w-4xl w-full border border-zinc-800 shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white">
                  Ubuntu VPS Production Deployment Guide
                </h3>
                <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-semibold">
                  UBUNTU 22/24 LTS
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Separately hosted frontend (cloud.example.com) + VPS File Server (files.example.com)
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

        {/* Tab navigation */}
        <div className="flex border-b border-zinc-800/80 px-6 bg-zinc-950/40 overflow-x-auto">
          {[
            { id: 'quickstart', label: '1. Quickstart Script' },
            { id: 'env', label: '2. .env & CORS Config' },
            { id: 'systemd', label: '3. Systemd Service' },
            { id: 'nginx', label: '4. Nginx Reverse Proxy' },
            { id: 'dns_ssl', label: '5. DNS & Let\'s Encrypt' },
            { id: 'testing', label: '6. Testing Commands' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-3.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-zinc-300">
          {activeTab === 'quickstart' && (
            <div className="space-y-3">
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 text-orange-200">
                <span className="font-semibold text-orange-300 block mb-1">Architecture Overview:</span>
                Your frontend runs at <code className="font-mono bg-black/40 text-orange-300 px-1.5 py-0.5 rounded-lg border border-orange-500/20">https://cloud.example.com</code> and interacts with your VPS backend at <code className="font-mono bg-black/40 text-orange-300 px-1.5 py-0.5 rounded-lg border border-orange-500/20">https://files.example.com</code>. Physical files stay in <code className="font-mono bg-black/40 text-orange-300 px-1.5 py-0.5 rounded-lg border border-orange-500/20">/opt/AniMayX-Cloud/storage/uploads</code>.
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Run on Ubuntu VPS (Bash Script):</span>
                <button
                  onClick={() => copyCode(quickstartScript, 'qs')}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer transition-all"
                >
                  {copiedKey === 'qs' ? <Check className="w-3.5 h-3.5 text-orange-300" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                  <span>Copy Script</span>
                </button>
              </div>

              <pre className="bg-black/60 text-zinc-200 p-4 rounded-2xl font-mono overflow-x-auto text-[11px] leading-relaxed border border-zinc-800 selection:bg-orange-500 selection:text-white">
                {quickstartScript}
              </pre>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-3">
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 text-orange-200">
                <span className="font-semibold text-orange-300 block mb-1">Where to configure CORS:</span>
                Set <code className="font-mono bg-black/40 text-orange-300 px-1.5 py-0.5 rounded-lg border border-orange-500/20">FRONTEND_URL="https://cloud.example.com"</code> in your <code className="font-mono bg-black/40 text-orange-300 px-1.5 py-0.5 rounded-lg border border-orange-500/20">.env</code> file. The backend Express server validates incoming request origins against this variable to block unauthorized origins from calling management APIs.
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Production .env File Template:</span>
                <button
                  onClick={() => copyCode(envFileExample, 'env')}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer transition-all"
                >
                  {copiedKey === 'env' ? <Check className="w-3.5 h-3.5 text-orange-300" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                  <span>Copy .env</span>
                </button>
              </div>

              <pre className="bg-black/60 text-zinc-200 p-4 rounded-2xl font-mono overflow-x-auto text-[11px] leading-relaxed border border-zinc-800 selection:bg-orange-500 selection:text-white">
                {envFileExample}
              </pre>
            </div>
          )}

          {activeTab === 'systemd' && (
            <div className="space-y-3">
              <p className="text-zinc-400">
                Create a systemd unit file so your Node.js backend automatically starts on boot and restarts if it crashes:
              </p>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">/etc/systemd/system/animayx-cloud.service</span>
                <button
                  onClick={() => copyCode(systemdService, 'sys')}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer transition-all"
                >
                  {copiedKey === 'sys' ? <Check className="w-3.5 h-3.5 text-orange-300" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                  <span>Copy Unit File</span>
                </button>
              </div>

              <pre className="bg-black/60 text-zinc-200 p-4 rounded-2xl font-mono overflow-x-auto text-[11px] leading-relaxed border border-zinc-800 selection:bg-orange-500 selection:text-white">
                {systemdService}
              </pre>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5">
                <span className="font-semibold text-white block mb-1">Commands to enable and start:</span>
                <pre className="text-orange-300 font-mono text-[11px]">
{`sudo systemctl daemon-reload
sudo systemctl enable animayx-cloud
sudo systemctl start animayx-cloud
sudo systemctl status animayx-cloud`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'nginx' && (
            <div className="space-y-3">
              <p className="text-zinc-400">
                Configure Nginx to reverse proxy requests to Node.js on port 3000, enable Range requests buffering off, and configure client body size:
              </p>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">/etc/nginx/sites-available/files.example.com</span>
                <button
                  onClick={() => copyCode(nginxConfig, 'ng')}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer transition-all"
                >
                  {copiedKey === 'ng' ? <Check className="w-3.5 h-3.5 text-orange-300" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                  <span>Copy Nginx Config</span>
                </button>
              </div>

              <pre className="bg-black/60 text-zinc-200 p-4 rounded-2xl font-mono overflow-x-auto text-[11px] leading-relaxed border border-zinc-800 selection:bg-orange-500 selection:text-white">
                {nginxConfig}
              </pre>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5">
                <span className="font-semibold text-white block mb-1">Enable site in Nginx:</span>
                <pre className="text-orange-300 font-mono text-[11px]">
{`sudo ln -s /etc/nginx/sites-available/files.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'dns_ssl' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <span className="font-semibold text-white block text-sm">1. DNS Record Configuration</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                    <span className="text-zinc-500 font-mono text-[11px] block">Frontend Website Record:</span>
                    <span className="font-semibold text-orange-400">cloud.example.com</span>
                    <p className="text-zinc-400 text-[11px] mt-1">
                      CNAME to your frontend host (Vercel, Cloudflare, Netlify, or VPS IP)
                    </p>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                    <span className="text-zinc-500 font-mono text-[11px] block">VPS Storage API Record:</span>
                    <span className="font-semibold text-orange-400">files.example.com</span>
                    <p className="text-zinc-400 text-[11px] mt-1">
                      A Record pointing directly to your VPS Public IPv4 Address (e.g. 198.51.100.25)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <span className="font-semibold text-white block text-sm">2. Free HTTPS with Let\'s Encrypt (Certbot)</span>
                <p className="text-zinc-400">Run this single command on your Ubuntu VPS to automatically issue and renew SSL certificates:</p>
                <pre className="bg-black/60 text-orange-400 p-3 rounded-xl font-mono text-[11px] border border-zinc-800">
sudo certbot --nginx -d files.example.com
                </pre>
                <p className="text-[11px] text-zinc-500">
                  Certbot modifies the Nginx configuration automatically and sets up automatic cron renewal.
                </p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <span className="font-semibold text-white block text-sm">3. Updating the Application</span>
                <p className="text-zinc-400">Whenever you update code on the VPS:</p>
                <pre className="bg-black/60 text-zinc-300 p-3 rounded-xl font-mono text-[11px] border border-zinc-800">
{`cd /opt/AniMayX-Cloud
git pull
npm install
npm run build
sudo systemctl restart animayx-cloud`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'testing' && (
            <div className="space-y-3">
              <p className="text-zinc-400">
                Run these terminal curl commands from your computer or VPS to verify that uploads, direct public links, and HTTP Range byte streaming work properly:
              </p>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Terminal Verification Script:</span>
                <button
                  onClick={() => copyCode(testingCommands, 'test')}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer transition-all"
                >
                  {copiedKey === 'test' ? <Check className="w-3.5 h-3.5 text-orange-300" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                  <span>Copy Commands</span>
                </button>
              </div>

              <pre className="bg-black/60 text-zinc-200 p-4 rounded-2xl font-mono overflow-x-auto text-[11px] leading-relaxed border border-zinc-800 selection:bg-orange-500 selection:text-white">
                {testingCommands}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span>Documentation also available in root <code className="font-mono text-orange-400">/DEPLOYMENT.md</code></span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-sm shadow-orange-500/20 transition-all cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
