# Version Plan — member-wise tasks (ZKred, 2 people, ~20h)

> Structure: **Version → Task ID → Owner → Output → Depends on → Done when**.
> Team: **HARSH** (lead; backend, `packages/zk-core`, contracts, circuits, Bedrock AI, `CONTRACTS.md`; merges PRs) · **SPARSH** (frontend, infra/docker/EC2, seed, scripts, `.github`, README, docs, pitch).
> Work is split by **folder ownership** (`AGENTS.md` §1) so nobody edits the same file. Both review each other's PRs and click through the full flow at every gate.
>
> Task ID format: `V1-H3` = Version 1, Harsh, task 3; `V1-S3` = Sparsh. Use the ID in branches, commits and progress logs.
> ⭐ = demo critical path. SPARSH's tasks are written step by step so a free AI model can execute them safely: **follow the steps literally, and stop and ask if a step doesn't match reality.**

---

## Dependency rule

A task may only depend on (a) a **contract** in `CONTRACTS.md` (frozen at H2) or (b) a task in an **earlier version**. If you need something from your teammate in the same version, code against the contract and show a real loading / `501` state until it lands.

---

## V0 — Skeleton (H0–H2)

| ID | Owner | Task | Output | Depends on | Done when |
|---|---|---|---|---|---|
| V0-ALL1 | BOTH | Read PS + `md/*`, agree the demo flow, freeze MVP-SCOPE | Status `FROZEN` | — | both said yes |
| V0-H1 ⭐ | HARSH | Freeze `CONTRACTS.md` (review with SPARSH) | Frozen contracts | V0-ALL1 | changelog row H2 |
| V0-H2 ⭐ | HARSH | pnpm monorepo root (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`), `backend/` scaffold: `src/config.ts` (Zod env, fail-fast), Express app, error middleware (CONTRACTS §2), `GET /health`, `/meta/enums`, `/meta/chain`, `/meta/credential-schemas`, OpenAPI at `/api/v1/openapi.json`, Drizzle schema + first migration | Backend runs locally against compose Postgres | V0-H1 | `curl /api/v1/health` → db ok |
| V0-H3 ⭐ | HARSH | `contracts/`: IssuerRegistry, AnchorRegistry, StatusRegistry + Hardhat tests + deploy script; deploy to Base Sepolia; send addresses to SPARSH for `.env` | Addresses + tx links | V0-H1 | `pnpm --filter contracts test` green, deployed |
| V0-H4 ⭐ | HARSH | `circuits/age_gte.circom` + `build.sh` (compile, Powers of Tau, Groth16 setup, export vkey); **commit** `circuits/build/{age_gte.wasm,age_gte.zkey,vkey.json}` | ZK artifacts in git | — | node prove/verify roundtrip test passes |
| V0-H5 ⭐ | HARSH | `packages/zk-core` skeleton: layouts, policy Zod, `bbs.ts` spike (keygen/sign/verify/derive one credential), `walletCrypto` | Package builds for Node + browser | V0-H1 | unit test green; Vite can import it |
| V0-S1 ⭐ | SPARSH | Frontend scaffold (steps below) | Shell renders 4 sections | — | `pnpm --filter frontend dev` shows layout + health dot |
| V0-S2 ⭐ | SPARSH | Infra: `docker-compose.yml`, `infra/docker/backend.Dockerfile`, `infra/docker/frontend.Dockerfile`, `infra/caddy/Caddyfile`, all `.env.example` files from CONTRACTS §6 | `docker compose up` runs db + backend + caddy | V0-H2 | `https://localhost/api/v1/health` via Caddy |
| V0-S3 | SPARSH | GitHub repo (HARSH creates it, adds SPARSH as admin), branch protection on `main`, CODEOWNERS handles, PR template, `scripts/check-hardcoded.sh` passes | Repo ready | — | a test PR shows the template |
| V0-S4 ⭐ | SPARSH | EC2: launch Ubuntu (t3.small+), security group 22/80/443, install Docker + compose plugin, DNS (domain or `<ip>.sslip.io`), clone repo, `.env` filled, `docker compose up -d` | Live URL | V0-S2 | live `/api/v1/health` 200 |
| V0-S5 | SPARSH | AWS Bedrock: in region `AWS_REGION` enable access to the Claude Sonnet model; create either a Bedrock API key or an EC2 instance role with `bedrock:InvokeModel*`; write the confirmed model id into the EC2 `.env` (`BEDROCK_MODEL_ID`) | Bedrock usable from EC2 | — | HARSH's `/health` shows `ai: ok` |
| V0-S6 | SPARSH | `pnpm --filter frontend gen:api` (openapi-typescript from `/api/v1/openapi.json` → `src/api/types.ts`) | Typed client | V0-H2 | types compile |

**V0-S1 steps (frontend scaffold):**
1. `pnpm create vite frontend --template react-ts` (from the repo root), add it to `pnpm-workspace.yaml` (ask HARSH; root file is his) .
2. Install: `tailwindcss @tailwindcss/vite`, shadcn/ui (`pnpm dlx shadcn@latest init`), `@tanstack/react-query`, `react-router-dom`, `openapi-typescript` (dev), `openapi-fetch`, `qrcode.react`, `sonner` (toasts).
3. `src/config.ts`: read `import.meta.env.VITE_API_BASE_URL` and `VITE_ZK_ARTIFACTS_BASE_URL`; throw at startup if missing. **No other file may read `import.meta.env`.**
4. `src/api/client.ts`: `openapi-fetch` client with `baseUrl` from config; one `toUserMessage(error)` mapping every code in CONTRACTS §2 to friendly text.
5. Routes: `/issuer`, `/issuer/:issuerId`, `/wallet`, `/wallet/respond`, `/verifier`, `/verifier/requests/:requestId`, `/attack`. Layout: top nav with the 4 sections + health dot (calls `GET /health` every 15 s).
6. Shared components: `<Loading/>`, `<EmptyState/>`, `<ErrorState error onRetry/>`, `<TxLink hash/>` (uses `explorer_tx_url_template` from `GET /meta/chain`), `<Hex value/>` (shortened + copy button).

**Gate G0 (H2):** EC2 URL serves the shell; `/health` green with DB + chain; contracts on Base Sepolia; ZK artifacts committed; CONTRACTS frozen.

---

## V1.0 — Walking skeleton (H2–H6)

| ID | Owner | Task | Output | Depends on | Done when |
|---|---|---|---|---|---|
| V1-H1 ⭐ | HARSH | `integrations/chain.ts` + issuers & keys endpoints (`POST/GET /issuers`, `GET /issuers/{id}`, rotate) with gov-wallet creation + funding | Real on-chain issuers | V0-H3, V0-H5 | issuer visible on BaseScan |
| V1-H2 ⭐ | HARSH | Issuance: `POST /issuers/{id}/credentials` (BBS sign, encrypted offer, open batch, status index), `GET .../credentials`, `GET .../batches`, `POST .../anchor`, `GET /batches/{id}/leaves`, `GET /status-lists/{id}` | Credentials issued + anchored | V1-H1 | seed can issue 3 creds and anchor |
| V1-H3 ⭐ | HARSH | Wallet endpoints: `POST /wallets`, lookup, offers list/claim, backup PUT/GET (wallet token auth) | Wallet API | V0-H2 | claim works from curl |
| V1-H4 ⭐ | HARSH | Verifiers + requests: `POST/GET /verifiers`, `POST /presentation-requests` (deterministic consent template for now), `GET /presentation-requests/{id}`; `parse` and `presentations` return `501` | Request flow | V0-H2 | FE can create + open a request |
| V1-S1 ⭐ | SPARSH | **Issuer console** (steps below) | Issuer pages on the real API | V0-S1, contract | issue a credential from the UI |
| V1-S2 ⭐ | SPARSH | **Wallet** setup, inbox, credential list, backup (steps below) | Wallet pages | V0-S1, contract | claimed creds survive a reload + restore on a new browser |
| V1-S3 ⭐ | SPARSH | **Verifier**: verifier picker/create, new request page (NL textarea calling `parse` — shows the `501`/`502` message + manual policy builder), result page polling verifications | Verifier pages | V0-S1, contract | request created via the manual builder |
| V1-S4 ⭐ | SPARSH | **Seed v1**: `seed/issuers.json`, `seed/holders.json`, `seed/credentials.json`, `seed/verifiers.json`, `scripts/seed.ts` (idempotent; uses `walletCrypto` from zk-core to create the holder wallet + encrypted backup) | Demo state from zero | V1-H2, V1-H3 | run twice → no duplicates |
| V1-S5 | SPARSH | **Wallet respond page** shell: `/wallet/respond?request=<id>` loads the request, shows the consent screen (revealed / proven / never shared) from the policy + matching local credentials; "Share" button disabled until V1.1 | Consent UI | V1-S2 | consent lists correct fields |

**V1-S1 steps (Issuer console):**
1. `/issuer`: admin-token prompt (stored in `sessionStorage` only), list `GET /issuers` (name, did, kind, accredited, active key status), "New issuer" dialog → `POST /issuers` (kind options from `/meta/enums.issuer_kinds`).
2. `/issuer/:issuerId` tabs: **Keys** (table of `keys[]` + TxLink; buttons Rotate, Report compromise (V1.2)), **Issue** (pick type from `/meta/credential-schemas`, render a form from `fields[]` (date → date input), recipient by wallet display name via `/wallets/lookup`), **Issued** (`GET .../credentials`; Revoke button in V1.2), **Batches** (`GET .../batches`; Anchor button on open batches; show `anchored_at`, root, TxLink).
3. Every mutation: disable the button while pending, toast success with TxLink, show `ErrorState` on failure. Never optimistic.

**V1-S2 steps (Wallet):**
1. First visit: "Create wallet" (display name + passphrase ≥ 10 chars) → `walletCrypto.generateWalletKeyPair()` → `POST /wallets` → store `{wallet_id, wallet_token, privateKeyJwk}` in IndexedDB (`idb-keyval`). Or "Restore" (wallet id + token + passphrase → `GET backup` → `decryptBackup`).
2. Inbox: `GET /wallets/{id}/offers` → for each unclaimed: `decryptOffer` → `verifyCredential` (fetch the issuer key from `GET /issuers`) → save to IndexedDB → `POST .../claim`.
3. Credentials list: cards per credential (type, institution / council, issuer did, key status badge from `GET /issuers`; PII fields hidden behind "show on this device").
4. After every change: `encryptBackup(passphrase, allWalletData)` → `PUT /wallets/{id}/backup`. The passphrase stays in memory only (re-prompt after reload).

**Gate G1 (H6):** click through demo steps 1–5 on the live URL with seeded data (verification may still say `501`). Ugly is OK, fake data is NOT.

---

## V1.1 — Core crypto + AI (H6–H10)

| ID | Owner | Task | Output | Depends on | Done when |
|---|---|---|---|---|---|
| V1.1-H1 ⭐ | HARSH | `zk-core.buildPresentation` (BBS derive + Merkle proof + age SNARK in browser) | Presentation built in Chrome | V0-H4, V0-H5 | < 5 s on a laptop |
| V1.1-H2 ⭐ | HARSH | `core/verifier.ts` full + naive modes; `POST /presentation-requests/{id}/presentations` + list verifications; nonce single-use | Real verification | V1.1-H1 | unit tests for every step code |
| V1.1-H3 ⭐ | HARSH | Bedrock: `ai/policy.ts` + `prompts/policy.md` + `prompts/consent.md`; Zod-validated, 1 retry; `parse` endpoint live; real consent summary | NL → policy | V0-S5 | the canonical employer sentence → correct policy |
| V1.1-S1 ⭐ | SPARSH | Respond page: "Share" → fetch issuer keys + `GET /batches/{id}/leaves` for needed batches → `buildPresentation(...)` with artifacts from `VITE_ZK_ARTIFACTS_BASE_URL` → `POST presentations` → show the result; progress steps UI (Signing proofs… / Proving age… / Submitting…) | Holder completes the flow | V1.1-H1 | verifier shows accepted |
| V1.1-S2 ⭐ | SPARSH | Verifier result page: the **eval chain** visual — 4 nodes per requirement (Issuer Signature → ZK Claim → Revocation Status → Key-Epoch/Anchor) → final "Verified Portable Credential" badge; red node shows code → friendly text; show the revealed fields and a "never received: name, DOB, address" panel | The judge-facing screen | V1.1-H2 | matches the PS eval chain |
| V1.1-S3 | SPARSH | NL parse UX: show the policy as readable chips, `minimisation_notes`, `POLICY_AMBIGUOUS` questions, edit-and-retry | AI UX | V1.1-H3 | ambiguous text shows questions |
| V1.1-S4 | SPARSH | Deploy + QA pass #1 on EC2: run the demo flow, log bugs under "Requests to others" in your progress file | Bug list | G1 | list shared with HARSH |

**Gate G2 (H10):** demo steps 1–5 produce a real VERIFIED result on the live URL.

---

## V1.2 — Complete MVP (H10–H14)

| ID | Owner | Task | Output | Depends on | Done when |
|---|---|---|---|---|---|
| V1.2-H1 ⭐ | HARSH | Revocation: `POST .../revoke` → bit flip → `StatusRegistry.setListHash`; verifier checks list hash vs chain | Revocation works | V1.1-H2 | re-verify → ✗ `REVOKED` |
| V1.2-H2 ⭐ | HARSH | Breach: `POST .../compromise` (markCompromised + rotate + affected batches report), `POST /issuers/{id}/reissue` | Breach response | V1.1-H2 | forged ✗, legacy ✓, reissued ✓ in tests |
| V1.2-H3 ⭐ | HARSH | Attack endpoints (`/attack/*`, DEMO_MODE only) | Red-team API | V1.2-H2 | counters correct |
| V1.2-H4 | HARSH | Fix SPARSH's QA bugs; input validation everywhere (4xx not 500) | Stable API | V1.1-S4 | QA list closed |
| V1.2-S1 ⭐ | SPARSH | **Attack console** `/attack`: 3-step stepper (Steal key → Forge N + inject → Verify forged [full]) + big counters (accepted / rejected / by_code) + a "naive (signature-only)" toggle for contrast; timeline from `GET /attack/state`; link to the issuer page to report compromise | The "wow" screen | V1.2-H3 | counters flip after compromise |
| V1.2-S2 ⭐ | SPARSH | Issuer: Revoke button; "Report compromise" dialog (window from `/meta/chain.breach_window_seconds`, editable) → `CompromiseReport` table (batch verdict badges) | Breach UI | V1.2-H2 | report shows legacy / in-window / unanchored |
| V1.2-S3 ⭐ | SPARSH | Wallet: per-credential status (fetch the status list + key status): Active / Revoked / "Issued during compromise window → Refresh" → `POST /issuers/{id}/reissue` → new offer in the inbox | Holder recovery | V1.2-H2 | refreshed cred verifies ✓ |
| V1.2-S4 | SPARSH | Loading/empty/error states on every page; responsive at 390px; seed v2 (realistic Indian names, 2 universities, 1 medical council, a 2nd holder for the in-window case) | Polished MVP | — | no blank screens |
| V1.2-S5 | SPARSH | README (run locally + EC2 deploy), `docs/architecture.md` (diagrams from `md/FLOWS.md`), start `docs/pitch.md` deck outline | Docs | — | a clean-machine run works |

**Gate G3 (H14):** demo steps 1–7 on the live URL. `check-hardcoded.sh` green on `main`.

---

## V1.3 — Stretch (H14–H15)

| ID | Owner | Task |
|---|---|---|
| V1.3-S1 | SPARSH | QR code for `wallet_url` on the verifier page (phone wallet) |
| V1.3-S2 | SPARSH | `.github/workflows/ci.yml`: install, typecheck, tests, check-hardcoded |
| V1.3-H1 | HARSH | `contracts/scripts/replay48h.ts`: Hardhat time-travel showing a true 48h window |
| V1.3-H2 | HARSH | Holder binding (S3) if everything else is stable |

**H15 — FEATURE FREEZE.**

---

## V1.4 — Polish & hardening (H15–H19)

| ID | Owner | Task |
|---|---|---|
| V1.4-H1 | HARSH | Bug fixes, merge queue, final DB reset + reseed on EC2, warm Bedrock |
| V1.4-H2 | HARSH | Prepare the 60-second crypto explanation: "chain time, not claimed time"; BBS vs SNARK; what's revealed |
| V1.4-S1 | SPARSH | UI polish on the demo path, favicon/title "ZKred", dark-mode check |
| V1.4-S2 | SPARSH | Backup demo video (screen recording of steps 1–7), deck final, README final, submission form |
| V1.4-ALL | BOTH | Rehearse the pitch ×2 on the live URL; each can answer "how does X work" for their own part |

**H19 — CODE FREEZE.** Tag `demo-final`. H19–H20 buffer.

---

## Syncs

Every 3 hours (H3, H6, H9, H12, H15, H18), 10 minutes: each person reads the last lines of their progress file: done / next / blocked / requests.

## Rest (2 people)

Staggered 90-minute naps so someone is always awake and the deploy is watched:

| Window | Sleeps | Awake |
|---|---|---|
| H10–H11:30 | SPARSH | HARSH |
| H11:30–H13 | HARSH | SPARSH |

## AI-tool budget notes

- **HARSH (Claude Pro, limited usage):** spend Claude on zk-core, the verifier engine, contracts and circuits. Use free tools for boilerplate (routes, Drizzle tables). Keep sessions focused: one task ID per session, plan mode for > 3 files.
- **SPARSH (free models: Antigravity, opencode):** always paste the task ID and its steps from this file; the agent must read `AGENTS.md` first. For any crypto question, ask HARSH; don't let a free model write crypto.
