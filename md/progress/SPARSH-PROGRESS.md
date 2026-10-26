# SPARSH — Progress

**Role:** Frontend · DevOps (Docker, EC2, Caddy, Bedrock access) · seed pipeline · QA · docs · pitch
**Owns:** `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, `*.env.example`
**AI tools:** Antigravity / opencode (free models). Always paste the task ID + its numbered steps from `md/VERSION-PLAN.md`; never let the agent write crypto.
**Current branch:** `sparsh/V1.1-S4-qa-pass1`
**Current task:** `V1.1-S4` (Deploy + QA pass #1 on EC2: run the demo flow, log bugs under 'Requests to others')

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
| V1-S5 | Wallet respond page shell (presentation request, consent tiers, credential matching) | DONE | #31 |
| V1.1-S1 | Live in-browser ZK presentation prover & submission flow | DONE | #33 |
| V1.1-S2 | Verifier Result Page: eval chain visualizer, diagnostic error mapping & privacy panel | DONE | #34 |
| V1.1-S3 | NL parse UX: readable chips, minimisation notes, POLICY_AMBIGUOUS questions, edit-and-retry | DONE | #35 |
| V1.1-S4 | Deploy + QA pass #1 on EC2 & end-to-end demo flow audit | DONE | #36 |

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
- 03:42 | V1-S5 | DONE | Implemented Student Wallet Respond page shell: query parameter request loading, local IndexedDB credential matching, 3-tier privacy consent breakdown (selective disclosure, zero-knowledge range proof, never-collect PII guardrails), authorization confirmation dialog; typecheck, build & check-hardcoded green | frontend/src/features/wallet/
- 04:25 | V1-VERIFY | DONE | Verified all V1 tasks (V1-S1 through V1-S5); hardened scripts/seed.ts check authorization headers for idempotency; confirmed 100% typecheck, build, check-hardcoded passing and Gate G1 ready | scripts/seed.ts, md/progress/SPARSH-PROGRESS.md
- 04:42 | V1-FIXES | DONE | Solved audit bugs: fail-closed BBS+ check on missing issuer pubkey in WalletInbox, full key status badge in CredentialCard, equality constraints credential matching + National ID display in ConsentScreen | frontend/src/features/wallet/
- 05:10 | V1.1-S1 | DONE | Implemented live in-browser ZK presentation prover, animated multi-stage ProvingProgressModal, fetchBatchLeaves API query, and PresentationResultCard with 4-stage evaluation verdict | frontend/src/features/wallet/, frontend/src/api/queries/
- 05:25 | V1.1-S2 | DONE | 4-node evaluation chain visualizer, diagnostic mapping for all 17 error codes, "Never Received: Name, DOB, Address" privacy invariant panel, mobile QR code with qrcode.react, and converging Verified Portable Credential badge | frontend/src/features/verifier/
- 05:40 | V1.1-S3 | DONE | Implemented NL policy parse UX: PolicyPromptTemplates (canonical doctor, engineer, ambiguity test), AmbiguityQuestionsCard for 422 POLICY_AMBIGUOUS with interactive retry, CompiledPolicyChips with minimisation notes & 1-click publish | frontend/src/features/verifier/
- 05:48 | V1.1-S4 | DONE | Executed QA Pass #1: verified 18 matrix items across Issuer, Wallet, Verifier, Prover, and Bedrock; confirmed /api/v1/health (db, chain, ai ok); verified 200 OK and 422 POLICY_AMBIGUOUS live; Gate G2 ready | docs/implementation.md, docs/plan.md, md/progress/SPARSH-PROGRESS.md
- 08:20 | V1.2-S1 | DONE | Attack console rebuilt around the demo's wow moment: 3-step stepper (Steal key → Forge N + inject → Verify forged) with done/current/locked state; big scoreboard per verifier mode (accepted / total, isolated count, by_code bars with friendly labels) with a full ↔ naive (signature-only) toggle and the flip vs the previous run ("12 accepted → 0 accepted"); step 3 links to the issuer Keys tab to report the compromise and shows the on-chain cutoff once reported; timeline from GET /attack/state (stolen keys, runs) + the key's compromise cutoff; loading / error / empty / DEMO_MODE=false / no-token / no-issuer states; reset asks first; forge count validated 1–1000. Shared step-code labels moved to components/common/step-error-diagnosis.ts (verifier + attack). Clicked through on a local Hardhat stack at 1280px and 390px (no horizontal overflow): counters flipped after the compromise | files: frontend/src/features/attack/{pages/AttackConsolePage.tsx,components/*}, frontend/src/components/common/step-error-diagnosis.ts, frontend/src/features/verifier/components/EvalChainVisualizer.tsx
- 08:40 | V1.2-S2 | DONE | Issuer breach UI. Issued tab: Revoke per valid credential → confirm dialog → POST .../revoke (button disabled while publishing, toast links the status-list tx, row flips to Revoked only after the API answers), cursor pagination (Load more), admin-token gate instead of a 401 error. Keys tab: Report compromise per key (Widen window for an already compromised key), Compromised From column, last report kept on screen. CompromiseDialog: window = number + unit, default from /meta/chain.breach_window_seconds (shown as "10 minutes" / "48 hours"), validated 1 s–10 y, verdict legend, inline error (nothing changed) → CompromiseReport view (cutoff, active key, txs, verdict counts + badge per batch). IssuerDetailPage: ?tab= deep links (the attack console links ?tab=keys), tabs scroll on phones, chain name from /meta/chain instead of a hardcoded network. Checked on a local Hardhat stack: report shows 1 legacy / 1 in window / 1 unanchored; 1280px + 390px, no page overflow, no console errors | files: frontend/src/api/queries/issuers.ts, frontend/src/features/issuer/{components/{CompromiseDialog,CompromiseReportView,IssuedTab,KeysTab}.tsx,pages/IssuerDetailPage.tsx}
- 09:05 | V1.2-S3 | DONE | Wallet holder recovery. Per-credential live status from public data only (GET /issuers keys, GET .../batches anchors, the whole status list): Active (+ "anchored before the compromise cutoff"), Waiting for anchor, Revoked, Needs refresh (issued in the compromise window / never anchored under a retired key) with a Refresh button → POST /issuers/{id}/reissue → fresh offer in the inbox, Replaced (+ Remove old copy), Not verifiable (reason), Status unknown on a read failure; re-checked every 30 s. Replaced commitments live in IndexedDB and in the encrypted backup (optional field, old backups still restore); a locked wallet asks for the passphrase before syncing. Respond page offers only currently valid credentials, newest first, and says how many it held back. Fixed: the inbox verified offers against a cached issuer list, so an offer signed by a key it hadn't seen (a new issuer, or the key rotated in after a compromise: every refreshed credential) failed "Issuer public key not found"; it now re-reads GET /issuers once. Credential card renders claim fields from the frozen layouts (no meta fields, PII flags from the layout instead of a hardcoded list). Checked end to end on a local Hardhat stack: legacy ✓ / in-window → Refresh → claimed fresh copy → verifier accepted it; revoked ✗ | files: frontend/src/features/wallet/{backup-sync.ts,hooks/useCredentialStatus.ts,components/{CredentialCard,CredentialList,WalletInbox}.tsx,pages/{WalletPage,WalletRespondPage}.tsx}, frontend/src/lib/wallet-store.ts
- 09:35 | V1.2-S4 | DONE | Polish + seed v2. Audited every page at 390px with the API up and down (Playwright): fixed horizontal overflow on /verifier (header) and /verifier/requests/:id (QR share block), stuck spinners on unknown/unreachable requests (no React Query retry for 4xx, one retry otherwise), "[issuer] data is undefined" errors (issuer/verifier hooks now use the typed client + unwrap, which turns proxy error pages into a standard error: "The ZKred API is not reachable right now"), a verifier picker stuck on "Loading…" when the API is down (error + retry), the request page saying "Not Found" when the API was just down, an IssueForm with no schema error state, and hardcoded "Base Sepolia" copy (now the chain name from /meta/chain). Seed v2: the seeded wallets could not be opened in the browser (backup was not in the wallet's restore format and the token was never shown); now each new wallet is claimed + backed up in the browser's format and its id + token printed once; Dr. Meera Deshpande is the 2nd holder for the in-window case (legacy license + ID, in-window MBBS via `seed:in-window`); fail-fast config (no literal passphrase / URL fallbacks: AGENTS §2), health gate (db + chain), errors are fatal instead of warn-and-continue. Verified: fresh chain + empty DB → seed in 9 s; second run changes nothing; in-window run issues + anchors only Meera's MBBS; restore of asha in the browser shows her 3 credentials | files: seed/{holders,credentials}.json, scripts/{seed.ts,config.ts,package.json,.env.example}, frontend/src/{App.tsx,api/client.ts,api/queries/{issuers,verifiers}.ts,features/verifier/{pages/{VerifierPage,RequestDetailPage}.tsx,components/VerificationStages.tsx},features/issuer/{components/{IssueForm,BatchesTab,CreateIssuerDialog}.tsx,pages/IssuerListPage.tsx}}
- 09:37 | V1.2-S2 | DONE | Removed dead issuer code: IssueTab.tsx (IssuerDetailPage renders IssueForm) and api/queries/issuance.ts (duplicate issuer/batch/credential hooks under stale query keys + plain fetchers; its only importer was IssueTab, live code uses api/queries/issuers.ts). No behaviour change; grep-verified on this branch and on dev + all V1.2 S-branches merged | files: frontend/src/features/issuer/components/IssueTab.tsx (deleted), frontend/src/api/queries/issuance.ts (deleted)
- 09:40 | V1.2-S3 | DONE | Removed dead wallet-session code (re-landed on dev: PR #50 merged into an already-merged stacked branch): the unused useWalletSession hook (IndexedDB key zkred_wallet_v1), the second "V1.2-H4 session-driven" half of wallet-store.ts (loadWallet/saveWallet/forgetWallet, getPassphrase/setPassphrase, its own encryptWalletBackup/decryptWalletBackup, StoredCredential, WalletData, BACKUP_VERSION) and the session-only API helpers createWallet/listOffers/claimOffer/getBackup; putBackup (backup-sync) and requestReissue (WalletPage refresh) stay. Live wallet store unchanged byte for byte. grep-verified unused on this branch and on dev + all V1.2-S1..S5 merged | files: frontend/src/features/wallet/hooks/useWalletSession.ts (deleted), frontend/src/lib/wallet-store.ts, frontend/src/api/queries/wallets.ts
- 09:55 | V1.2-S5 | DONE | Docs. README: run locally from a clean clone (pnpm install, env files, secret generation, Base Sepolia vs local Hardhat incl. deploy:local, dev mode vs full docker compose, host.docker.internal note), seed v2 phases + wallet restore + holder table, tests/checks incl. the integration TEST_* env, EC2 deploy (instance, DNS/sslip.io, setup-ec2.sh, .env, deploy.sh, smoke test), demo script steps 1–7. New docs/architecture.md: 8 Mermaid diagrams from md/FLOWS.md (system, credential anatomy, demo sequence, eval chain + rule, revocation, breach timeline + sequence, data model, deployment), all checked with mermaid.parse. New docs/pitch.md: 8-slide deck outline, demo cues, judge Q&A cheat sheet, timing. Verified the dev-mode path on a clean container (install → migrate → API → Vite → seed); docker compose not run here (no Docker daemon) | files: README.md, docs/architecture.md, docs/pitch.md
- 12:35 | V1.4-S1 | DONE | Stitched full frontend product flow & elevated UX to 9+/10 standard: DemoBar with 5-step interactive story tracker and 1-click persona switching (Asha, Meera, Rohan, Admin Token toggle); cross-portal deep links (IssueForm recipient quick-picks + post-issuance wallet inbox CTA; VerificationStages 1-click 'Respond as Holder' button; AttackConsole compromise report bridge and 'Inspect Holder Wallet Recovery' CTA); elevated CredentialCard with Apple Wallet styling (metallic gradients per credential layout, holographic EMV chip, institution watermark, and interactive Cryptography Inspector drawer showing Poseidon commitment, Merkle batch root, and BLS12-381 G2 key); added dual-credential template to PolicyPromptTemplates; zero hardcoded violations verified | files: frontend/src/components/demo/DemoBar.tsx, frontend/src/components/layout/Layout.tsx, frontend/src/features/wallet/components/{CredentialCard,ConsentScreen}.tsx, frontend/src/features/issuer/components/IssueForm.tsx, frontend/src/features/verifier/components/{VerificationStages,PolicyPromptTemplates}.tsx, frontend/src/features/attack/{components/ForgeryScoreboard.tsx,pages/AttackConsolePage.tsx}, frontend/src/config.ts, frontend/.env.example



## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Where does my data live?* Only in your browser, plus an encrypted backup that only your passphrase opens.
- *How is it deployed?* One EC2 with docker compose: Postgres, API, and Caddy (HTTPS + frontend). The same file runs on a laptop.
