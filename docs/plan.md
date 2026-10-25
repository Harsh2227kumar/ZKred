# V1-S3 Plan: Verifier Portal

> **Owner:** SPARSH  
> **Task:** `V1-S3` — Verifier Portal  
> **Goal:** Verifier identity selection/creation, presentation request builder (NL parse with graceful 501 fallback + dynamic manual policy builder), and real-time verification polling.

---

## 1. Scope & Deliverables

1. **Verifier Identity**:
   - Selector for existing verifiers via `GET /verifiers`.
   - "New Verifier" dialog calling `POST /verifiers` (`{ name }`).

2. **Presentation Request Creation**:
   - Natural language input calling `POST /presentation-requests/parse`:
     - Gracefully catches `501 NOT_IMPLEMENTED` or `502 AI_UNAVAILABLE`.
     - Displays informative alert banner and reveals the **Manual Policy Builder**.
   - Manual Policy Builder:
     - `purpose`: verification intent string.
     - Requirements list (`requirements[]`):
       - `credential_type`: selection from `/meta/credential-schemas`.
       - `accredited_only`: boolean toggle (default true).
       - `reveal`: field checkboxes from `schema.fields`.
       - `predicates`: optional age predicate (`age_gte`, years threshold e.g. 21).
       - `require_not_revoked`: boolean toggle (default true).
     - `never_collect`: chips displaying protected PII (`holder_name`, `dob`, `address`).
   - Submits `POST /presentation-requests` (`{ verifier_id, policy, nl_text }`).

3. **Request Inspection & Live Polling (`/verifier/requests/:requestId`)**:
   - Displays Request ID, Nonce, Verifier Name, Expiration timer, and Shareable Wallet URL (`/wallet/respond?request=<id>`).
   - Copy button for wallet response URL.
   - Polls `GET /presentation-requests/{id}/verifications` every 2 seconds (`refetchInterval: 2000`).
   - In V1, shows active pulse waiting state: *"Awaiting holder submission from student wallet..."* with the 4 pipeline stage cards (Signature, ZK Claim, Revocation, Key-Epoch/Anchor).

---

## 2. Conflict-Prevention Strategy

1. **Folder Ownership Boundary**:
   - Edit ONLY `frontend/src/features/verifier/`, `frontend/src/api/queries/verifiers.ts`, `docs/`, and `md/progress/SPARSH-PROGRESS.md`.
   - Zero changes to backend, contracts, circuits, or zk-core.
2. **Dedicated Branch**: `sparsh/V1-S3-verifier-portal`.

---

## 3. Verification & Acceptance Checklist

- [ ] Verifier selector lists existing verifiers from `GET /verifiers`.
- [ ] New verifier creation dialog registers verifier via `POST /verifiers`.
- [ ] NL parse button handles `501/502` without crashing and activates manual policy builder.
- [ ] Manual policy builder allows configuring purpose, required credentials, revealed fields, and age predicate.
- [ ] Presentation request creates successfully via `POST /presentation-requests` and returns shareable wallet URL.
- [ ] `/verifier/requests/:requestId` polls `GET .../verifications` every 2 seconds and displays the 4-stage pipeline visualizer.
- [ ] `pnpm --filter frontend typecheck` passes (0 errors).
- [ ] `pnpm --filter frontend build` passes.
- [ ] `bash scripts/check-hardcoded.sh` passes.
- [ ] Interactive browser test of verifier creation, manual policy request compilation, and result polling.
