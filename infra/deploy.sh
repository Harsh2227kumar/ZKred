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

echo "==> [3/3] Waiting for the API health check..."
health=""
for _ in $(seq 1 30); do
  health=$(docker compose exec -T backend wget -qO- "http://localhost:8080/api/v1/health" 2>/dev/null || true)
  [ -n "$health" ] && break
  sleep 2
done
docker compose ps

if [ -z "$health" ]; then
  echo "Error: backend did not answer /api/v1/health. Check: docker compose logs backend"
  exit 1
fi
echo "Health: $health"
echo "==> Deployment complete!"
