# SPARSH — Progress

**Role:** Frontend · DevOps (Docker, EC2, Caddy, Bedrock access) · seed pipeline · QA · docs · pitch
**Owns:** `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, `*.env.example`
**AI tools:** Antigravity / opencode (free models). Always paste the task ID + its numbered steps from `md/VERSION-PLAN.md`; never let the agent write crypto.
**Current branch:** `sparsh/V1-S4-seed-pipeline`
**Current task:** `V1-S4` (Seed pipeline v1)

> Only SPARSH (and SPARSH's AI agent) edits this file. Append; don't rewrite history.
> Read the bottom of this file aloud at every sync.

---

## Status board

| Task ID | Task | Status | PR |
|---|---|---|---|
| V0-S0 | Scope freeze & environment templates | DONE | #8 |
| V0-S1 | Frontend scaffold | DONE | #10, #24 |
| V0-S2 | docker-compose + Dockerfiles + Caddyfile + .env.examples | DONE | #11 |
| V0-S3 | GitHub repo settings, CODEOWNERS handles | DONE | #12 |
| V0-S4 | EC2 deploy hello-world | IN PROGRESS: scripts merged (#13); live URL not up yet | #13 |
| V0-S5 | Bedrock model access + credentials | IN PROGRESS: config merged (#14, #15); `/health` still shows `ai: down` | #14 |
| V0-S6 | gen:api (openapi-typescript → src/api/types.ts) | DONE | #16 |
| V1-S1 | Issuer console (real API & Base Sepolia) | DONE | #26 |
| V1-S2 | Student Wallet (setup, inbox, credentials, backup) | DONE | #27 |
| V1-S3 | Verifier portal (verifier create, manual policy builder, polling) | DONE | #28 |
| V1-S4 | Seed pipeline v1 (seed/*.json, scripts/seed.ts, idempotent demo state) | DONE | #30 |

## Blocked on

| Since | Waiting for | From whom | Contract / task |
|---|---|---|---|
| | | | |

## Requests to others

> Changes I need in files I don't own. The owner moves them into their own status board.

| Time | To | Request | Why | Done? |
|---|---|---|---|---|
| | | | | |

## Contract change requests (to HARSH)

| Time | Endpoint / table / env var | Proposed change | Approved? |
|---|---|---|---|
| | | | |

## Log

Format: `HH:MM | TASK-ID | STARTED/DONE/BLOCKED/HANDOFF | what happened | files`

- 18:35 | V0-S0 | DONE | Froze MVP-SCOPE.md at 18:30 (Gate 0); created root .env.example matching backend config, contracts/.env.example, scripts/.env.example; verified check-hardcoded.sh OK | md/MVP-SCOPE.md, .env.example, contracts/.env.example, scripts/.env.example, docs/
- 18:50 | V0-S1 | DONE | Vite React 19 + TS + Tailwind v4 frontend scaffold; PR #10 | frontend/, pnpm-lock.yaml
- 19:25 | V0-S2 | DONE | Container infra: docker-compose.yml; backend.Dockerfile; frontend.Dockerfile; Caddyfile; PR #11 | docker-compose.yml, infra/, *.env.example
- 19:42 | V0-S3 | DONE | GitHub repo governance: .github/CODEOWNERS with @Harsh2227kumar & @Sparsh566; PR #12 | .github/CODEOWNERS
- 19:50 | V0-S4 | STARTED | EC2 deployment tooling: setup-ec2.sh, deploy.sh; PR #13 | infra/
- 20:15 | V0-S5 | STARTED | Bedrock setup notes; PR #14 | —
- 20:30 | V0-SYNC | DONE | Synced Base Sepolia registry addresses & Bedrock model id into .env.example; PR #15 | .env.example, scripts/.env.example, frontend/.env.example
- 20:45 | V0-S6 | DONE | OpenAPI type generation; PR #16 | frontend/src/api/
- 21:15 | V0-INTEGRATION | DONE | (HARSH) Merged PRs #8, #10–#16 into harsh/V0-integration and fixed review findings: frontend Docker build bakes VITE_API_BASE_URL / VITE_ZK_ARTIFACTS_BASE_URL (bundle threw on load before); gen:api script + generated-only types.ts, aliases in api/schemas.ts, client typed with paths; issuer pages show 501 until V1-H1; removed fake wallet/consent data and hardcoded chain name (ChainName from /meta/chain, steps from /meta/enums); pnpm 12.15.0 in Dockerfiles; .dockerignore; deploy.sh waits for /health; secrets blank in .env.example; removed docs/plan.md, docs/implementation.md, scripts/export-openapi.ts | frontend/, infra/, .env.example, scripts/.env.example, .dockerignore
- 00:54 | V0-S1 | DONE | Switched palette to teal/ocean/plum (#79bab6 mint, #06838d teal, #014f85 navy, #2e036b plum) across design tokens and all UI views; PR #24 | frontend/src/index.css, frontend/src/components/, frontend/src/features/
- 01:03 | V1-PLAN | DONE | Authored comprehensive V1 Master Plan and Implementation Specification for walking skeleton (V1-S1 to V1-S5) | docs/plan.md, docs/implementation.md
- 01:38 | V1-S1 | DONE | Implemented Issuer Console: admin token auth, list & register issuers, keys table with rotation, schema-driven issue form with recipient lookup, batches table with Base Sepolia anchoring; typecheck & build green; browser verified | frontend/src/api/, frontend/src/features/issuer/, frontend/src/lib/
- 02:03 | V1-S2 | DONE | Implemented Student Wallet: browser ECDH P-256 keypair via zk-core, idb-keyval store, offers inbox with BBS signature verification, credentials list with selective PII toggle, encrypted backup sync via PBKDF2/AES-GCM; typecheck & build green; browser verified | frontend/src/features/wallet/, frontend/src/lib/, frontend/src/api/
- 02:35 | V1-S3 | DONE | Implemented Verifier Portal: verifier identity registration, natural language policy compiler (with graceful fallback banner), Visual Policy Builder with selective disclosure and ZK age predicates, Request Detail inspection with 4-stage evaluation pipeline visualizer and 2s live polling; typecheck, build & check-hardcoded green | frontend/src/features/verifier/, frontend/src/api/
- 03:26 | V1-S4 | DONE | Implemented idempotent seed pipeline: seed/issuers.json (AIIMS Nagpur MBBS, IIIT Nagpur B.Tech, MMC, UIDAI), seed/holders.json (Asha, Rohan), seed/credentials.json, seed/verifiers.json, scripts/config.ts, scripts/seed.ts; verified on Base Sepolia and double-run idempotency | seed/, scripts/

## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Where does my data live?* Only in your browser, plus an encrypted backup that only your passphrase opens.
- *How is it deployed?* One EC2 with docker compose: Postgres, API, and Caddy (HTTPS + frontend). The same file runs on a laptop.
