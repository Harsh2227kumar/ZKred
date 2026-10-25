# V1-S4 Plan: Seed Pipeline v1 & Demo Data Ingestion

> **Owner:** SPARSH (Frontend & DevOps/Tooling Lead)  
> **Task ID:** `V1-S4`  
> **Branch:** `sparsh/V1-S4-seed-pipeline`  
> **Target:** `dev`  
> **Objective:** Deliver an automated, idempotent demo seeding pipeline (`seed/*.json` + `scripts/seed.ts`) that provisions realistic Indian institutional issuers, holder wallet ("Asha"), claims, Base Sepolia batch anchors, and encrypted holder backups through the real REST API.

---

## 1. Context & Role in the Hackathon Demo

In the Cascade '26 demo flow (`md/MVP-SCOPE.md` §3 and `md/FLOWS.md` §1):
1. **Issuer Console** shows IIIT Nagpur, Maharashtra Medical Council, and UIDAI registered on Base Sepolia.
2. **Student Wallet** for "Asha" possesses 3 verifiable credentials:
   - **Degree**: MBBS from IIIT Nagpur (honors, graduation year 2024).
   - **Medical License**: Active practitioner license from Maharashtra Medical Council.
   - **Government ID**: Age/ID credential from UIDAI with DOB 2000-05-15 (proving age ≥ 21).
3. **Verifier Portal** allows an employer (Apollo Hospitals) to evaluate Asha's credentials zero-knowledge without receiving name, DOB, or address.
4. **Red-team Attack Console** demonstrates key breach recovery on IIIT Nagpur.

`scripts/seed.ts` is the **canonical engine** that brings the entire decentralized system from a fresh database to a ready-to-judge demo state in a single command, running seamlessly on local dev or AWS EC2.

---

## 2. Strict Rules & Constraints

