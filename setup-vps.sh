#!/usr/bin/env bash
# VPS Cloud Storage Automated Bootstrap Script for Ubuntu 22.04 / 24.04 LTS
set -e

echo "=========================================================="
echo " Starting VPS Cloud Storage Automated Installation"
echo "=========================================================="

# 1. System packages
echo "Updating apt repositories and installing prerequisites..."
sudo apt update && sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx

# 2. Node.js 22 LTS
echo "Installing Node.js 22 LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Create persistent storage directories
echo "Creating physical storage folders: /storage/uploads and /storage/metadata..."
sudo mkdir -p /storage/uploads
sudo mkdir -p /storage/metadata
sudo chown -R "$USER:$USER" /storage
sudo chmod -R 775 /storage

# 4. Install dependencies and build bundle
echo "Installing Node dependencies..."
npm install

echo "Building production server and frontend bundle..."
npm run build

echo "=========================================================="
echo " Build successful!"
echo " Next steps:"
echo " 1. Copy .env.example to .env and configure your domains"
echo " 2. Copy vps-cloud-storage.service.example to /etc/systemd/system/vps-cloud-storage.service"
echo " 3. Copy nginx.conf.example to /etc/nginx/sites-available/your-domain"
echo " 4. Run certbot --nginx -d your-domain"
echo "=========================================================="
