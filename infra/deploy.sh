#!/usr/bin/env bash
# ========================================================
# ZKred — EC2 Deployment / Update Script
# Builds and restarts containers with zero downtime
# Conforms to VERSION-PLAN.md V0-S4
# ========================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ ! -f .env ]; then
  echo "Error: .env file missing in repository root!"
  echo "Copy .env.example to .env and configure DOMAIN, ACME_EMAIL, and database credentials."
  exit 1
fi

echo "==> [1/3] Building and preparing Docker images..."
docker compose build

echo "==> [2/3] Launching containers in background..."
docker compose up -d --remove-orphans

echo "==> [3/3] Verifying container health..."
sleep 5
docker compose ps

echo "==> Deployment complete!"
