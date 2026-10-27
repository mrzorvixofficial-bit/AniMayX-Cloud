# Ubuntu VPS Production Deployment Guide

This guide describes how to deploy the Private Cloud Storage backend to your VPS (`https://files.example.com`) and connect your separately hosted frontend (`https://cloud.example.com`).

---

## Architecture Overview

```text
Frontend Website:
https://cloud.example.com (Vercel, Netlify, or Static Server)
        │
        │ HTTPS API requests (with Admin JWT Token)
        ▼
VPS Storage & API:
https://files.example.com
        │
        ├── Authenticated API: POST /api/upload, GET /api/files
        │
        └── Public Direct Raw File Serving: GET /f/:id
                │
                ▼
        /opt/AniMayX-Cloud/storage/uploads/ (Physical Files)
        /opt/AniMayX-Cloud/storage/metadata/storage.db (SQLite Database)
```

Public users access files directly via:
```text
https://files.example.com/f/abc123?raw=1
```
- Returns the **actual file binary stream**, NOT an HTML wrapper or video player page.
- Supports **HTTP Range byte requests** (`Range: bytes=...`) for instant video seeking.
- Allowed to be embedded into `<video src="...">` and `<img src="...">` across external sites via cross-origin headers.

---

## 1. Prerequisites on Debian 13 / Ubuntu VPS

Log in to your VPS via SSH:
```bash
ssh root@your-vps-ip
```

Update packages and install required tools:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx
```

Install **Node.js 22 LTS**:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Should display v22.x or newer
```

---

## 2. Storage Directory Setup

Create the persistent storage and metadata directories:
```bash
sudo mkdir -p /opt/AniMayX-Cloud/storage/uploads
sudo mkdir -p /opt/AniMayX-Cloud/storage/metadata
sudo chown -R $USER:$USER /opt/AniMayX-Cloud
sudo chmod -R 775 /opt/AniMayX-Cloud/storage
```

---

## 3. Clone and Build the Application

Clone or copy your project into `/opt/AniMayX-Cloud`:
```bash
mkdir -p /opt/AniMayX-Cloud
cd /opt/AniMayX-Cloud

# If copying files or pulling from Git:
# git clone <your-repo> .
npm install
npm run build
```

---

## 4. Environment Variables (`.env`)

Create `/opt/AniMayX-Cloud/.env`:
```bash
nano /opt/AniMayX-Cloud/.env
```

Paste the following configuration:
```env
PORT=3000

# Physical storage and SQLite database on VPS
STORAGE_PATH="/opt/AniMayX-Cloud/storage/uploads"
DATABASE_PATH="/opt/AniMayX-Cloud/storage/metadata/storage.db"

# JWT Secret for signing admin sessions (min 32 characters)
JWT_SECRET="replace-with-a-random-32-char-secret-string-here"

# Admin password hash (generate with: node -e 'console.log(require("bcryptjs").hashSync("YourPassword", 10))')
# Or set initial plain password:
ADMIN_PASSWORD="YourStrongPassword123"

# -----------------------------------------------------------
# CORS CONFIGURATION:
# Change this to your frontend domain! Supports comma-separated domains or '*'
# Localhost (http/https) and same-host calls are automatically allowed.
# Examples:
# FRONTEND_URL="https://cloud.example.com"
# FRONTEND_URL="https://cloud.example.com,http://localhost:3000,https://localhost:3000"
# FRONTEND_URL="*"
# -----------------------------------------------------------
FRONTEND_URL="https://cloud.example.com,http://localhost:3000,https://localhost:3000"

# Public Base URL used for generated direct raw file URLs
PUBLIC_BASE_URL="https://files.example.com"

# Max upload limit (in bytes) - default 100GB
MAX_UPLOAD_SIZE=107374182400
```

---

## 5. Configure Systemd Service

Create `/etc/systemd/system/animayx-cloud.service`:
```bash
sudo nano /etc/systemd/system/animayx-cloud.service
```

Paste:
```ini
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

StandardOutput=journal
StandardError=journal
SyslogIdentifier=animayx-cloud

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable animayx-cloud
sudo systemctl start animayx-cloud
sudo systemctl status animayx-cloud
```

---

## 6. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/files.example.com`:
```bash
sudo nano /etc/nginx/sites-available/files.example.com
```

Paste:
```nginx
server {
    server_name files.example.com;

    # Allow large uploads (0 disables size restriction in Nginx)
    client_max_body_size 0;

    # Direct raw file serving: /f/:id
    location /f/ {
        proxy_pass http://127.0.0.1:3000/f/;
        proxy_http_version 1.1;

        # Keep Range header intact for video seeking
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;

        # Enable cross-origin embedding for <img> and <video>
        add_header Access-Control-Allow-Origin * always;
        add_header Cross-Origin-Resource-Policy cross-origin always;
        add_header Accept-Ranges bytes always;

        # Disable buffering for instant video streaming
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

        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 60s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the Nginx configuration:
```bash
sudo ln -s /etc/nginx/sites-available/files.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. DNS and Let's Encrypt HTTPS

In your DNS provider (Cloudflare, Namecheap, Route53, etc.):
1. Create an **A record**:
   - Host: `files` (or `files.example.com`)
   - Points to: `Your VPS Public IPv4 Address`
2. Create your frontend DNS record:
   - Host: `cloud` (or `cloud.example.com`)
   - Points to: Your frontend hosting provider

Install free SSL certificate on the VPS:
```bash
sudo certbot --nginx -d files.example.com
```

Certbot automatically manages certificate renewals.

---

## 8. Connect Separately Hosted Frontend

On your frontend (`https://cloud.example.com`):
- Click **Settings** in the navbar or on the login page.
- Enter your VPS API Host: `https://files.example.com`.
- Or set build-time environment variable `VITE_API_URL=https://files.example.com`.

---

## 9. Verification & Testing Commands

### A. Test Admin Login:
```bash
TOKEN=$(curl -s -X POST https://files.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YourStrongPassword123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Admin Token: $TOKEN"
```

### B. Test File Upload:
```bash
curl -X POST https://files.example.com/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/sample.mp4"
```

### C. Test Public Direct URL (without login):
```bash
curl -I https://files.example.com/f/abc123?raw=1
```
*Expected: `HTTP/2 200 OK`, `Content-Type: video/mp4`, `Access-Control-Allow-Origin: *`*

### D. Test HTTP Range Byte Seeking:
```bash
curl -I -H "Range: bytes=0-1024" https://files.example.com/f/abc123?raw=1
```
*Expected: `HTTP/2 206 Partial Content`, `Content-Range: bytes 0-1024/...`*

---

## 10. Updating the Application

To update your deployment in the future:
```bash
cd ~/cloud-storage
git pull
npm install
npm run build
sudo systemctl restart animayx-cloud
```
