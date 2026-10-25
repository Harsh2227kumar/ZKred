# V1-S1 Implementation Specification: Issuer Console

> **Owner:** SPARSH  
> **Task ID:** `V1-S1`  
> **Branch Target:** `sparsh/V1-S1-issuer-console`

---

## 1. File & Component Breakdown

```text
frontend/src/
├── api/queries/
│   └── issuers.ts               # useIssuers, useIssuer, useCreateIssuer, useRotateKey,
│                                # useIssueCredential, useIssuedCredentials, useBatches, useAnchorBatch
└── features/issuer/
    ├── components/
    │   ├── AdminTokenPrompt.tsx # Modal to enter/manage ISSUER_ADMIN_TOKEN in sessionStorage
    │   ├── CreateIssuerDialog.tsx# Modal to register new issuer (name, kind, did_suffix)
    │   ├── KeysTab.tsx          # Key epochs table + Rotate Key mutation
    │   ├── IssueForm.tsx        # Dynamic fields from schemas + recipient lookup + issue mutation
    │   ├── IssuedTab.tsx        # Paginated credentials table (no PII)
    │   └── BatchesTab.tsx       # Batches table + on-chain Anchor mutation
    └── pages/
        ├── IssuerListPage.tsx   # /issuer route
        └── IssuerDetailPage.tsx # /issuer/:issuerId route (4 tabs)
```

---

## 2. Technical Specifications

### 2.1 Admin Token Storage
- Key: `sessionStorage.getItem('zkred_issuer_admin_token')`.
- Headers passed on authenticated requests: `Authorization: Bearer <token>`.
- Token status indicator in page header with clear / re-enter action.

### 2.2 Queries & Mutations (`api/queries/issuers.ts`)
- `useIssuers()`: Calls `GET /issuers`.
- `useIssuer(id)`: Calls `GET /issuers/{id}`.
- `useCreateIssuer()`: Calls `POST /issuers` with `{ name, kind, did_suffix }`.
- `useRotateKey(id)`: Calls `POST /issuers/{id}/keys/rotate`.
- `useIssueCredential(id)`: Calls `POST /issuers/{id}/credentials` with `{ credential_type, wallet_id, claims }`.
- `useIssuedCredentials(id)`: Calls `GET /issuers/{id}/credentials`.
- `useBatches(id)`: Calls `GET /issuers/{id}/batches`.
- `useAnchorBatch(issuerId)`: Calls `POST /issuers/{issuerId}/batches/{batchId}/anchor`.

### 2.3 Dynamic Issue Form Logic (`IssueForm.tsx`)
1. Fetches schemas via `useCredentialSchemas()` (`/meta/credential-schemas`).
2. Dropdown to select credential type (`Degree`, `GovernmentId`, `MedicalLicense`).
3. Recipient input: Debounced search against `GET /wallets/lookup?display_name=`. Shows checkmark with resolved `id` or error if not found.
4. Renders input per field in `schema.fields` where `source == "claim"`:
   - `kind == "date"`: HTML date picker.
   - `kind == "int"`: Number input.
   - `kind == "string"`: Text input.
   - Subtle badge if `field.pii == true` indicating privacy-sensitive claim.

### 2.4 Mutation Safeguards
- Non-optimistic: `isPending` state disables submit button and displays loading spinner.
- Success: Fires `sonner` toast containing BaseScan `TxLink` when `tx_hash` is present.
- Failure: Standard error mapping via `toUserMessage(error)`.

---

## 3. Step-by-Step Execution Plan

1. **Step 1**: Write `frontend/src/api/queries/issuers.ts`.
2. **Step 2**: Implement `AdminTokenPrompt.tsx` and `CreateIssuerDialog.tsx`.
3. **Step 3**: Implement `KeysTab.tsx` and `BatchesTab.tsx`.
4. **Step 4**: Implement `IssueForm.tsx` (dynamic schema fields + wallet lookup) and `IssuedTab.tsx`.
5. **Step 5**: Update `IssuerListPage.tsx` and `IssuerDetailPage.tsx` to mount these components.
6. **Step 6 (Testing & QA)**:
   - Run `pnpm --filter frontend typecheck`.
   - Run `pnpm --filter frontend build`.
   - Run `bash scripts/check-hardcoded.sh`.
   - Verify UI rendering and interactions in browser.
