#!/usr/bin/env bash
# deploy.sh — One-shot Vultr VPS setup for VideoIQ
# Run as root or a user with sudo.
# Usage: bash deploy.sh yourdomain.com admin@yourdomain.com
set -euo pipefail

DOMAIN="${1:-yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/6] Installing Docker & Docker Compose..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi
if ! command -v docker compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
    apt-get install -y docker-compose-plugin
fi
docker --version
docker compose version

echo "==> [2/6] Installing Nginx & Certbot..."
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx ufw

echo "==> [3/6] Configuring firewall..."
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "==> [4/6] Setting up Nginx vhost..."
NGINX_CONF="/etc/nginx/sites-available/videoiq"
sed "s/yourdomain.com/$DOMAIN/g" "$APP_DIR/nginx-host.conf" > "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/videoiq
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> [5/6] Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" \
    --redirect
systemctl reload nginx

echo "==> [6/6] Building and starting Docker services..."
cd "$APP_DIR"
if [ ! -f .env ]; then
    echo "ERROR: .env file not found in $APP_DIR"
    echo "       Copy .env.example to .env and fill in your values first."
    exit 1
fi
docker compose pull mongo 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

echo ""
echo "======================================================"
echo "  VideoIQ is live at https://$DOMAIN"
echo "  Admin login: check ADMIN_EMAIL / ADMIN_PASSWORD in .env"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f backend    # backend logs"
echo "    docker compose restart backend    # restart after .env change"
echo "    docker compose down && docker compose up -d  # full restart"
echo "======================================================"
