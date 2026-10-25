#!/usr/bin/env bash
# Fails if app source code contains hardcoded data, URLs, secrets, chain addresses,
# env reads outside the config module, or crypto outside packages/zk-core.
# Scans only app code; config modules, tests, generated types, prompts, seed data and docs are excluded.
# Usage: bash scripts/check-hardcoded.sh

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

PATHS=()
[ -d backend/src ] && PATHS+=(backend/src)
[ -d frontend/src ] && PATHS+=(frontend/src)
[ -d packages/zk-core/src ] && PATHS+=(packages/zk-core/src)
if [ ${#PATHS[@]} -eq 0 ]; then echo "check-hardcoded: no app folders yet, skipping"; exit 0; fi

APP_PATHS=()   # backend + frontend only (crypto must live in zk-core)
[ -d backend/src ] && APP_PATHS+=(backend/src)
[ -d frontend/src ] && APP_PATHS+=(frontend/src)

EXCLUDES=(
  --glob '!**/config.ts'
  --glob '!**/test/**' --glob '!**/tests/**' --glob '!**/*.test.*' --glob '!**/*.spec.*'
  --glob '!**/api/types.ts' --glob '!**/ai/prompts/**'
)

fail=0
scan() { # $1 label, $2 regex, rest = paths
  local label="$1" regex="$2"; shift 2
  [ $# -eq 0 ] && return
  if command -v rg >/dev/null 2>&1; then
    out=$(rg -n -i --no-heading "${EXCLUDES[@]}" -e "$regex" "$@" 2>/dev/null)
  else
    out=$(grep -rniE --exclude=config.ts --exclude-dir=test --exclude-dir=tests \
          --exclude='*.test.*' --exclude='*.spec.*' --exclude=types.ts --exclude-dir=prompts \
          "$regex" "$@" 2>/dev/null)
  fi
  if [ -n "$out" ]; then
    echo "✗ $label"; echo "$out" | sed 's/^/    /'; fail=1
  fi
}

scan "Literal URL (use config)"                    'https?://[a-z0-9.-]+'                      "${PATHS[@]}"
scan "localhost / 127.0.0.1 (use config)"          'localhost|127\.0\.0\.1'                    "${PATHS[@]}"
scan "Possible secret / API key"                   '(sk-[a-z0-9]{16,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["'"'"'][^"'"'"']{8,})' "${PATHS[@]}"
scan "Possible private key (0x + 64 hex)"          '0x[0-9a-f]{64}\b'                          "${PATHS[@]}"
scan "Hardcoded chain address (use /meta/chain)"   '["'"'"'`]0x[0-9a-f]{40}["'"'"'`]'           "${PATHS[@]}"
scan "Mock / fake / dummy data"                    '\b(mock|fake|dummy|sample)_?(data|users?|items?|response|records?|credentials?|issuers?)\b|MOCK_[A-Z_]+' "${PATHS[@]}"
scan "Lorem ipsum placeholder text"                'lorem ipsum'                               "${PATHS[@]}"
scan "Hardcoded password / passphrase"             '(password|passphrase)\s*[:=]\s*["'"'"'][^"'"'"']+["'"'"']' "${PATHS[@]}"
scan "Env read outside config module"              'process\.env|import\.meta\.env'            "${PATHS[@]}"
scan "Crypto outside packages/zk-core"             '@digitalbazaar/bbs-signatures|snarkjs|circomlibjs|crypto\.subtle' "${APP_PATHS[@]}"

if [ $fail -eq 1 ]; then
  echo; echo "check-hardcoded: FAILED. Move values to env/config, DB or seed files; crypto into zk-core (see AGENTS.md §1.1, §2)."
  exit 1
fi
echo "check-hardcoded: OK"
