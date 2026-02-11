#!/usr/bin/env bash
# Run on Ubuntu VM: install deps, build, configure systemd + Nginx
# Usage: from deploy script or manually: cd /path/to/app && bash scripts/remote-setup.sh
set -e

APP_NAME="finguard"
SERVICE_NAME="finguard-next"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "Installing dependencies..."
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm
fi
pnpm install --frozen-lockfile

echo "Building..."
pnpm build

echo "Creating systemd service..."
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=FinGuard Next.js
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=$(which node) $APP_DIR/node_modules/next/dist/bin/next start -p 5000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "Nginx reverse proxy (create if not exists)..."
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
if ! sudo test -f "$NGINX_CONF"; then
  sudo tee "$NGINX_CONF" >/dev/null <<'NGINX'
# FinGuard - upstream
upstream finguard_next {
  server 127.0.0.1:5000;
  keepalive 64;
}

server {
  listen 80;
  server_name _;
  client_max_body_size 2M;

  location / {
    proxy_pass http://finguard_next;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
NGINX
  sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$APP_NAME" 2>/dev/null || true
  echo "Enable site: sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/$APP_NAME"
  echo "Test Nginx: sudo nginx -t && sudo systemctl reload nginx"
fi

echo "remote-setup.sh done. Ensure .env exists on server with DATABASE_URL, SESSION_SECRET, etc."
