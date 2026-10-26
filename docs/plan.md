# V1.1-S1 Plan: Student Wallet Live Presentation Prover & Submission

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S1` ⭐  
> **Branch:** `sparsh/V1.1-S1-respond-flow`  
> **Target:** `dev`  
> **Objective:** Turn the Wallet Respond page shell (`/wallet/respond?request=<id>`) into a fully functional in-browser Zero-Knowledge presentation generator and submission engine. The student reviews the 3-tier privacy breakdown, confirms disclosure, and executes real in-browser BBS+ selective disclosure, Merkle batch inclusion proofs, Groth16 zk-SNARK age proofs, and submits the cryptographic presentation to `POST /presentation-requests/{id}/presentations`.

---

## 1. Context & Role in Demo

In the Cascade '26 Hackathon demo (`md/MVP-SCOPE.md` §3, `md/FLOWS.md` Step 9–10):
1. **Verifier** (e.g., Apollo Hospitals) issues a request asking for:
   - `Degree` from accredited institution (revealing `degree_name = MBBS`)
   - `MedicalLicense` (revealing `license_type = Physician & Surgeon`, checking not revoked)
   - `GovernmentId` proving **Age $\ge 21$** without disclosing Date of Birth or name.
2. **Student ("Asha")** opens `/wallet/respond?request=<id>`:
   - Reviews the privacy guarantees (Disclosed fields vs ZK-proven vs Never-collected PII).
   - Hits **"Authorize & Sign Zero-Knowledge Presentation"**.
3. **In-Browser Execution Engine (`frontend/src/lib/zk.ts`)**:
   - Fetches batch leaves from `GET /batches/{id}/leaves` to generate Merkle proofs.
   - Fetches issuer public keys from `GET /issuers`.
   - Downloads Groth16 WASM and zkey artifacts from `VITE_ZK_ARTIFACTS_BASE_URL` (`/zk/age_gte.wasm`, `age_gte.zkey`).
   - Runs `createPresentation(...)`:
     - Derives blinded BBS+ signatures bound to the 32-byte request nonce.
     - Computes Merkle inclusion proof for each credential's Poseidon commitment.
     - Generates Groth16 zk-SNARK proof that `dob_days <= cutoff_days` on the signed `dob_commitment`.
4. **Submission**:
   - Submits `Presentation` to `POST /presentation-requests/{id}/presentations`.
   - Displays real-time 4-step progress:
     1. Resolving On-Chain Issuers & Batch Anchors
     2. Deriving Blinded BBS+ Signatures
     3. Generating Groth16 zk-SNARK Age Proof
     4. Submitting Cryptographic Presentation
   - Receives instant verification verdict from the backend evaluation engine and shows the accepted result with link to the verifier view.

---

## 2. Strict Rules & Constraints (`AGENTS.md`)

1. **Folder Ownership (`AGENTS.md` §1)**:
   - SPARSH owns: `frontend/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never edit files in `backend/`, `packages/zk-core/`, `contracts/`, or `circuits/`.
2. **Crypto Safety (`AGENTS.md` §1.1)**:
   - Only `frontend/src/lib/zk.ts` imports `@zkred/zk-core`.
   - React components call `createPresentation(...)` and `unwrap(submitPresentation(...))` helpers; components never import snarkjs or bbs directly.
3. **Zero Hardcoded Data (`AGENTS.md` §2)**:
   - All batch leaves, issuer keys, and requests are queried from live API endpoints.
   - ZK artifacts downloaded from `config.zkArtifactsBaseUrl`.
   - Zero mock presentations or simulated passing results. Fail closed on network/crypto error.
4. **Non-Blocking User Experience**:
   - Proving status must be visually animated with human-friendly step indicators and time estimates (< 3 seconds total proving time).

---

## 3. Architecture & File Plan

```text
frontend/src/
├── api/
│   └── queries/
│       ├── issuers.ts            # Add useBatchLeaves / fetchBatchLeaves query helper
│       └── verifiers.ts          # useSubmitPresentation mutation
├── lib/
│   └── zk.ts                     # Existing secure wrapper around @zkred/zk-core
└── features/
    └── wallet/
        ├── pages/
        │   └── WalletRespondPage.tsx  # Handles request resolution & completion transitions
        └── components/
            ├── ConsentScreen.tsx      # Hosts proof triggers, interactive confirmation modal
            ├── ProvingProgressModal.tsx # Multi-stage ZK proving modal with live spinners
            └── PresentationResultCard.tsx # Post-submission result badge & verification details
```

---

## 4. Testing & Verification Gates

1. **Gate G1/G2 Alignment**:
   - Proving time on Asha's 3 credentials (Degree + MedicalLicense + GovernmentId) must be < 3 seconds on a laptop.
   - Submitting presentation consumes request nonce and returns `result: "accepted"` with all 4 stages green.
2. **Automated Quality Checks**:
   - `pnpm --filter frontend typecheck`: 0 errors.
   - `pnpm --filter frontend build`: Clean production bundle.
   - `bash scripts/check-hardcoded.sh`: OK.
