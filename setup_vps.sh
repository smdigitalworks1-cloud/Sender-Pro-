#!/bin/bash
echo "======================================"
echo " Sender Pro VPS Setup Script"
echo "======================================"

cd /var/www/sender-pro

# Step 0: Install dependencies on the VPS
echo "📦 Step 0: Installing backend dependencies..."
cd backend
npm install --production --silent
cd ..

# Step 1: Install missing Chromium libraries
echo ""
echo "📦 Step 1: Installing Chromium dependencies..."
apt-get update && apt-get install -y \
  libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2t64 \
  libpangocairo-1.0-0 libcairo2 libatspi2.0-0t64 \
  libgtk-3-0t64 libnss3 libx11-xcb1 libxcb-dri3-0 \
  2>/dev/null
echo "✅ Chromium dependencies installed!"

# Step 2: Clear stale WhatsApp sessions
echo ""
echo "🧹 Step 2: Clearing stale WhatsApp sessions..."
rm -rf /var/www/sender-pro/backend/.wwebjs_auth
rm -rf /var/www/sender-pro/backend/.wwebjs_cache
echo "✅ Sessions cleared!"

# Step 3: PM2 setup/restart
echo ""
echo "🔄 Step 3: Managing PM2 process..."
cd backend
if pm2 list | grep -q "sender-pro"; then
  pm2 restart sender-pro --update-env
else
  pm2 start server.js --name sender-pro
fi
echo "✅ PM2 process ready!"

# Step 4: Wait for server to start
echo ""
echo "⏳ Waiting 6 seconds for server to start..."
sleep 6

# Step 5: Check Nginx
echo ""
echo "🌐 Step 5: Checking Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "======================================"
echo " ✅ Setup Complete!"
echo " Live at: http://senderpro.smdigitalworks.com"
echo "======================================"
