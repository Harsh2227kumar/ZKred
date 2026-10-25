# V1-S3 Implementation Specification: Verifier Portal

> **Owner:** SPARSH  
> **Task ID:** `V1-S3`  
> **Branch Target:** `sparsh/V1-S3-verifier-portal`

---

## 1. File & Component Breakdown

```text
frontend/src/
├── api/queries/
│   └── verifiers.ts             # useVerifiers, useCreateVerifier, useParsePolicy, useCreateRequest, usePresentationRequest, useVerifications
└── features/verifier/
    ├── components/
    │   ├── CreateVerifierModal.tsx   # Modal to register a new verifier identity (POST /verifiers)
    │   ├── ManualPolicyBuilder.tsx   # Visual policy builder (purpose, requirements, reveals, age predicate, never_collect)
    │   └── VerificationStages.tsx    # 4-stage pipeline visualization nodes
    └── pages/
        ├── VerifierPage.tsx          # Verifier dashboard & request creation
        └── RequestDetailPage.tsx    # Live request inspection & 2s verification polling
```

---

## 2. Technical Specifications

### 2.1 API Queries & Mutations (`api/queries/verifiers.ts`)
- `useVerifiers()`: Calls `GET /verifiers`.
- `useCreateVerifier()`: Calls `POST /verifiers` with `{ name }`.
- `useParsePolicy()`: Calls `POST /presentation-requests/parse` with `{ text }`. Catches `501/502` errors to trigger manual builder fallback.
- `useCreateRequest()`: Calls `POST /presentation-requests` with `{ verifier_id, policy, nl_text }`.
- `usePresentationRequest(id)`: Calls `GET /presentation-requests/{id}`.
- `useVerifications(requestId)`: Calls `GET /presentation-requests/{requestId}/verifications` with `refetchInterval: 2000`.

### 2.2 Manual Policy Builder (`ManualPolicyBuilder.tsx`)
Constructs `PresentationPolicy`:
```ts
{
  purpose: string;
  requirements: [
    {
      id: "r1";
      credential_type: "Degree" | "MedicalLicense" | "GovernmentId";
      accredited_only: boolean; // default true
      issuer_kinds: null;
      issuer_dids: null;
      reveal: string[]; // e.g. ["degree_name", "institution", "graduation_year"]
      equals: [];
      predicates: [{ type: "age_gte", years: 21 }];
      require_not_revoked: boolean; // default true
    }
  ];
  never_collect: ["holder_name", "dob", "address"];
}
```

### 2.3 Real-Time Polling & Presentation Status (`RequestDetailPage.tsx`)
- Polls `GET /presentation-requests/{id}/verifications` every 2 seconds.
- In V1, the backend returns `{ items: [] }`.
- UI renders an active waiting badge with spinning timer and glowing pulse: *"Awaiting holder presentation from student wallet"*.
- Displays the 4 deterministic evaluation stages:
  1. `issuer_signature` (BBS+ verification)
  2. `zk_claim` (Groth16 age proof)
  3. `revocation_status` (W3C bitstring list check)
  4. `key_epoch_anchor` (Merkle batch root on Base Sepolia)

---

## 3. Step-by-Step Execution Plan

1. **Step 1**: Add Verifier and PresentationRequest types to `frontend/src/api/schemas.ts`.
2. **Step 2**: Implement `frontend/src/api/queries/verifiers.ts`.
3. **Step 3**: Implement `CreateVerifierModal.tsx` and `ManualPolicyBuilder.tsx`.
4. **Step 4**: Implement `VerificationStages.tsx`.
5. **Step 5**: Update `VerifierPage.tsx` to mount verifier selector, NL compiler with 501 fallback, and manual policy builder.
6. **Step 6**: Update `RequestDetailPage.tsx` to display request details, copyable wallet link, and 2s polling status.
7. **Step 7 (Verification & Testing)**:
   - `pnpm --filter frontend typecheck`
   - `pnpm --filter frontend build`
   - `bash scripts/check-hardcoded.sh`
   - Interactive browser verification.
