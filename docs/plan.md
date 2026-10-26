# V1.1-S4 Master Plan: QA Pass #1 & End-to-End Demo Verification

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S4`  
> **Branch:** `sparsh/V1.1-S4-qa-pass1`  
> **Target:** `dev`  
> **Objective:** Conduct QA Pass #1 across the entire ZKred platform to validate Gate G2 readiness (H10). Rigorously audit the end-to-end credential lifecycle: Institutional Issuance → Student Wallet Claim → AI Policy Compiler → Browser ZK Prover → Verifier Evaluation Chain. Verify containerized deployment scripts (`docker-compose`, Dockerfiles, Caddy) and document any bugs or integration requests in `SPARSH-PROGRESS.md`.

---

## 1. Context & Scope

Under Milestone V1.1, the team delivered the full cryptographic core and user-facing workflows:
- `V1.1-H1`: In-browser ZK presentation builder (`@zkred/zk-core`).
- `V1.1-H2`: Deterministic 4-stage verification engine (`core/verifier.ts`).
- `V1.1-H3`: Bedrock Claude Sonnet NL policy parser with Zod retry and clarifying questions.
- `V1.1-S1`: Wallet presentation prover UI with animated proving modal.
- `V1.1-S2`: Verifier evaluation chain visualizer and privacy invariant panel.
- `V1.1-S3`: Natural language policy parse UX with readable chips, minimisation notes, and ambiguity retry.

**Task V1.1-S4** executes the comprehensive QA Pass #1 across all these interconnected pillars to ensure the demo path is rock-solid before Milestone V1.2.

---

## 2. Five-Phase Audit Methodology

### Phase 1: Institutional Issuance & Anchoring (`/issuer`)
- Verify admin token authorization (`sessionStorage`).
- Verify institutional registration on Base Sepolia (`POST /issuers`).
- Verify BLS12-381 key epoch display, hash pinning, and key rotation controls.
- Verify schema-driven credential issuance and recipient lookup (`/wallets/lookup`).
- Verify batch lifecycle and timestamped Merkle tree anchoring on-chain (`POST /issuers/:id/batches/:batchId/anchor`).

### Phase 2: Student Wallet & Privacy Controls (`/wallet`)
- Verify local ECDH P-256 keypair generation via WebCrypto in IndexedDB (`idb-keyval`).
- Verify inbox polling, decrypting encrypted offers, and BBS+ signature validation.
- Verify credential list rendering with selective PII toggle.
- Verify client-side encrypted backup export and restoration with PBKDF2 / AES-GCM.

### Phase 3: Natural Language Policy Compiler (`/verifier`)
- Verify prompt template injection and plain-English compilation (`POST /presentation-requests/parse`).
- Verify data minimisation notes and readable chips rendering.
- Verify `422 POLICY_AMBIGUOUS` handling with interactive clarifying questions and edit-and-retry.
- Verify fallback handling if AWS Bedrock is offline (`502 AI_UNAVAILABLE`).
- Verify seamless handoff to `ManualPolicyBuilder`.

### Phase 4: In-Browser ZK Presentation Prover (`/wallet/respond?request=:id`)
- Verify request nonce loading and credential matching against local IndexedDB store.
- Verify 3-tier privacy consent presentation.
- Verify WebAssembly Groth16 age SNARK proving (< 5 seconds on modern browsers).
- Verify BBS+ selective disclosure proof generation.
- Verify presentation encryption and submission (`POST /presentation-requests/:id/presentations`).

### Phase 5: Verifier Evaluation Chain (`/verifier/requests/:requestId`)
- Verify 2-second polling automatically picks up student submission.
- Verify all 4 sequential evaluation nodes (`issuer_signature` → `zk_claim` → `revocation_status` → `key_epoch_anchor`).
- Verify converging "Verified Portable Credential" badge on acceptance.
- Verify "Never Received by Verifier (0 bytes transmitted)" privacy invariant panel.
- Verify mobile QR code rendering with `qrcode.react`.

### Phase 6: Deployment & Infrastructure Audit (`infra/`)
- Verify Dockerfiles for backend and frontend.
- Verify `docker-compose.yml` local orchestration (Postgres 16, backend, frontend, Caddy).
- Verify `setup-ec2.sh` and `deploy.sh` script safety and zero hardcoded secrets.

---

## 3. Strict Rules & Constraints (`AGENTS.md`)

1. **Ownership**:
   - SPARSH owns `frontend/`, `infra/`, `scripts/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never modify backend or smart contracts directly; write requests to HARSH under "Requests to others".
2. **Zero Hardcoded Data**:
   - Verify that all seed data, tokens, and RPC endpoints come from environment variables.
   - Run `bash scripts/check-hardcoded.sh`.
3. **Fail-Closed Principle**:
   - Confirm that if any cryptographic verification stage or chain RPC is unavailable, evaluation strictly fails closed.

---

## 4. Acceptance Deliverables

1. Full audit report documented in `docs/implementation.md`.
2. Any identified bugs, polish items, or requests logged in `md/progress/SPARSH-PROGRESS.md`.
3. Green quality gates: `pnpm --filter frontend typecheck`, `check-hardcoded.sh`, and `pnpm --filter frontend build`.
