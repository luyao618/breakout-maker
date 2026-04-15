#!/bin/bash
# ==============================================================================
# deploy.sh — 首次部署脚本
# 在服务器上执行：curl -sSL <raw_url> | bash
# 或者 clone 后执行：bash deploy/deploy.sh
# ==============================================================================
set -euo pipefail

REPO="https://github.com/luyao618/breakout-maker.git"
APP_DIR="/opt/breakout-maker"
BRANCH="main"

echo "🧱 Breakout Maker — 首次部署"
echo "================================"

# --- 1. 安装 Docker (如果没有) ---
if ! command -v docker &> /dev/null; then
    echo "📦 安装 Docker (使用阿里云镜像)..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker + Compose 安装完成"
fi

# --- 2. 确认 Docker Compose plugin ---
if ! docker compose version &> /dev/null; then
    echo "📦 安装 Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose 安装完成"
fi

# --- 2.5. 配置 Docker 镜像加速 (国内服务器) ---
if [ ! -f /etc/docker/daemon.json ] || ! grep -q registry-mirrors /etc/docker/daemon.json 2>/dev/null; then
    echo "🪞 配置 Docker 镜像加速..."
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<'DAEMON'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ]
}
DAEMON
    systemctl daemon-reload
    systemctl restart docker
    echo "✅ 镜像加速配置完成"
fi

# --- 3. Clone 项目 ---
if [ -d "$APP_DIR" ]; then
    echo "⚠️  $APP_DIR 已存在，跳过 clone"
else
    echo "📥 克隆项目..."
    git clone "$REPO" "$APP_DIR"
    echo "✅ 项目克隆完成"
fi

cd "$APP_DIR"
git checkout "$BRANCH"
git pull origin "$BRANCH"

# --- 4. 配置环境变量 ---
if [ ! -f server/.env ]; then
    echo ""
    echo "⚠️  需要配置环境变量！"
    echo "   请编辑 server/.env 文件，填入你的 API Key："
    echo ""
    cp server/.env.example server/.env
    echo "   vim $APP_DIR/server/.env"
    echo ""
    echo "   填好后再次运行本脚本，或手动执行:"
    echo "   cd $APP_DIR && docker compose up -d --build"
    echo ""
    exit 0
fi

# --- 5. 构建并启动 ---
echo "🔨 构建 Docker 镜像..."
docker compose build

echo "🚀 启动服务..."
docker compose up -d

echo ""
echo "================================"
echo "✅ 部署完成！"
echo ""
echo "📊 查看状态: cd $APP_DIR && docker compose ps"
echo "📋 查看日志: cd $APP_DIR && docker compose logs -f"
echo ""

# 获取服务器公网 IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
echo "🌐 访问地址: http://${PUBLIC_IP}"
echo ""
echo "🔒 如需配置 HTTPS，参见 deploy/setup-ssl.sh"
