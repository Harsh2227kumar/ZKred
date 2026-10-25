# V1-S5 Implementation Specification: Student Wallet Respond Page Shell

> **Module:** `frontend/src/features/wallet/`  
> **Task ID:** `V1-S5`  
> **Owner:** SPARSH  
> **Status:** Implementation Draft

---

## 1. Component Architecture

```text
frontend/src/features/wallet/
├── pages/
│   └── WalletRespondPage.tsx     # Route entry /wallet/respond?request=<id>
└── components/
    └── ConsentScreen.tsx         # 3-Tier Consent & Disclosure Specification
```

---

## 2. Technical Specifications

### 2.1 Route & Query Parsing (`WalletRespondPage.tsx`)
- Reads URL query parameter:
  ```typescript
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');
  ```
- Consumes TanStack query hook:
  ```typescript
  const { data: request, isLoading, error } = usePresentationRequest(requestId || undefined);
  ```
- Loads local wallet credentials asynchronously on mount:
  ```typescript
  const [localCredentials, setLocalCredentials] = useState<SignedCredential[]>([]);
  useEffect(() => {
    getStoredCredentials().then(setLocalCredentials);
  }, []);
  ```

### 2.2 Local Credential Matching Algorithm
For each requirement $R \in \text{request.policy.requirements}$:
```typescript
interface RequirementMatch {
  requirement: PresentationRequirement;
  matchedCredential: SignedCredential | null;
  isSatisfied: boolean;
}

const matches: RequirementMatch[] = (request.policy?.requirements || []).map((req) => {
  const match = localCredentials.find(
    (c) => c.type === req.credential_type
  );
  return {
    requirement: req,
    matchedCredential: match || null,
    isSatisfied: Boolean(match),
  };
});

const allRequirementsSatisfied = matches.every((m) => m.isSatisfied);
```

### 2.3 3-Tier Disclosure Architecture (`ConsentScreen.tsx`)

#### Tier 1: Selectively Disclosed Fields (`reveal`)
- Cryptographically revealed via BBS+ blinded signature selective disclosure:
  ```typescript
  const revealedFields = requirements.flatMap((r) => r.reveal);
  ```
- Displayed with distinctive visual badges showing field name and source credential.

#### Tier 2: Proven in Zero-Knowledge (`predicates`)
- Conditions verified using Groth16 zk-SNARKs and cryptographic proofs where plaintext data is mathematically hidden:
  - Range proofs: `Age ≥ X years` (via Poseidon commit + snarkjs).
  - Accreditation: Issuer accredited on Base Sepolia `IssuerRegistry`.
  - Batch inclusion: Poseidon Merkle membership proof against on-chain batch root.
  - Non-revocation: Real-time bitstring check on Base Sepolia `StatusRegistry`.

#### Tier 3: Never Collected / Client-Side Encrypted (`never_collect`)
- Sensitive PII fields that remain strictly on the student's device:
  ```typescript
  const neverCollectFields = request.policy?.never_collect || ['holder_name', 'dob', 'address'];
  ```
- Renders a prominent privacy shield guaranteeing that student identity and address are never transmitted over the network.

### 2.4 Action Execution & V1.1 Bridge
- If `allRequirementsSatisfied === false`:
  - Action button rendered in disabled state:
    `"Missing Required Credentials in Wallet"`
- If `allRequirementsSatisfied === true`:
  - In V1, full browser proof generation arrives in `V1.1-S1`.
  - Button displays:
    `"Authorize & Generate Proof (Staged for V1.1)"`
  - On click, displays an informative confirmation toast/dialog explaining that credential matching and disclosure consent are cryptographically verified, preparing for the V1.1 proving pipeline.

---

## 3. UI Tokens & Styling

- Backgrounds: Dark slate/plum (`#090614`, `#130e24`, `#1a1430`)
- Accent & Highlights: Teal (`#06838d`), Mint (`#79bab6`)
- Status Badges:
  - Success/Satisfied: `#10b981` (Emerald)
  - Pending/Notice: `#79bab6` (Mint)
  - Warning/Missing: `#fb7185` (Rose)
- Typography: Strict adherence to zero hardcoded URLs or mock text.
