# HARSH — Progress

**Role:** Lead · backend API + DB · crypto core (zk-core) · smart contracts · ZK circuit · Bedrock AI · contract owner · merges PRs
**Owns:** `backend/`, `packages/zk-core/`, `contracts/`, `circuits/`, `md/CONTRACTS.md`, root workspace files
**AI tools:** Claude Code (Pro; budget it for crypto/engine work) + free tools for boilerplate
**Current branch:** `harsh/V0-H2-backend-scaffold`
**Current task:** `V0-H2`

> Only HARSH (and HARSH's AI agent) edits this file. Append; don't rewrite history.
> Read the bottom of this file aloud at every sync.

---

## Status board

| Task ID | Task | Status | PR |
|---|---|---|---|
| V0-H1 | Freeze CONTRACTS.md | TODO | |
| V0-H2 | Monorepo + backend scaffold + migration + meta endpoints | DONE | |
| V0-H3 | Contracts + tests + Base Sepolia deploy | TODO | |
| V0-H4 | age_gte circuit + committed artifacts | TODO | |
| V0-H5 | zk-core skeleton + BBS spike + walletCrypto | TODO (layouts.ts already done in V0-H2) | |

## Blocked on

| Since | Waiting for | From whom | Contract / task |
|---|---|---|---|
| | | | |

## Requests to others

> Changes I need in files I don't own. The owner moves them into their own status board.

| Time | To | Request | Why | Done? |
|---|---|---|---|---|
| 16:06 | SPARSH | In V0-S2, the backend container must run `pnpm --filter backend db:migrate` before `start`; build context = repo root (backend imports `@zkred/zk-core` from source) | backend runs TS via tsx | |
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

## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Why BBS+ and not just a SNARK?* BBS+ gives cheap, unlinkable selective disclosure of signed fields; we use a SNARK only where we need a predicate (age ≥ 21) on a hidden value, bound to the signature through a signed Poseidon commitment.
- *How do you isolate forged degrees without revoking everyone?* Issuance time comes from the on-chain batch anchor (block time, which can't be backdated). After `markCompromised(key, now − 48h)`, only credentials in batches anchored before the cutoff stay valid; honest in-window holders refresh via re-issue, which checks the registrar's own records, so forgeries can't be laundered.
- *Does revocation leak who was revoked?* No. Verifiers download the whole 16k-entry bitstring, and only its hash is on-chain.
- *What still links presentations?* In V1 the batch commitment + status index are revealed (k-anonymity within a batch). V2 replaces this with ZK Merkle membership + ZK non-revocation.
