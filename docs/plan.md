# V1-S1 Plan: Issuer Console

> **Owner:** SPARSH  
> **Task:** `V1-S1` — Issuer Console  
> **Goal:** Connect `/issuer` and `/issuer/:issuerId` to the real API and Base Sepolia contracts with zero merge conflicts.

---

## 1. Scope & Deliverables

1. **`/issuer` (Institutions Overview)**:
   - Admin token prompt modal (persisted strictly in `sessionStorage`).
   - Institutions list (`GET /issuers`): Name, DID, Kind, Accreditation status, Active Key status.
   - "New Issuer" modal (`POST /issuers`): Kind options from `/meta/enums.issuer_kinds`.

2. **`/issuer/:issuerId` (Management Tabs)**:
   - **Keys Tab**: Table of `keys[]` (`key_id`, status, `active_from`, BaseScan `TxLink`) + "Rotate Key" button (`POST .../keys/rotate`).
   - **Issue Tab**: Dynamic form built from `GET /meta/credential-schemas` for selected type, recipient lookup via `GET /wallets/lookup?display_name=`, submit via `POST /issuers/{id}/credentials`.
   - **Issued Tab**: Table of credentials from `GET /issuers/{id}/credentials` (credential_id, type, wallet_id, batch_id, commitment, status_index; zero PII).
   - **Batches Tab**: Table of batches from `GET /issuers/{id}/batches` (batch_id, size, status, root, `anchored_at`, `TxLink`) + "Anchor" button on open batches (`POST .../batches/{batch_id}/anchor`).

3. **Mutation & State Rules**:
   - Zero optimistic updates: Disable button while pending, show spinner, toast success with BaseScan `TxLink`, show `ErrorState` on failure.
   - Zero hardcoded data: Dropdowns from `/meta/enums`, fields from `/meta/credential-schemas`, explorer URLs from `/meta/chain`.

---

## 2. Merge-Conflict Prevention Strategy

During V0, merge conflicts arose when both developers modified shared paths or touched root configs. For V1-S1:

1. **Strict Folder Boundaries**: Edit ONLY inside `frontend/src/features/issuer/`, `frontend/src/api/queries/issuers.ts`, `docs/`, and `md/progress/SPARSH-PROGRESS.md`.
2. **Zero Shared File Edits**: Do not touch `backend/`, `packages/zk-core/`, `contracts/`, `circuits/`, root `package.json`, or `md/CONTRACTS.md`.
3. **Dedicated Branch**: Branch from `dev` directly as `sparsh/V1-S1-issuer-console`.
4. **Decoupled API Layer**: All issuer queries live in their own file `frontend/src/api/queries/issuers.ts`.

---

## 3. Execution & Verification Checklist

- [ ] **Step 1**: Create dedicated queries in `frontend/src/api/queries/issuers.ts`.
- [ ] **Step 2**: Build modular tab components in `frontend/src/features/issuer/components/`:
  - `AdminTokenPrompt.tsx`
  - `CreateIssuerDialog.tsx`
  - `KeysTab.tsx`
  - `IssueForm.tsx`
  - `IssuedTab.tsx`
  - `BatchesTab.tsx`
- [ ] **Step 3**: Update `IssuerListPage.tsx` and `IssuerDetailPage.tsx` to mount real components.
- [ ] **Step 4 (Validation)**:
  1. `pnpm --filter frontend typecheck` (0 errors).
  2. `pnpm --filter frontend build` (clean bundle).
  3. `bash scripts/check-hardcoded.sh` (OK).
  4. Interactive browser verification on live dev server.
