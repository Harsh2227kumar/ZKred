#!/usr/bin/env bash
# Runs any contracts command inside a Linux container. Needed on machines where Windows Application
# Control blocks Hardhat's native EVM binary (edr.win32-x64-msvc.node).
#   bash contracts/scripts/in-docker.sh test
#   bash contracts/scripts/in-docker.sh deploy:base-sepolia      (env passed through from contracts/.env)
# node_modules live in Docker volumes so they never clash with the Windows install.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
if command -v cygpath >/dev/null 2>&1; then repo="$(cygpath -m "$repo")"; fi
env_file="$here/.env"
env_args=()
if [ -f "$env_file" ]; then
  # MSYS_NO_PATHCONV below stops Git Bash from rewriting paths, so the Windows docker CLI needs F:/... not /f/...
  if command -v cygpath >/dev/null 2>&1; then env_file="$(cygpath -m "$env_file")"; fi
  env_args=(--env-file "$env_file")
fi

MSYS_NO_PATHCONV=1 docker run --rm -i \
  -v "$repo:/repo" \
  -v zkred_nm_root:/repo/node_modules \
  -v zkred_nm_contracts:/repo/contracts/node_modules \
  -v zkred_pnpm_store:/pnpm-store \
  -w /repo \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  "${env_args[@]}" \
  node:22-bookworm-slim \
  sh -c "corepack enable && pnpm config set store-dir /pnpm-store >/dev/null && pnpm install --frozen-lockfile --filter contracts >/dev/null && pnpm --filter contracts $*"
