#!/usr/bin/env bash
# FinGuard Bank Simulator - Local install (macOS/Linux)
set -e

echo "FinGuard Bank Simulator - Install"
echo "---------------------------------"

if ! command -v node &>/dev/null; then
  echo "Node.js is required. Install from https://nodejs.org"
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

if ! command -v docker &>/dev/null; then
  echo "Docker is required for Postgres. Install Docker Desktop or docker-engine."
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Installing dependencies..."
pnpm install

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "Edit .env and set DATABASE_URL, SESSION_SECRET, and optional API keys."
fi

echo "Starting Postgres with Docker Compose..."
docker compose up -d postgres

echo "Waiting for Postgres..."
sleep 3
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U finguard -d finguard 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "Running Prisma migrate..."
pnpm prisma db push

echo "Seeding database..."
pnpm db:seed

echo "Done. Run: pnpm dev"
echo "Then open http://localhost:5000 and sign in with alice@example.com / Demo123!"
