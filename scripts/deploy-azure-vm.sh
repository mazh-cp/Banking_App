#!/usr/bin/env bash
# FinGuard Bank Simulator - Deploy to Azure Ubuntu VM
# Usage: ./scripts/deploy-azure-vm.sh <vm-user>@<vm-ip-or-hostname>
# Example: ./scripts/deploy-azure-vm.sh azureuser@20.123.45.67
# Prerequisites: VM has Node 20+, pnpm, Docker, Nginx installed (see below).
set -e

TARGET="${1:?Usage: $0 user@host}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="finguard"
SERVICE_NAME="finguard-next"

echo "Deploying FinGuard to $TARGET"

# Build locally and upload (or build on server)
echo "Syncing project (excluding node_modules, .next)..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  "$ROOT/" "$TARGET:~/finguard-deploy/"

echo "Running remote setup..."
ssh "$TARGET" "cd ~/finguard-deploy && bash scripts/remote-setup.sh"

echo "Deploy complete. Restarting service..."
ssh "$TARGET" "sudo systemctl restart $SERVICE_NAME || true"

echo "Done. Ensure Nginx is configured and .env is set on the server."
