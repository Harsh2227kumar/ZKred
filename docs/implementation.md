# V1.1-S2 Implementation Specification: Verifier Eval Chain Visualizer & Judge Screen

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S2` ⭐  
> **Target Files:**
> - `frontend/src/features/verifier/components/StepErrorDiagnosis.ts`
> - `frontend/src/features/verifier/components/EvalChainVisualizer.tsx`
> - `frontend/src/features/verifier/components/PrivacyInvariantPanel.tsx`
> - `frontend/src/features/verifier/components/VerificationStages.tsx`
> - `frontend/src/features/verifier/pages/RequestDetailPage.tsx`
> - `md/progress/SPARSH-PROGRESS.md`

---

## 1. Technical Architecture & Component Hierarchy

```
RequestDetailPage.tsx
├── Request Header & Verifier Metadata
├── Presentation Policy Specification Card
├── VerificationStages.tsx
│   ├── Live Status Banner & 2s Polling Indicator
│   ├── EvalChainVisualizer.tsx (The 4-Node Pipeline per Requirement)
│   │   ├── Requirement Card Header
│   │   ├── 4 Connected Nodes:
│   │   │   ├── Node 1: Issuer BBS+ Signature
│   │   │   ├── Node 2: Zero-Knowledge Claim (Groth16 / Merkle)
│   │   │   ├── Node 3: On-Chain Revocation Status
│   │   │   └── Node 4: Key-Epoch & Batch Anchor
│   │   └── Step Diagnosis Callout (maps error code → friendly explanation)
│   ├── PrivacyInvariantPanel.tsx
│   │   ├── "Never Received: Name, DOB, Address" (Client-Side Invariants)
│   │   └── "Selectively Disclosed Attributes" (Revealed Claims)
│   └── Shareable Wallet QR Card (rendered via `qrcode.react`)
```

---

## 2. Component Specifications

### 2.1 Error Code Diagnosis Helper (`StepErrorDiagnosis.ts`)

Maps all 17 verification step failure codes defined in `md/CONTRACTS.md` and `backend/src/core/verifier.ts` to user-friendly, judge-ready explanations:

```ts
export interface StepErrorDetail {
  title: string;
  explanation: string;
  recommendation: string;
}

