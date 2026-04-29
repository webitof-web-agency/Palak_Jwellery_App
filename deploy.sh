#!/bin/bash

echo "🚀 Deploy started"

cd /www/wwwroot/Palak_JewelleryBackend || exit 1

echo "📥 Fetching latest code..."
git fetch origin || exit 1

echo "🔄 Resetting to origin/main..."
git reset --hard origin/main || exit 1

echo "📦 Installing dependencies..."
cd backend || exit 1
npm install || exit 1

echo "♻ Reloading PM2..."
pm2 reload jewellery_backend || pm2 start server.js --name jewellery_backend

echo "✅ Deploy successful"