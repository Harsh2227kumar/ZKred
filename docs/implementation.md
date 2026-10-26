# V1.1-S4 QA Pass #1 Verification & Audit Report

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S4`  
> **Status:** PASSED (Gate G2 Verified)  
> **Target:** `dev`

---

## 1. End-to-End Verification Results Matrix

| Flow Step | User Story / Requirement | Validation Method | Outcome | Status |
|---|---|---|---|---|
| **1.1 Issuer Auth** | Admin enters access token | SessionStorage check | Grants access to `/issuer` | **VERIFIED** |
| **1.2 Issuer Keys** | View active BLS12-381 key epoch & rotate | `GET /api/v1/issuers` | Active key epoch, hash pinned on Base Sepolia | **VERIFIED** |
| **1.3 Issue Credential** | Issue Degree to student via wallet lookup | Form submission & `POST /issuers/:id/credentials` | Creates encrypted offer and status slot | **VERIFIED** |
| **1.4 Anchor Batch** | Issuer anchors open batch | `POST /issuers/:id/batches/:id/anchor` | Pinned Merkle root on Base Sepolia | **VERIFIED** |
| **2.1 Wallet Setup** | Student creates local ECDH keypair | WebCrypto P-256 in IndexedDB | Keys stored in `idb-keyval` without server leakage | **VERIFIED** |
| **2.2 Offer Claim** | Decrypt offer & verify BBS+ signature | WebCrypto ECDH + `@zkred/zk-core` | Credential saved locally, claimed on server | **VERIFIED** |
| **2.3 PII Masking** | PII fields hidden by default | UI toggle | Name, DOB, address hidden behind "Show" button | **VERIFIED** |
| **2.4 Backup Sync** | Encrypt backup with passphrase | PBKDF2 / AES-GCM | Encrypted ciphertext saved to `/wallets/:id/backup` | **VERIFIED** |
| **3.1 AI Compiler** | Natural language prompt translated | `POST /presentation-requests/parse` | Returns `ParseOut` with policy & minimisation notes | **VERIFIED** |
| **3.2 Ambiguity UX** | Vague prompt triggers clarification | `422 POLICY_AMBIGUOUS` intercept | AmbiguityQuestionsCard with interactive retry | **VERIFIED** |
| **3.3 Manual Builder** | Verifier customizes policy directly | ManualPolicyBuilder form | Full visual editing of rules and constraints | **VERIFIED** |
| **4.1 Consent Screen** | Student reviews verifier request | `/wallet/respond?request=:id` | 3-tier privacy breakdown and matching credentials | **VERIFIED** |
| **4.2 In-Browser Prover**| Compute Groth16 age SNARK & BBS+ disclosure | `buildPresentation(...)` with Circom WASM | Multi-stage proving modal, < 5s execution | **VERIFIED** |
| **5.1 2s Polling** | Verifier dashboard polls submissions | TanStack Query `refetchInterval: 2000` | Instantly updates when student submits | **VERIFIED** |
| **5.2 Eval Chain** | 4-node verification pipeline | `EvalChainVisualizer` | 4 sequential checks render green on valid proof | **VERIFIED** |
| **5.3 Privacy Invariant**| "Never Received: Name, DOB, Address" | `PrivacyInvariantPanel` | Clear 0-bytes transmitted showcase for judges | **VERIFIED** |
| **5.4 Mobile QR** | Judge scans request with smartphone | `QRCodeSVG` with `request.wallet_url` | Opens mobile respondent view | **VERIFIED** |
| **6.1 Container Infra**| Caddy HTTPS + Frontend static + Backend reverse proxy | Docker Compose config validation | Single-command deployment on EC2 | **VERIFIED** |

---

## 2. Live API & Service Health Audit

```json
GET /api/v1/health ->
{
  "status": "ok",
  "db": "ok",
  "chain": "ok",
  "ai": "ok",
  "version": "0.1.0"
}
```

- **Database**: PostgreSQL 16 active and responsive.
- **Blockchain**: Base Sepolia (chain ID 84532) contracts live:
  - `IssuerRegistry`: `0x7AD1dc8a22923df3a7997AC002cfb4b32Ad6AEa8`
  - `AnchorRegistry`: `0x12DA5d65d4C7d46d900D7512C4096503fCD29Cfd`
  - `StatusRegistry`: `0xeee916756f6a810034af451FC80f77aD00d8a0c0`
- **Bedrock AI**:
  - Valid Requirement Prompt $\rightarrow$ 200 OK with `ParseOut`, `minimisation_notes`, and `consent_summary` in 9s.
  - Vague Ambiguous Prompt $\rightarrow$ 422 `POLICY_AMBIGUOUS` with 3 clarifying questions in 8s.

---

## 3. Infrastructure & Script Audit

- **`docker-compose.yml`**: Validated service health checks, inter-container networking (`zkred-net`), and static asset mounting.
- **`infra/deploy.sh`**: Verified polling against `/api/v1/health`.
- **`scripts/check-hardcoded.sh`**: 100% PASS with zero secrets or hardcoded literals in app source code.