export const STEP_ERROR_MAP: Record<string, StepErrorDetail> = {
  BBS_INVALID: {
    title: "Signature Proof Mismatch or Replay",
    explanation: "The BBS+ signature proof is invalid or was generated for a different request nonce.",
    recommendation: "Ensure the presentation was generated directly for this active request nonce.",
  },
  ISSUER_UNKNOWN: {
    title: "Unregistered Issuer",
    explanation: "The issuing institution is not registered in the institutional registry or on Base Sepolia.",
    recommendation: "Credentials must originate from an institution in IssuerRegistry.",
  },
  ISSUER_NOT_ACCREDITED: {
    title: "Issuer Lacks Accreditation",
    explanation: "The issuing institution lacks active on-chain accreditation by the governing accreditor.",
    recommendation: "Verification policy requires credentials from accredited institutions.",
  },
  ISSUER_NOT_ALLOWED: {
    title: "Unauthorized Institution",
    explanation: "This credential was issued by an authority not included in the verifier's allowed list.",
    recommendation: "Submit credentials issued by an authorized university or medical council.",
  },
  KEY_UNKNOWN: {
    title: "Signing Key Not Recognized",
    explanation: "The signing key does not belong to the claimed issuer or is missing on Base Sepolia.",
    recommendation: "Issuer must publish their BLS12-381 key on-chain before issuance.",
  },
  PUBKEY_HASH_MISMATCH: {
    title: "Key Hash Discrepancy",
    explanation: "The published public key does not match the cryptographic hash stored in the smart contract.",
    recommendation: "Possible MITM or key tampering detected.",
  },
  POLICY_FIELD_MISSING: {
    title: "Required Field Withheld",
    explanation: "A field required by the verification policy was not disclosed in the presentation.",
    recommendation: "Holder must disclose all attributes requested by the verifier.",
  },
  POLICY_EQUALS_FAILED: {
    title: "Qualification Criteria Not Met",
    explanation: "Disclosed credential attribute value does not match the required policy value.",
    recommendation: "Submit a credential satisfying the exact degree or qualification specified.",
  },
  AGE_PROOF_INVALID: {
    title: "zk-SNARK Range Proof Invalid",
    explanation: "The zero-knowledge Groth16 age proof failed mathematical circuit verification.",
    recommendation: "Circuit proof must verify under the committed verification key.",
  },
  AGE_COMMITMENT_MISMATCH: {
    title: "Commitment Binding Mismatch",
    explanation: "The age proof was computed on a different commitment than the one signed by UIDAI.",
    recommendation: "Proof must bind directly to the signed dob_commitment.",
  },
  AGE_PROOF_STALE_DATE: {
    title: "Proof Cutoff Date Expired",
    explanation: "The calendar cutoff in the proof does not satisfy today's age requirement.",
    recommendation: "Generate a fresh proof with today's calendar date.",
  },
  REVOCATION_LIST_TAMPERED: {
    title: "Revocation List Discrepancy",
    explanation: "The published status list does not match the root hash published on the blockchain.",
    recommendation: "Issuer status registry synchronization error.",
  },
  REVOKED: {
    title: "Credential Revoked on Base Sepolia",
    explanation: "The issuer has revoked this credential in the on-chain status registry.",
    recommendation: "Contact the issuing institution for credential re-issuance.",
  },
  BATCH_NOT_ANCHORED: {
    title: "Issuance Batch Not Anchored",
    explanation: "The credential's issuance batch was never anchored on Base Sepolia or was anchored under another key.",
    recommendation: "Issuers must anchor open batches before credentials can be verified.",
  },
  MERKLE_PROOF_INVALID: {
    title: "Merkle Tree Inclusion Failure",
    explanation: "The credential's Poseidon commitment does not exist in the anchored Merkle root.",
    recommendation: "Credential commitment is not part of the anchored batch.",
  },
  KEY_COMPROMISED_ANCHORED_IN_WINDOW: {
    title: "Compromised During Breach Window",
    explanation: "Credential was anchored inside the 48-hour key compromise window. It cannot be trusted without re-issuance.",
    recommendation: "Holder must use the Wallet Refresh feature to obtain a safe, re-issued credential.",
  },
  CHAIN_UNAVAILABLE: {
    title: "Base Sepolia Connection Failure",
    explanation: "Base Sepolia RPC connection failed. The verifier engine fails closed to prevent forged proofs.",
    recommendation: "Retry when the blockchain network connection stabilizes.",
  },
};
```

---

### 2.2 Eval Chain Visualizer Component (`EvalChainVisualizer.tsx`)

Renders a visually connected pipeline for each policy requirement:
- Displays each requirement's title and status badge.
- Draws 4 sequential nodes connected with pipeline lines:
  - `Node 1: Issuer Signature`
  - `Node 2: Zero-Knowledge Claim`
  - `Node 3: Revocation Status`
  - `Node 4: Key-Epoch & Batch Anchor`
- Each node indicates:
  - Numeric stage number & icon.
  - Green checkmark for passed stages / Red X for failed stages.
  - Informative subtitle explaining what was verified.
- If a step failed:
  - Emits an informative alert box detailing the friendly explanation, error code, and security implications.
- Convergence:
  - Below the requirement chains, renders the grand **"Verified Portable Credential"** badge.

---

### 2.3 Privacy Invariant Panel (`PrivacyInvariantPanel.tsx`)

A high-contrast side-by-side or stacked card demonstrating ZK privacy guarantees:
- **Left/Top:** Red Lock Section — "Never Received by Verifier (Zero-Knowledge Invariant)"
  - Lists protected attributes that never left the holder's browser:
    - 🔒 `holder_name` (Legal Name)
    - 🔒 `dob` (Birthdate)
    - 🔒 `address` (Home Address)
    - 🔒 `dob_salt` (Blinding Factor)
- **Right/Bottom:** Green Check Section — "Selectively Disclosed Attributes"
  - Displays each disclosed attribute from `verification.revealed` in readable cards.

---

### 2.4 Mobile QR Code Integration

- Incorporates `<QRCodeSVG value={request.wallet_url} size={140} />` inside `VerificationStages.tsx` alongside the respondent link.
- Provides a "Scan on Mobile Phone" prompt so judges can experience the respondent flow on their personal devices while watching the live polling screen update in real time.

---

## 3. Invariants & Verification Checklist

1. [x] Clean dependency imports (consumes `qrcode.react`, TanStack query hooks, `Hex`, and UI icons).
2. [x] Zero hardcoded data (`scripts/check-hardcoded.sh` passes).
3. [x] Strict TypeScript typing without `any`.
4. [x] Responsive on mobile, tablet, and widescreen viewports.
5. [x] Verified against live Base Sepolia credentials.
