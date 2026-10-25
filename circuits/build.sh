#!/usr/bin/env bash
# Builds the age_gte circuit and its Groth16 keys.
#   pnpm --filter circuits setup:keys -- --force
# Deliberately not named "build", so a recursive `pnpm build` (Dockerfile, CI) never regenerates the keys.
# Refuses to run while committed artifacts exist unless --force is given.
# Outputs (COMMITTED, so nobody else needs circom): build/age_gte.wasm, build/age_gte.zkey, build/vkey.json
# Intermediates go to tmp/ (gitignored).
#
# Trusted setup: a local, single-contributor Powers of Tau + phase-2 with fresh random entropy.
# Fine for a hackathon demo; production needs a multi-party ceremony (VERSIONS.md V2).
# Rebuilding produces NEW keys: every proof generated with the old zkey stops verifying.
# The circom2 (WASM) compile step is slow on Windows (several minutes); later steps take seconds.
set -euo pipefail
cd "$(dirname "$0")"

CIRCUIT=age_gte
PTAU_POWER=10            # 2^10 = 1024 ≥ constraint count (~573)
TMP=tmp
OUT=build
if [ "${1:-}" != "--force" ] && { [ -e "$OUT/$CIRCUIT.zkey" ] || [ -e "$OUT/vkey.json" ]; }; then
  echo "✗ $OUT/ already has committed keys; regenerating invalidates every existing age proof." >&2
  echo "  Re-run with --force only if you really mean to replace them." >&2
  exit 1
fi
mkdir -p "$TMP" "$OUT"

entropy() { node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"; }
snarkjs() { npx --no-install snarkjs "$@"; }

echo "▸ compile"
npx --no-install circom2 "$CIRCUIT.circom" --r1cs --wasm --sym -l node_modules -o "$TMP"
snarkjs r1cs info "$TMP/$CIRCUIT.r1cs"

echo "▸ powers of tau (phase 1)"
snarkjs powersoftau new bn128 "$PTAU_POWER" "$TMP/pot_0000.ptau"
snarkjs powersoftau contribute "$TMP/pot_0000.ptau" "$TMP/pot_0001.ptau" --name="zkred-1" -e="$(entropy)"
snarkjs powersoftau prepare phase2 "$TMP/pot_0001.ptau" "$TMP/pot_final.ptau"

echo "▸ groth16 setup (phase 2)"
snarkjs groth16 setup "$TMP/$CIRCUIT.r1cs" "$TMP/pot_final.ptau" "$TMP/${CIRCUIT}_0000.zkey"
snarkjs zkey contribute "$TMP/${CIRCUIT}_0000.zkey" "$OUT/$CIRCUIT.zkey" --name="zkred-phase2" -e="$(entropy)"
snarkjs zkey verify "$TMP/$CIRCUIT.r1cs" "$TMP/pot_final.ptau" "$OUT/$CIRCUIT.zkey"
snarkjs zkey export verificationkey "$OUT/$CIRCUIT.zkey" "$OUT/vkey.json"

cp "$TMP/${CIRCUIT}_js/$CIRCUIT.wasm" "$OUT/$CIRCUIT.wasm"

echo "▸ done"
ls -l "$OUT"
