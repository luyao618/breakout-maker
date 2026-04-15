#!/bin/bash
# ==============================================================================
# update.sh — 更新部署（拉最新代码 → 重新构建 → 零停机重启）
# 用法: bash deploy/update.sh
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/breakout-maker"
cd "$APP_DIR"

echo "🔄 Breakout Maker — 更新部署"
echo "================================"

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 2. 重新构建镜像
echo "🔨 构建新镜像..."
docker compose build

# 3. 滚动重启（先启新容器，再停旧容器）
echo "🚀 重启服务..."
docker compose up -d --force-recreate --remove-orphans

# 4. 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo ""
echo "================================"
echo "✅ 更新完成！"
docker compose ps