1. **Folder Ownership (`AGENTS.md` §1)**:
   - SPARSH owns: `seed/`, `scripts/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never touch `backend/`, `packages/zk-core/`, `contracts/`, or `circuits/`.
2. **Zero Hardcoded Data (`AGENTS.md` §2)**:
   - No mock arrays or literal secrets in source code.
   - All environmental configuration read through ONE module: `scripts/config.ts`.
   - Business data resides exclusively in `seed/*.json` and reaches the database via HTTP calls to the real REST API (`SEED_API_BASE_URL`).
3. **Crypto Safety (`AGENTS.md` §1.1)**:
   - All holder cryptographic operations (ECDH P-256 keypair generation, offer decryption, PBKDF2/AES-GCM backup encryption, BBS+ signature verification) strictly call `@zkred/zk-core` (`walletCrypto`, `verifyCredential`).
4. **Strict Idempotency**:
   - The script must check existing state (`GET /issuers`, `GET /verifiers`, `GET /wallets/lookup`, etc.) before creating entities.
   - Running `pnpm --filter scripts seed` twice back-to-back must result in zero duplicate records, zero errors, and a clean exit code 0.

---

## 3. Architecture & File Breakdown

```text
Cascade/
├─ seed/
│  ├─ issuers.json         # IIIT Nagpur, Maharashtra Medical Council, UIDAI
│  ├─ holders.json         # Asha ("asha", Dr. Asha Sharma)
│  ├─ credentials.json     # Degree (MBBS), MedicalLicense, GovernmentId
│  └─ verifiers.json       # Apollo Hospitals, State Health Recruitment
├─ scripts/
│  ├─ package.json         # Scoped script workspace package
│  ├─ tsconfig.json        # TypeScript configuration referencing tsconfig.base.json
│  ├─ config.ts            # Single config anchor reading process.env
│  ├─ seed.ts              # 8-Phase Idempotent Seeding Pipeline
│  ├─ .env.example         # Template for SEED_* environment variables
│  └─ check-hardcoded.sh   # Integrity guard
└─ docs/
   ├─ plan.md              # This execution plan
   └─ implementation.md    # Detailed specification
```

---

## 4. Phased Execution Steps

### Phase 1: Environment & Workspace Configuration
- Create `scripts/package.json` with dependencies on `@zkred/zk-core: workspace:*`, `tsx`, and `dotenv`.
- Create `scripts/tsconfig.json` ensuring Node 22 / ESNext compatibility.
- Implement `scripts/config.ts` enforcing validation of:
  - `SEED_API_BASE_URL` (default: `http://localhost:8080/api/v1`)
  - `SEED_ADMIN_TOKEN` (required for issuer operations)
  - `SEED_WALLET_PASSPHRASE` (default: `AshaSecurePassphrase2026!`)

### Phase 2: Seed Data Artifacts (`seed/*.json`)
- **`seed/issuers.json`**:
  - `AIIMS Nagpur` (`university`, did suffix `aiimsn`, All India Institute of Medical Sciences)
  - `IIIT Nagpur` (`university`, did suffix `iiitn`, Indian Institute of Information Technology — B.Tech college)
  - `Maharashtra Medical Council` (`medical_council`, did suffix `mmc`)
  - `Unique Identification Authority` (`government`, did suffix `uidai`)
- **`seed/holders.json`**:
  - `display_name`: `"asha"`, `full_name`: `"Dr. Asha Sharma"`
- **`seed/credentials.json`**:
  - Degree (MBBS from AIIMS Nagpur, Major: Medicine & Surgery, 2024, Distinction)
  - MedicalLicense (MMC-2024-9982 from Maharashtra Medical Council, Physician & Surgeon, Active)
  - GovernmentId (AHA-8821-9920 from UIDAI, DOB: 2000-05-15 proving age ≥ 21, Nagpur)
- **`seed/verifiers.json`**:
  - `Apollo Hospitals - Medical Verification Board`
  - `State Health Recruitment Service`

### Phase 3: The 8-Stage Seed Pipeline (`scripts/seed.ts`)
1. **Health Verification**: Check `GET /health` to ensure DB and chain services are live.
2. **Issuer Provisioning**: Query `GET /issuers`. For each issuer not yet registered, call `POST /issuers` with `X-Issuer-Admin-Token`.
3. **Verifier Provisioning**: Query `GET /verifiers`. Register missing verifiers via `POST /verifiers`.
4. **Holder Wallet Setup**:
   - Check `GET /wallets/lookup?display_name=asha`.
   - If missing, generate an ECDH P-256 keypair via `walletCrypto.generateWalletKeyPair()`, call `POST /wallets`, and record `wallet_id` and `wallet_token`.
5. **Credential Issuance**:
   - For each credential in `seed/credentials.json`, invoke `POST /issuers/{id}/credentials` to sign and create encrypted offers.
6. **Batch Anchoring**:
   - For each issuer with an open batch, call `POST /issuers/{id}/batches/{batch_id}/anchor` to anchor the Merkle root on Base Sepolia.
7. **Offer Decryption & Claiming**:
   - Query `GET /wallets/{wallet_id}/offers`.
   - Decrypt each offer with `walletCrypto.decryptOffer()`.
   - Verify the BBS+ signature with `verifyCredential()`.
   - Claim the offer via `POST /wallets/{wallet_id}/offers/{offer_id}/claim`.
8. **Client-Side Encrypted Backup**:
   - Pack claimed credentials into holder backup.
   - Encrypt using `walletCrypto.encryptBackup(SEED_WALLET_PASSPHRASE, ..., 100000)`.
   - Upload via `PUT /wallets/{wallet_id}/backup`.

---

## 5. Verification & Validation Checklist
- [ ] `pnpm --filter scripts typecheck` passes with zero errors.
- [ ] Run `pnpm --filter scripts seed`: successfully seeds or reports existing state.
- [ ] Run `pnpm --filter scripts seed` a **second time**: reports all items already exist, zero duplicates created.
- [ ] `bash scripts/check-hardcoded.sh`: passes with code 0.
- [ ] Student Wallet UI at `http://localhost:5173/wallet` can unlock/restore Asha's wallet using passphrase `AshaSecurePassphrase2026!` and see all 3 credentials.
