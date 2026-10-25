# V1-S5 Plan: Student Wallet Respond Page Shell

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1-S5`  
> **Branch:** `sparsh/V1-S5-wallet-respond`  
> **Target:** `dev`  
> **Objective:** Deliver the Student Wallet presentation consent and disclosure shell (`/wallet/respond?request=<id>`). The page consumes a zero-knowledge presentation request, matches required credentials against the student's local IndexedDB wallet, categorizes all fields into a 3-tier privacy consent breakdown (*Selectively Disclosed*, *Zero-Knowledge Proven*, *Never Collected*), and enforces explicit student authorization.

---

## 1. Context & Role in the Hackathon Demo

In the Cascade '26 end-to-end demo flow (`md/MVP-SCOPE.md` §3 and `md/FLOWS.md` §1 Step 9–10):
1. **Employer / Verifier** generates a zero-knowledge presentation request link (e.g. `http://localhost:5173/wallet/respond?request=<id>`).
2. **Student ("Asha")** opens this link in her browser or scans a QR code.
3. **Wallet Respond Page** acts as the cryptographic privacy gateway:
   - Fetches the presentation request and policy from `GET /presentation-requests/{id}`.
   - Inspects the student's local IndexedDB storage (`getStoredCredentials()`) for matching credentials (e.g. `Degree`, `MedicalLicense`, `GovernmentId`).
   - Presents a clear, human-readable **Consent Breakdown**:
     - **Disclosed Attributes**: BBS+ selectively disclosed fields (e.g. `degree_name`, `institution`, `graduation_year`).
     - **Zero-Knowledge Attributes**: Groth16 range proofs (e.g. Age $\ge 21$) where actual values (DOB) are never revealed.
     - **Never-Collected Attributes**: Sensitive PII strictly prevented from leaving the device (`holder_name`, `dob`, `address`).
   - Shows matching local credential previews with validity and revocation status indicators.
   - Houses the **"Sign & Share Proof"** action button (disabled in V1 with clean notification, fully wired to in-browser zk-SNARK / BBS proof generation in `V1.1-S1`).

---

## 2. Strict Rules & Constraints

1. **Folder Ownership (`AGENTS.md` §1)**:
   - SPARSH owns: `frontend/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never touch `backend/`, `packages/zk-core/`, `contracts/`, or `circuits/`.
2. **Zero Hardcoded Data (`AGENTS.md` §2)**:
   - Request data loaded strictly via `usePresentationRequest(requestId)`.
   - Student credentials loaded strictly from local IndexedDB via `@/lib/wallet-store.ts`.
   - No mock policies or sample credentials.
3. **Crypto Safety (`AGENTS.md` §1.1)**:
   - Only files in `frontend/src/lib/` import `@zkred/zk-core`.
   - Component logic consumes `wallet-store.ts` helpers.
4. **Zero-Knowledge Privacy Preservation**:
   - The student must clearly see that their sensitive PII is **guaranteed never to leave the browser**.

---

## 3. Architecture & File Breakdown

```text
Cascade/
├─ frontend/src/features/wallet/
│  ├─ pages/
│  │  └─ WalletRespondPage.tsx     # Route component for /wallet/respond?request=<id>
│  └─ components/
│     ├─ ConsentScreen.tsx         # 3-Tier disclosure visualizer & policy inspector
│     └─ CredentialMatchBadge.tsx  # Matching local credential cards & readiness status
├─ docs/
│  ├─ plan.md                      # This execution plan
│  └─ implementation.md            # Detailed specification
└─ md/progress/
   └─ SPARSH-PROGRESS.md           # Progress log
```

---

## 4. Phased Execution Steps

### Phase 1: Presentation Request Ingestion & Error Handling
- Parse `request` query parameter from URL via `useSearchParams()`.
- Query `usePresentationRequest(requestId)` from `@/api/queries/verifiers`.
- Implement robust state handling:
  - **Loading**: Animated pulse skeleton.
  - **Missing / Invalid ID**: Friendly empty state with navigation back to `/wallet`.
  - **Expired / Nonce Consumed**: Standard error message from `toUserMessage()`.

### Phase 2: Local Credential Matching & Wallet Binding
- Query local IndexedDB credentials using `getStoredCredentials()`.
- Compare each requirement in `request.policy.requirements` against stored credentials:
  - Check by `credential_type` (e.g. `Degree`, `MedicalLicense`, `GovernmentId`).
  - Flag whether student holds an eligible credential for every requirement.
  - Render matching status chips: *"✓ Eligible Degree in wallet"* or *"✗ Missing required credential"*.

### Phase 3: The 3-Tier Consent Breakdown (`ConsentScreen.tsx`)
- Display verifier identity (`verifier_name`), creation timestamp, and expiry time.
- Display explicit verification purpose (`policy.purpose`) and plain-language student consent statement (`consent_summary`).
- **Tier 1 — Selectively Disclosed Fields**:
  - List all fields from `requirement.reveal` (e.g. `degree_name`, `institution`).
- **Tier 2 — Proven in Zero-Knowledge (Groth16 zk-SNARK)**:
  - Highlight predicates (e.g. *"Age ≥ 21 Range Proof"*), issuer accreditation requirements, and Merkle tree batch membership.
- **Tier 3 — Never Disclosed / Stays on Device**:
  - Highlight fields from `policy.never_collect` (`holder_name`, `dob`, `address`).

### Phase 4: Share Action Bridge to V1.1
- If local credentials do not satisfy requirements:
  - Disable "Share Proof" button with explanation: *"Incomplete credentials in wallet"*.
- If local credentials satisfy requirements:
  - In V1, full in-browser Circom WASM proof generation is staged for V1.1 (`V1.1-S1`).
  - Render an active, interactive "Sign & Authorize Proof" button that provides an informative preview modal/banner confirming all consent checks pass and proof generation pipeline is ready.

---

## 5. Verification & Validation Checklist
- [ ] `pnpm --filter frontend typecheck` passes with zero errors.
- [ ] `pnpm --filter frontend build` builds cleanly.
- [ ] `bash scripts/check-hardcoded.sh` passes with code 0.
- [ ] Browser testing:
  - Navigate to `/wallet/respond` with no param $\to$ shows empty state.
  - Create a presentation request in `/verifier` $\to$ copy link $\to$ open in `/wallet/respond?request=<id>`.
  - Verifies purpose, 3-tier consent breakdown, local credential matching, and privacy guarantee.
