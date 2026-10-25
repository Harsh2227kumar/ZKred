# V1.1-S2 Plan: Verifier Evaluation Chain Visualizer & Judge-Facing Result Screen

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S2` ⭐  
> **Branch:** `sparsh/V1.1-S2-eval-chain`  
> **Target:** `dev`  
> **Objective:** Deliver the primary judge-facing evaluation result screen on `/verifier/requests/:requestId`. Implements the **Evaluation Chain Visualizer** featuring 4 sequential nodes per policy requirement (`Issuer BBS+ Signature` → `Zero-Knowledge Claim` → `On-Chain Revocation` → `Key-Epoch / Batch Anchor`) converging into the final "Verified Portable Credential" badge. Ensures red failed nodes display human-friendly diagnostic explanations, renders revealed attributes, embeds a high-impact "Never Received: Name, DOB, Address" privacy panel, and provides an interactive QR code for mobile respondent flows.

---

## 1. Context & Role in Demo

In Problem Statement 3 (CASCADE '26), judges evaluate whether credentials are truly user-controlled, zero-knowledge, and tamper-resistant under key breach scenarios.
The **Verifier Result Page** (`/verifier/requests/:requestId`) is the climactic **judge-facing screen**:
1. **Interactive Evaluation Pipeline**:
   - For every requirement in the presentation policy (e.g. AIIMS MBBS Degree, MMC Medical License, UIDAI Age $\ge 21$):
     - **Node 1: Issuer Signature** — Proves the BBS+ signature is mathematically valid under an accredited institution's active key.
     - **Node 2: Zero-Knowledge Claim** — Proves attribute criteria (Age $\ge 21$) via Groth16 zk-SNARK or selective disclosure matching without revealing raw PII.
     - **Node 3: On-Chain Revocation** — Checks the 16k status list bitstring hash against the immutable on-chain hash pinned on Base Sepolia.
     - **Node 4: Key-Epoch & Batch Anchor** — Verifies batch Merkle root inclusion at block time, ensuring issuance occurred before any compromise cutoff.
2. **Friendly Diagnosis for Failed Checks**:
   - If a credential is forged, revoked, or anchored inside a breach window, the specific failed node turns red with crystal-clear human explanations (e.g. `KEY_COMPROMISED_ANCHORED_IN_WINDOW` → *"Anchored after the key's compromise cutoff during the 48-hour breach window"*).
3. **Ironclad Privacy Invariant Display**:
   - Explicitly displays the **"Never Received by Verifier"** panel highlighting that Name, Date of Birth, and Home Address were never transmitted over the wire.
4. **Live Polling & Mobile Engagement**:
   - Embeds a sleek QR code (`qrcode.react`) so judges can open the request on their mobile phones while the screen polls every 2 seconds and animates upon submission.

---

## 2. Strict Rules & Constraints (`AGENTS.md`)

1. **Folder Ownership (`AGENTS.md` §1)**:
   - SPARSH owns: `frontend/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never edit backend or smart contracts.
2. **Zero Hardcoded Data (`AGENTS.md` §2)**:
   - Data consumed exclusively via `usePresentationRequest` and `useVerifications`.
   - Steps and statuses mirror `md/CONTRACTS.md` §2 and `/meta/enums`.
   - Zero mock verification results.
3. **Rich Aesthetics & WOW Factor**:
   - Premium dark-mode glassmorphic styling (#130e24, #090614, #231a3d borders).
   - Curated palette: Teal (#06838d), Mint (#79bab6), Emerald (#10b981), Rose (#fb7185).
   - Smooth animated stage connectors and hover states.

---

## 3. Architecture & File Breakdown

```text
frontend/src/features/verifier/
├── components/
│   ├── EvalChainVisualizer.tsx       # 4-node evaluation chain per requirement & status connectors
│   ├── StepErrorDiagnosis.ts         # Code-to-friendly-text mapping for all 17 verification error codes
│   ├── PrivacyInvariantPanel.tsx     # High-impact "Never Received: Name, DOB, Address" breakdown
│   ├── VerificationQRCodeModal.tsx   # Interactive modal/card rendering QR code for mobile respondent flow
│   └── VerificationStages.tsx        # Orchestrates live polling & links into EvalChainVisualizer
└── pages/
    └── RequestDetailPage.tsx         # Route component with breadcrumbs, policy spec, and judge screen
```

---

## 4. Verification & Testing Gates

1. **Automated Quality Checks**:
   - `pnpm --filter frontend typecheck`: 0 errors.
   - `pnpm --filter frontend build`: Clean production bundle.
   - `bash scripts/check-hardcoded.sh`: OK.
2. **Demo Verification Flow**:
   - Verify that polling accurately picks up presentations submitted by Asha or Rohan.
   - Confirm all 4 evaluation nodes render green on valid presentations.
   - Verify that all revealed fields match policy specifications.
   - Verify that mobile QR code encodes the valid `wallet_url`.
