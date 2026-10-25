# PowerShell twin of in-docker.sh: runs any contracts command inside a Linux container (Windows Application Control
# blocks Hardhat's native EVM binary on some laptops, and `bash` in PowerShell may resolve to WSL with no distro).
#   pwsh contracts/scripts/in-docker.ps1 test
#   pwsh contracts/scripts/in-docker.ps1 deploy:base-sepolia      (env passed through from contracts/.env)
# node_modules live in Docker volumes so they never clash with the Windows install.
$ErrorActionPreference = 'Stop'
$contracts = Split-Path -Parent $PSScriptRoot
$repo = (Split-Path -Parent $contracts) -replace '\\', '/'
$envFile = Join-Path $contracts '.env'
$envArgs = @()
if (Test-Path $envFile) { $envArgs = @('--env-file', ($envFile -replace '\\', '/')) }

docker run --rm -i `
  -v "${repo}:/repo" `
  -v zkred_nm_root:/repo/node_modules `
  -v zkred_nm_contracts:/repo/contracts/node_modules `
  -v zkred_pnpm_store:/pnpm-store `
  -w /repo `
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 `
  @envArgs `
  node:22-bookworm-slim `
  sh -c "corepack enable && pnpm config set store-dir /pnpm-store >/dev/null && pnpm install --frozen-lockfile --filter contracts >/dev/null && pnpm --filter contracts $($args -join ' ')"
exit $LASTEXITCODE
