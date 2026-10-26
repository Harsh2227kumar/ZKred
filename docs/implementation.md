# V1.1-S1 Implementation Specification: Student Wallet Live Presentation Prover

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S1` ⭐  
> **Target Files:**
> - `frontend/src/api/queries/issuers.ts`
> - `frontend/src/api/queries/verifiers.ts`
> - `frontend/src/features/wallet/components/ProvingProgressModal.tsx`
> - `frontend/src/features/wallet/components/PresentationResultCard.tsx`
> - `frontend/src/features/wallet/components/ConsentScreen.tsx`
> - `frontend/src/features/wallet/pages/WalletRespondPage.tsx`
> - `md/progress/SPARSH-PROGRESS.md`

---

## 1. Technical Data Flow & State Machine

```
[Student clicks "Confirm & Sign"]
             │
             ▼
[Step 1: On-Chain Resolution]
  ├── Fetch GET /issuers (all issuer public keys & accreditation status)
  └── Fetch GET /batches/{batch_id}/leaves (for each matched credential)
             │
             ▼
[Step 2: BBS+ Selective Disclosure]
  └── For each requirement: derive blinded signature bound to request.nonce
             │
             ▼
[Step 3: zk-SNARK Proving (if age predicate requested)]
  ├── Download /zk/age_gte.wasm & /zk/age_gte.zkey (cached)
  └── snarkjs.groth16.fullProve: prove dob_days <= cutoff_days on dob_commitment
             │
             ▼
[Step 4: Submission to Verifier Gateway]
  └── POST /presentation-requests/{id}/presentations with Presentation payload
             │
             ▼
[Step 5: Verdict Display]
  └── Render Verification result (Accepted / Rejected with step breakdown)
```

---

## 2. Component Specifications

### 2.1 API Query Helpers (`frontend/src/api/queries/`)

1. **`issuers.ts`**:
   - `fetchBatchLeaves(batchId: string): Promise<string[]>`:
     Calls `GET /batches/${batchId}/leaves` and returns `data.leaves`.
2. **`verifiers.ts`**:
   - `useSubmitPresentation(requestId: string)`:
     TanStack mutation wrapping `submitPresentation(requestId, presentation)` which invalidates `['presentation-requests', requestId, 'verifications']`.

---

### 2.2 Proving Progress Modal (`ProvingProgressModal.tsx`)

Visual multi-step stepper overlay displaying live progress:
- **State enumeration**:
  - `FETCHING_DEPS` ("Resolving On-Chain Issuers & Batch Anchors...")
  - `DERIVING_BBS` ("Deriving Blinded BBS+ Signatures & Merkle Proofs...")
  - `PROVING_AGE` ("Generating Groth16 zk-SNARK Age Proof in WebAssembly...")
  - `SUBMITTING` ("Submitting Cryptographic Presentation to Verifier...")
  - `COMPLETED` ("Verification Process Complete!")
  - `FAILED` ("Presentation Generation Failed")
- Design:
  - Dark glassmorphic modal with pulsing mint/teal indicators, elapsed time counter, and detailed micro-status.

---

### 2.3 Presentation Result Card (`PresentationResultCard.tsx`)

Rendered when `submitPresentation` returns:
- **Accepted State**:
  - Emerald badge: `VERIFIED PORTABLE CREDENTIAL`
  - Verifier evaluation chain summary: all 4 evaluation stages green (`Issuer BBS+ Signature`, `Zero-Knowledge Proof`, `On-Chain Revocation`, `Key-Epoch & Batch Anchor`).
  - Disclosed attributes list (e.g., `degree_name: MBBS`, `graduation_year: 2024`).
  - Privacy reassurance badge: sensitive PII (`holder_name`, `dob`, `address`) was mathematically proven client-side and never sent.
  - Action buttons:
    - `View in Verifier Portal` (`/verifier/requests/${requestId}`)
    - `Back to Student Wallet` (`/wallet`)
- **Rejected State**:
  - Rose badge: `PRESENTATION REJECTED`
  - Step breakdown highlighting the failed stage and error code (e.g. `AGE_PROOF_INVALID`, `REVOKED`, etc.).
  - `Try Again` action button.

---

### 2.4 Integration in `ConsentScreen.tsx` & `WalletRespondPage.tsx`

- When user clicks "Confirm & Sign" in the consent confirmation dialog:
  1. Open `ProvingProgressModal` with initial step `FETCHING_DEPS`.
  2. For all matched credentials, extract `batch_id` values and fetch all leaves via `fetchBatchLeaves`.
  3. Format `issuerKeys: Array<{ key_id, public_key }>` and `issuers: Record<string, IssuerInfo>` from the `useIssuers()` hook data.
  4. Call `createPresentation(...)` from `@/lib/zk.ts`.
  5. Post result via `submitPresentation(request.id, presentation)`.
  6. On success/failure, update modal to `COMPLETED` and mount `PresentationResultCard`.

---

## 3. Security, Privacy & Fail-Closed Invariants

1. **Client-Side Only**:
   - `dob` and `dob_salt` never leave the browser. Only the Groth16 zk-SNARK `proof` and `public_signals` (`[dob_commitment, cutoff_days]`) are included in the presentation payload.
2. **Replay Protection**:
   - The BBS+ blinded proof header contains `request.nonce`. Submitting consumes the nonce on-chain/in-DB. A stale or re-submitted presentation is rejected with `BBS_INVALID` or `NONCE_USED`.
3. **Fail-Closed Verification**:
   - If any needed batch is unanchored or leaves do not contain the commitment, `createPresentation` immediately throws `ZkCoreError("MISSING_CREDENTIAL")` rather than generating a malformed payload.

---

## 4. Verification & Validation Steps

1. Run `pnpm --filter frontend typecheck` to confirm strict TypeScript compliance.
2. Run `pnpm --filter frontend build` to verify clean production compilation.
3. Run `bash scripts/check-hardcoded.sh` to ensure zero hardcoded constants or secrets.
4. Execute full in-browser test:
   - Navigate to `http://localhost:5173/verifier`, create an employment verification request for MBBS + Age $\ge 21$.
   - Open generated `/wallet/respond?request=<id>`.
   - Click "Authorize & Sign Zero-Knowledge Presentation".
   - Watch the multi-step progress modal complete in < 2 seconds.
   - Confirm verification result shows `accepted` on both the respond page and the verifier portal.
