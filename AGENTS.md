# AGENTS.md — Rules for every AI coding agent in this repo (ZKred)

> The source of truth for ALL AI tools (Claude Code, Antigravity, opencode, Cursor, Copilot, Codex, Gemini).
> `CLAUDE.md`, `GEMINI.md` and `.agent/rules/*` point here. If anything conflicts, **this file wins**.
> Humans: read this once. Agents: obey it on every prompt.

**Project:** ZKred: user-controlled, zero-knowledge portable credentials (CASCADE '26 · Theme 4 · Problem 3).
**Team (2):** HARSH (lead) · SPARSH.

---

## 0. Read before you write

Before changing any code, read these in order:

1. `md/MVP-SCOPE.md`: what we are building and what we are NOT building
2. `md/CONTRACTS.md`: API shapes, DB schema, zk-core + Solidity interfaces, env vars (frozen)
3. `md/FLOWS.md`: the flow you are implementing
4. `md/VERSION-PLAN.md`: find **your owner's** current task ID and follow its steps
5. `md/progress/<OWNER>-PROGRESS.md`: what was already done

If the task is not in `md/VERSION-PLAN.md`, stop and ask the human.

---

## 1. Team and folder ownership (the law)

| Owner | Role | Owns (may edit) |
|---|---|---|
| **HARSH** | Lead; backend API + DB; crypto core; smart contracts; ZK circuit; Bedrock AI; contract owner; merges PRs | `backend/` (all of it), `packages/zk-core/`, `contracts/`, `circuits/`, `md/CONTRACTS.md`, root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| **SPARSH** | Frontend; DevOps/EC2/Docker; seed pipeline; QA; docs; pitch | `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, all `.env.example` files |

Rules:

- **Edit only files inside your owner's folders.** The human tells you who the owner is at the start of the session ("I am SPARSH").
- Need a change in someone else's folder? **Do not make it.** Write it under "Requests to others" in your progress file and tell the human.
- Shared files have exactly one owner:

| Shared file | Owner |
|---|---|
| `md/CONTRACTS.md`, `backend/src/schemas/` (Zod contracts), `packages/zk-core/src/policy.ts`, `packages/zk-core/src/layouts.ts` | HARSH |
| `frontend/src/api/types.ts` (generated from OpenAPI, never hand-edited) | SPARSH runs the generator |
| `backend/package.json`, `packages/zk-core/package.json`, `contracts/package.json`, root `package.json` | HARSH (others request deps) |
| `frontend/package.json` | SPARSH |
| `.env.example` files | SPARSH (others request keys) |
| `md/MVP-SCOPE.md`, `md/VERSIONS.md`, `md/VERSION-PLAN.md`, `md/FLOWS.md`, `md/FEATURES.md` | Frozen. Team decision only |
| `circuits/build/*` (committed ZK artifacts) | HARSH; never regenerate unless asked |

### 1.1 Crypto safety rule (both owners)

Cryptography lives **only** in `packages/zk-core/`, `circuits/` and `contracts/`. Frontend and backend code **call** zk-core functions; they never import `@digitalbazaar/bbs-signatures`, `snarkjs`, `circomlibjs` or `crypto.subtle` directly, and never invent their own hashing, encryption or signing. If an agent (especially a free model) thinks crypto must change, it **stops and asks HARSH**.

One narrow exception: the backend may use `node:crypto` for **operational** security only: random tokens, SHA-256 of wallet/admin tokens, and AES-GCM encryption of issuer secrets at rest (`KEY_ENCRYPTION_SECRET`, `GOVERNANCE_KEY_ENCRYPTION_SECRET`). Anything that touches credentials, proofs, signatures or holder data goes through zk-core.

---

## 2. ZERO hardcoded data (non-negotiable)

No data or configuration may be written as literals in source code. Everything comes from one of:

| Kind of value | Where it MUST come from |
|---|---|
| Secrets, private keys, tokens, DB URL, RPC URL, contract addresses, chain id, model id, region, ports, origins | Environment variables, read through ONE config module: `backend/src/config.ts`, `frontend/src/config.ts`, `contracts/hardhat.config.ts`, `scripts/config.ts` |
| Backend base URL in the frontend | `import.meta.env.VITE_API_BASE_URL` via `frontend/src/config.ts` only |
| Contract addresses / explorer URLs in the frontend | `GET /meta/chain` |
| Business data (issuers, keys, batches, wallets, requests, verifications) | The database, via the API |
| Dropdown options, credential types, issuer kinds, statuses shown in the UI | `GET /meta/enums` / `GET /meta/credential-schemas`, never a hardcoded JS array |
| Limits (TTL, list size, batch size, breach window, timeouts) | Env vars with typed defaults declared in the config module only |
| AI prompts | Files under `backend/src/ai/prompts/*.md` (loaded at runtime) |
| Demo/seed data | `seed/*.json` loaded by `scripts/seed.ts` **through the real API**, never literals in app code |

Forbidden in app code (`backend/src/`, `frontend/src/`, `packages/zk-core/src/`):

- `const users = [{...}]`, `MOCK_*`, `dummyData`, `sampleResponse`, `fake*`, lorem ipsum
- `if (!data) return FAKE_DATA` style fallbacks: show a real empty/error state instead
- Literal URLs (`http://localhost:8080`, `https://...`) outside the config module
- Literal keys/tokens/passwords/private keys anywhere (including tests and comments)
- Returning hardcoded values from an endpoint "for now". If the logic isn't ready, return `501 Not Implemented` with the standard error shape
- A verification that "passes" when the chain or a proof can't be checked. **Fail closed.**

Allowed:

- Type definitions and enums **that mirror** the DB/contract (e.g. `CREDENTIAL_LAYOUTS` in zk-core mirrors CONTRACTS §4.1)
- Test fixtures under `test/` (§8.2) that build data through factories
- UI copy (labels, button text) inside components
- Cryptographic constants defined by a spec (curve ids, ciphersuite names) inside zk-core

Exception, by design: **holder PII lives only in the holder's browser (IndexedDB) and as client-side-encrypted backups**. Never add a table, log line or endpoint that stores or prints plaintext holder claims.

Before every commit, run `bash scripts/check-hardcoded.sh`. It must pass.

---

## 3. Contracts are frozen

- API request/response shapes, DB schema, zk-core exports, Solidity interfaces and env var names live in `md/CONTRACTS.md`, `backend/src/schemas/` and `packages/zk-core/src/{policy,layouts}.ts`.
- Never rename, remove or change the type of a contract field. Only HARSH changes contracts, and he announces each change in the team chat + the `md/CONTRACTS.md` changelog.
- Frontend API types are generated from the backend OpenAPI spec (`pnpm --filter frontend gen:api`). Never hand-write API types.
- Every API error uses the standard shape in `md/CONTRACTS.md` §2.
- BBS message indices (CONTRACTS §4.1 table) are frozen forever. Changing them invalidates every issued credential.

---

## 4. How to work (per prompt)

1. Confirm the owner and the task ID (e.g. `V1-S2`) from `md/VERSION-PLAN.md`.
2. Make the **smallest change** that completes one step. One feature per file.
3. Do not reformat, rename or "clean up" code you were not asked to touch.
4. Do not add dependencies outside your own `package.json`. If one is needed elsewhere, stop and say so (the owner adds it).
5. Do not create new top-level folders (§8). Create new tool config files (tsconfig, vite, drizzle, hardhat…) only when your task ID says so.
6. No placeholder `TODO: implement` code paths that silently succeed. Unfinished = an explicit `501` or a thrown error.
7. After the change: list the files changed. If any file is outside the owner's folders, revert it.
8. Update the owner's progress file (append a log line; see §6).

---

## 5. Git rules for agents

- Never commit to or push `main`. Work on the owner's branch: `<owner>/<task-id>-<short-name>`, e.g. `sparsh/V1-S2-wallet-inbox`.
- Never force-push, never `git reset --hard` on shared branches, never merge PRs.
- Commit after every working step: `feat(frontend): V1-S2 wallet inbox claims offers`.
- Before pushing: `git status`, `git diff --stat`, run checks, run `scripts/check-hardcoded.sh`.
- Never commit `.env` files, private keys or wallet tokens.
- If unsure what to commit or where, ask the human.

---

## 6. Progress logging

Each owner has `md/progress/<OWNER>-PROGRESS.md`. Agents append to **their owner's file only**:

```
- HH:MM | V1-S2 | DONE | Wallet inbox decrypts + claims offers; shows real errors | files: frontend/src/features/wallet/pages/WalletInboxPage.tsx
```

Status values: `STARTED`, `DONE`, `BLOCKED`, `HANDOFF`. Never edit the other member's progress file.

---

## 7. Stack conventions (use only these)

- **Monorepo:** pnpm workspaces. Package names (use these with `pnpm --filter`): `backend`, `frontend`, `contracts`, `scripts`, and `@zkred/zk-core` (scoped because other packages import it). `circuits/` is built by a shell script, not a workspace.
- **Language:** TypeScript everywhere (strict). Node 22+ (local machines run Node 24).
- **Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query + React Router + `openapi-fetch`; IndexedDB via `idb-keyval`; toasts via `sonner`
- **Backend:** Express + Zod + `@asteasolutions/zod-to-openapi` + Drizzle ORM (`drizzle-kit` migrations) + `ethers` v6 + `pino` logging
- **Database:** Postgres 16 (docker compose locally and on EC2)
- **Crypto:** `@digitalbazaar/bbs-signatures` (wrapped in `zk-core/src/bbs.ts`), Circom 2 + `snarkjs` (Groth16), `circomlibjs` (Poseidon), WebCrypto (ECDH P-256, AES-GCM, PBKDF2)
- **Chain:** Solidity ^0.8.24 + Hardhat; Base Sepolia (chain id 84532); local Hardhat (31337) as the fallback
- **AI provider:** Claude Sonnet on AWS Bedrock via `@anthropic-ai/bedrock-sdk` (`AnthropicBedrockMantle`); model id + region from env; called from the **backend only**, never from the browser
- **Deploy:** one AWS EC2 + `docker compose` (Caddy: HTTPS + static frontend + `/api` reverse proxy)
- **Naming:** files `kebab-case` (`wallet-store.ts`, `issuers.routes.ts`, `verifier.ts`); React component files `PascalCase.tsx` (`WalletInbox.tsx`); TS identifiers `camelCase`, types/components `PascalCase`; DB tables plural `snake_case`; API paths `/kebab-case`; JSON keys `snake_case`; Solidity `PascalCase.sol` contracts / `camelCase` functions; Circom `snake_case.circom`
- **Tests:** `vitest` (backend, zk-core), Hardhat + chai (contracts); tests live in a separate `test/` folder that mirrors `src/` (`backend/test/core/verifier.test.ts`); never `*.test.ts` inside `src/`

---

## 8. Project structure

Two tiers:

- **Fixed skeleton:** the top-level folders and a few anchor files below. Don't rename, move or add top-level folders.
- **Flexible zone:** everything inside the skeleton. Create whatever files and subfolders the task needs, following §8.2–§8.4.

### 8.1 Fixed skeleton

```text
ZKred/
├─ package.json · pnpm-workspace.yaml · tsconfig.base.json     HARSH
├─ docker-compose.yml · .env.example                           SPARSH
├─ backend/                     HARSH
│  └─ src/
│     ├─ main.ts · app.ts       entry point + express app
│     ├─ config.ts              ⚓ the ONLY place that reads process.env
│     ├─ api/                   HTTP layer (routes, middleware)
│     ├─ schemas/               ⚓ Zod contract schemas (mirror md/CONTRACTS.md)
│     ├─ db/                    database layer (schema, client, repositories)
│     ├─ core/                  business logic
│     ├─ ai/                    Bedrock + prompts/*.md
│     └─ integrations/          chain (ethers) and other external services
├─ packages/zk-core/            HARSH   @zkred/zk-core: all crypto
│  └─ src/index.ts              ⚓ the public API (CONTRACTS §4.1); everything else is internal
├─ contracts/                   HARSH   Hardhat project (src/*.sol, test/, scripts/)
├─ circuits/                    HARSH   *.circom + build/ (⚓ committed wasm/zkey/vkey)
├─ frontend/                    SPARSH
│  └─ src/
│     ├─ config.ts              ⚓ the ONLY place that reads import.meta.env
│     ├─ api/                   ⚓ client.ts + types.ts (GENERATED) + data hooks
│     ├─ components/            shared UI (shadcn in components/ui, generated)
│     ├─ features/              one folder per area: issuer/ · wallet/ · verifier/ · attack/
│     └─ lib/                   browser-side helpers (IndexedDB wallet store, zk-core loader)
├─ infra/                       SPARSH  Dockerfiles, Caddyfile, EC2 setup
├─ scripts/                     SPARSH  seed + tooling (⚓ check-hardcoded.sh)
├─ seed/                        SPARSH  demo data JSON only
├─ docs/                        SPARSH
├─ md/                          planning docs + progress/
└─ AGENTS.md · CLAUDE.md · GEMINI.md · .agent/ · .github/ · README.md · CONTRIBUTING.md
```

⚓ = anchor: it must exist exactly here with this role. Everything not marked ⚓ inside a folder is up to the developer/AI.

### 8.2 Adding files and folders (flexible zone)

- Put new code in the folder whose role matches it (table above). If nothing fits, **ask**; don't invent a new top-level folder.
- Subfolders are allowed when a folder gets crowded (> ~8 files) or a feature needs grouping (e.g. `core/verifier/`, `features/wallet/components/`).
- Tests go in a `test/` folder beside `src/`, mirroring its paths; never `*.test.ts` inside `src/`.
- Name files by what they do. No `utils.ts` / `helpers.ts` / `misc.ts` dumping grounds.
- Naming: files `kebab-case.ts`; React component files `PascalCase.tsx`; route-level page components end in `Page.tsx`.
- After creating a new folder, mention it in your progress-log line so the other person knows.

### 8.3 Dependency direction (enforced in review; this is the part that is NOT flexible)

```text
backend:   api/ → core/ → db/ | integrations/ | ai/      (never backwards)
           routes: parse + validate (schemas/) → call ONE core function → map to response. No SQL, no chain calls, no crypto.
           core: business logic; calls repositories, integrations, ai and @zkred/zk-core. No express objects (req/res).
           db/: the only place that runs SQL / drizzle queries.
frontend:  features/* → components/ | api/ | lib/
           features never import from another feature; shared UI goes to components/.
           Only files in lib/ import @zkred/zk-core.
shared:    frontend never imports from backend/; both import @zkred/zk-core; zk-core imports neither.
```

### 8.4 Conventions (defaults; deviate only with a reason in the PR)

- One router file per API resource, one Zod schema file per resource, one repository per table group.
- One TanStack query file per API resource (`api/queries/issuers.ts` exports `useIssuers`, `useCreateIssuer`, …).
- A page component = one route. Page files end with `Page.tsx` (`IssuerListPage.tsx`, `WalletInboxPage.tsx`).
- No `utils.ts` / `helpers.ts` dumping grounds; name files by what they do.
