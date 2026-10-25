# HARSH — Progress

**Role:** Lead · backend API + DB · crypto core (zk-core) · smart contracts · ZK circuit · Bedrock AI · contract owner · merges PRs
**Owns:** `backend/`, `packages/zk-core/`, `contracts/`, `circuits/`, `md/CONTRACTS.md`, root workspace files
**AI tools:** Claude Code (Pro; budget it for crypto/engine work) + free tools for boilerplate
**Current branch:** `harsh/V0-H5-zk-core`
**Current task:** `V0-H5`

> Only HARSH (and HARSH's AI agent) edits this file. Append; don't rewrite history.
> Read the bottom of this file aloud at every sync.

---

## Status board

| Task ID | Task | Status | PR |
|---|---|---|---|
| V0-H1 | Freeze CONTRACTS.md | TODO | |
| V0-H2 | Monorepo + backend scaffold + migration + meta endpoints | DONE | |
| V0-H3 | Contracts + tests + Base Sepolia deploy | DONE (code + tests + deploy script); Base Sepolia deploy waits for a funded DEPLOYER_PRIVATE_KEY | |
| V0-H4 | age_gte circuit + committed artifacts | DONE | |
| V0-H5 | zk-core skeleton + BBS spike + walletCrypto | DONE (+ age proof wired to the V0-H4 circuit) | |

## Blocked on

| Since | Waiting for | From whom | Contract / task |
|---|---|---|---|
| | | | |

## Requests to others

> Changes I need in files I don't own. The owner moves them into their own status board.

| Time | To | Request | Why | Done? |
|---|---|---|---|---|
| 16:06 | SPARSH | In V0-S2, the backend container must run `pnpm --filter backend db:migrate` before `start`; build context = repo root (backend imports `@zkred/zk-core` from source) | backend runs TS via tsx | |
| 16:40 | SPARSH | Create `contracts/.env.example` with `DEPLOYER_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`, `BASESCAN_API_KEY` (CONTRACTS §6). If your laptop also blocks native `.node` files, use `bash contracts/scripts/in-docker.sh test` | needed for deploy | done by HARSH (V0-H3 hardening, on request) |
| 16:06 | SPARSH | `.env.example` additions beyond CONTRACTS §6 are optional: `LOG_LEVEL`, `AI_HEALTH_TTL_MS`, `HEALTH_CHECK_TIMEOUT_MS` | new optional config knobs | |

## Contract change requests

| Time | Endpoint / table / env var | Proposed change | Approved? |
|---|---|---|---|
| | | | |

## Log

Format: `HH:MM | TASK-ID | STARTED/DONE/BLOCKED/HANDOFF | what happened | files`

- Pre-H0 | PLAN | DONE | Toolchain checked: Node 24.15, pnpm 12.15 (corepack), git 2.54; circom + Rust NOT installed (need the prebuilt circom binary for V0-H4) | —
- Pre-H0 | PLAN | DONE | Hackathon kit adapted to ZKred (md/*, AGENTS/CLAUDE/GEMINI, .github, check-hardcoded) | md/, root docs
- 16:06 | V0-H2 | DONE | pnpm monorepo root; backend Express 5 + Zod 4 config (fail-fast) + standard errors + /health (db/chain/Bedrock, AI probe cached) + /meta/enums|chain|credential-schemas + /openapi.json; Drizzle schema (14 tables) + migration 0000 applied on Postgres 16; 7 backend + 5 zk-core tests green. New folders: backend/drizzle, packages/zk-core (layouts only). Contract: CredentialSchema.fields[].source added (additive) | files: package.json, pnpm-workspace.yaml, tsconfig.base.json, backend/**, packages/zk-core/**, md/CONTRACTS.md
- 16:40 | V0-H3 | DONE | IssuerRegistry (accreditor + governance, key epochs, markCompromised cutoff only moves earlier, compromised key stays compromised on rotate), AnchorRegistry (governance-only, active key only, block time = issuance time), StatusRegistry (list bound to first issuer); 10 Hardhat tests incl. breach scenario; deploy script writes deployments/<network>.json + exports ABIs to backend/src/integrations/abi. Windows Application Control blocks Hardhat's native EDR binary on this laptop → all hardhat commands run via `bash contracts/scripts/in-docker.sh <script>`. pnpm-workspace: allowBuilds esbuild | files: contracts/**, backend/src/integrations/abi/*, pnpm-workspace.yaml, .gitignore
- 17:06 | V0-H4 | DONE | circuits/age_gte.circom: Poseidon(dob_days,salt)==dob_commitment ∧ dob_days ≤ cutoff_days (16-bit range checks), 573 constraints; public signals [dob_commitment, cutoff_days] (exact calendar cutoff, contract changelog updated); build.sh = circom2 (WASM, no native binary) + local 2^10 ptau + Groth16 phase-2 → committed build/{age_gte.wasm, age_gte.zkey, vkey.json}; 6 snarkjs roundtrip/negative tests green. New workspace `circuits` (AGENTS §7 updated). Note: circom2 compile takes minutes on Windows | files: circuits/**, pnpm-workspace.yaml, md/CONTRACTS.md, md/FEATURES.md, AGENTS.md
- 17:21 | V0-H5 | DONE | zk-core: BBS (@digitalbazaar/bbs-signatures, BLS12-381-SHA-256) keygen/sign/verify/deriveDisclosure/verifyDisclosure (nonce = presentation header, meta 0–6 always disclosed, fail closed); policy Zod (PresentationPolicy/Presentation + layout/never_collect refinements); walletCrypto (ECDH-ES P-256+HKDF+AES-GCM offers, PBKDF2+AES-GCM backups); age proof on the committed V0-H4 artifacts (dobCommitment via poseidon-lite = circomlib Poseidon, proveAgeGte/verifyAgeGte, dateToDays, ageCutoffDays with Feb-29 clamp, randomDobSalt); Merkle/statusList/buildPresentation throw NOT_IMPLEMENTED (V1.1). Merged V0-H4 into this branch. 33 zk-core tests green; Vite bundle runs in Chrome (age proof 0.3 s). New folder: packages/zk-core/src/types | files: packages/zk-core/**, md/CONTRACTS.md, pnpm-lock.yaml
- 17:59 | V0-review | DONE | Review of V0-H2..H5. SECURITY: verifyAgeGte accepted non-canonical public signals (negative / ≥ r / leading zeros); snarkjs reduces them mod r, so a minor could pass age_gte with cutoff_days = own_dob − r. Now canonical field elements only (+ Presentation schema: exactly 2 canonical decimals). Backend: chainHealth never detected a wrong-chain RPC (staticNetwork makes getNetwork echo config) → eth_chainId; pg pool error handler (idle disconnect crashed process); trust proxy 1 not true (X-Forwarded-For spoofing); AI health probe deduped in flight; graceful shutdown closes keep-alive sockets; logger moved to src/logger.ts. DB migration 0001: FKs key_id/batch_id/status_list_id/reissued_from, unique (status_list_id,status_index), FK indexes; applied on Postgres 16. Single-source ISSUER_KINDS/PREDICATE_TYPES from zk-core. Removed stale PENDING.md. 35 zk-core + 9 backend + 6 circuit + 10 contract tests green | files: packages/zk-core/src/{age,policy}.ts, backend/src/**, backend/drizzle/0001_*, circuits/test/age-gte.test.ts, md/CONTRACTS.md
- 18:45 | V0-H3 | DONE | Deploy hardening: contracts/.env.example (SPARSH-owned file, created on HARSH's request; SPARSH please review) + explicit contracts/.env gitignore; circuits script renamed build → setup:keys and refuses to overwrite committed zkey/vkey without --force (a root `pnpm build` used to silently regenerate keys); chainHealth also requires deployed code at all 3 registry addresses (raw eth_getCode, uncached). Base Sepolia deploy itself still pending (needs funded deployer key) | files: contracts/.env.example, .gitignore, circuits/{build.sh,package.json}, backend/src/integrations/chain.ts, backend/test/integrations/chain.test.ts
- 19:50 | V0-H3 | DONE | Deployed to Base Sepolia (84532): IssuerRegistry 0x7AD1dc8a22923df3a7997AC002cfb4b32Ad6AEa8, AnchorRegistry 0x12DA5d65d4C7d46d900D7512C4096503fCD29Cfd, StatusRegistry 0xeee916756f6a810034af451FC80f77aD00d8a0c0; accreditor 0xDB4C3575071fBD57c360445Fae5a61127f61F2aD; all receipts status 1, both registries wired to IssuerRegistry; backend /health db ok + chain ok against them. in-docker.sh: --env-file path converted for the Windows docker CLI. Addresses sent to SPARSH | files: contracts/deployments/baseSepolia.json, contracts/scripts/in-docker.sh

## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Why BBS+ and not just a SNARK?* BBS+ gives cheap, unlinkable selective disclosure of signed fields; we use a SNARK only where we need a predicate (age ≥ 21) on a hidden value, bound to the signature through a signed Poseidon commitment.
- *How do you isolate forged degrees without revoking everyone?* Issuance time comes from the on-chain batch anchor (block time, which can't be backdated). After `markCompromised(key, now − 48h)`, only credentials in batches anchored before the cutoff stay valid; honest in-window holders refresh via re-issue, which checks the registrar's own records, so forgeries can't be laundered.
- *Does revocation leak who was revoked?* No. Verifiers download the whole 16k-entry bitstring, and only its hash is on-chain.
- *What still links presentations?* In V1 the batch commitment + status index are revealed (k-anonymity within a batch). V2 replaces this with ZK Merkle membership + ZK non-revocation.
