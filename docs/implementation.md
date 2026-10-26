# V1.1-S4 Implementation & QA Pass #1 Verification Specification

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S4`  
> **Target Files:**
> - `docs/plan.md`
> - `docs/implementation.md`
> - `md/progress/SPARSH-PROGRESS.md`
> - `frontend/` (any bug fixes or UI polish surfaced during audit)

---

## 1. End-to-End Verification Matrix

| Flow Step | User Story / Requirement | Validation Method | Expected Outcome | Status |
|---|---|---|---|---|
| **1.1 Issuer Auth** | Admin enters access token | SessionStorage check | Grants access to `/issuer` | Pending Audit |
| **1.2 Issuer Keys** | View active BLS12-381 key epoch & rotate | `GET /issuers/:id` | Correct key epoch and BaseScan TxLink | Pending Audit |
| **1.3 Issue Credential** | Issue Degree to student via wallet lookup | Form submission & `POST /issuers/:id/credentials` | Creates encrypted offer and status slot | Pending Audit |
| **1.4 Anchor Batch** | Issuer anchors open batch | `POST /issuers/:id/batches/:id/anchor` | Pinned Merkle root on Base Sepolia | Pending Audit |
| **2.1 Wallet Setup** | Student creates local ECDH keypair | WebCrypto P-256 in IndexedDB | Keys stored in `idb-keyval` without server leakage | Pending Audit |
| **2.2 Offer Claim** | Decrypt offer & verify BBS+ signature | WebCrypto ECDH + `@zkred/zk-core` | Credential saved locally, claimed on server | Pending Audit |
| **2.3 PII Masking** | PII fields hidden by default | UI toggle | Name, DOB, address hidden behind "Show" button | Pending Audit |
| **2.4 Backup Sync** | Encrypt backup with passphrase | PBKDF2 / AES-GCM | Encrypted ciphertext saved to `/wallets/:id/backup` | Pending Audit |
| **3.1 AI Compiler** | Natural language prompt translated | `POST /presentation-requests/parse` | Returns `ParseOut` with policy & minimisation notes | Pending Audit |
| **3.2 Ambiguity UX** | Vague prompt triggers clarification | `422 POLICY_AMBIGUOUS` intercept | AmbiguityQuestionsCard with interactive retry | Pending Audit |
| **3.3 Manual Builder** | Verifier customizes policy directly | ManualPolicyBuilder form | Full visual editing of rules and constraints | Pending Audit |
| **4.1 Consent Screen** | Student reviews verifier request | `/wallet/respond?request=:id` | 3-tier privacy breakdown and matching credentials | Pending Audit |
| **4.2 In-Browser Prover**| Compute Groth16 age SNARK & BBS+ disclosure | `buildPresentation(...)` with Circom WASM | Multi-stage proving modal, < 5s execution | Pending Audit |
| **5.1 2s Polling** | Verifier dashboard polls submissions | TanStack Query `refetchInterval: 2000` | Instantly updates when student submits | Pending Audit |
| **5.2 Eval Chain** | 4-node verification pipeline | `EvalChainVisualizer` | 4 sequential checks render green on valid proof | Pending Audit |
| **5.3 Privacy Invariant**| "Never Received: Name, DOB, Address" | `PrivacyInvariantPanel` | Clear 0-bytes transmitted showcase for judges | Pending Audit |
| **5.4 Mobile QR** | Judge scans request with smartphone | `QRCodeSVG` with `request.wallet_url` | Opens mobile respondent view | Pending Audit |
| **6.1 Container Infra**| Caddy HTTPS + Frontend static + Backend reverse proxy | Docker Compose config validation | Single-command deployment on EC2 | Pending Audit |

---

## 2. Infrastructure & Deployment Verification

### 2.1 Container Configuration
- **`docker-compose.yml`**:
  - `postgres`: PostgreSQL 16 Alpine with healthcheck.
  - `backend`: Built via `infra/backend.Dockerfile`, environment variables wired through config.
  - `frontend`: Built via `infra/frontend.Dockerfile`, multi-stage build baking `VITE_API_BASE_URL` and `VITE_ZK_ARTIFACTS_BASE_URL`.
  - `caddy`: Reverse proxy routing `/api/*` to backend:8080 and serving frontend static bundle.
- **`infra/setup-ec2.sh`**:
  - Automates Docker and Docker Compose installation on Ubuntu 24.04 LTS.
- **`infra/deploy.sh`**:
  - Idempotent git pull, image rebuild, and container restart with healthcheck polling.

---

## 3. Audit Execution Steps

1. **Automated Source Audits**:
   - `pnpm --filter frontend typecheck`
   - `bash scripts/check-hardcoded.sh`
   - `pnpm --filter frontend build`
2. **API Health & Integration Verification**:
   - Query `GET /health` to confirm database, blockchain RPC, and AI status.
   - Query `GET /meta/chain` and `GET /meta/enums`.
3. **Demo Scenario Dry Run**:
   - Run `pnpm seed:run` to ensure clean initial demo state.
   - Execute verification through the browser UI.
4. **Log Results**:
   - Document all findings and log any upstream requests to HARSH.
