#!/bin/bash
# ==============================================================================
# setup-ssl.sh — 用 Let's Encrypt 配置免费 HTTPS
# 用法: bash deploy/setup-ssl.sh your-domain.com
# ==============================================================================
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/breakout-maker"

if [ -z "$DOMAIN" ]; then
    echo "用法: bash deploy/setup-ssl.sh your-domain.com"
    echo ""
    echo "前提条件:"
    echo "  1. 域名已解析到本服务器 IP"
    echo "  2. 80 端口已开放"
    exit 1
fi

cd "$APP_DIR"

echo "🔒 配置 SSL: $DOMAIN"
echo "================================"

# 1. 确保 certbot 目录存在
mkdir -p deploy/certbot/conf deploy/certbot/www

# 2. 确保 nginx 在运行（需要它来应答 ACME challenge）
docker compose up -d nginx

# 3. 申请证书
echo "📜 申请 Let's Encrypt 证书..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@${DOMAIN} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN}

# 4. 更新 nginx 配置：启用 HTTPS
echo "📝 更新 Nginx 配置..."
NGINX_CONF="deploy/nginx.conf"

# Replace YOUR_DOMAIN
sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" "$NGINX_CONF"

# Uncomment the HTTPS server block and HTTP redirect
# Remove leading '# ' from commented blocks
sed -i '/# Redirect HTTP/,/^# }$/s/^# //' "$NGINX_CONF"
sed -i '/# server {/,/^# }$/{ /listen 443/,/^# }/s/^# //; }' "$NGINX_CONF"

# 5. 重载 nginx
echo "🔄 重载 Nginx..."
docker compose restart nginx

echo ""
echo "================================"
echo "✅ HTTPS 配置完成！"
echo "🌐 访问: https://${DOMAIN}"
echo ""
echo "证书会自动续期（certbot 容器每 12 小时检查一次）"
