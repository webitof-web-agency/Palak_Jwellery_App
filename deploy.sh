#!/bin/bash

echo "🚀 Deploy started"

cd /www/wwwroot/Palak_JewelleryBackend || exit 1

echo "📥 Fetching latest code..."
git fetch origin || exit 1

echo "🔄 Resetting to origin/main..."
git reset --hard origin/main || exit 1

echo "📦 Installing dependencies..."
npm install || exit 1

echo "♻ Reloading PM2..."
pm2 reload jewellery_backend || exit 1

echo "✅ Deploy successful"