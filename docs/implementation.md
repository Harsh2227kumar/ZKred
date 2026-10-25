# V1-S4 Implementation Specification: Seed Pipeline v1

> **Module:** `scripts/` & `seed/`  
> **Task ID:** `V1-S4`  
> **Owner:** SPARSH  
> **Status:** Implementation Draft

---

## 1. Directory Structure

```text
Cascade/
├── seed/
│   ├── issuers.json
│   ├── holders.json
│   ├── credentials.json
│   └── verifiers.json
└── scripts/
    ├── package.json
    ├── tsconfig.json
    ├── config.ts
    ├── seed.ts
    └── .env.example
```

---

## 2. Seed Data Specifications

### 2.1 `seed/issuers.json`
Specifies on-chain institutional issuers conforming to `CONTRACTS.md` §3.1:
```json
[
  {
    "name": "All India Institute of Medical Sciences, Nagpur",
    "kind": "university",
    "did_suffix": "aiimsn"
  },
  {
    "name": "Indian Institute of Information Technology, Nagpur",
    "kind": "university",
    "did_suffix": "iiitn"
  },
  {
    "name": "Maharashtra Medical Council",
    "kind": "medical_council",
    "did_suffix": "mmc"
  },
  {
    "name": "Unique Identification Authority of India",
    "kind": "government",
    "did_suffix": "uidai"
  }
]
```

### 2.2 `seed/holders.json`
Specifies the canonical demo applicant "Asha":
```json
[
  {
    "display_name": "asha",
    "full_name": "Dr. Asha Sharma"
  }
]
```

### 2.3 `seed/credentials.json`
Specifies the 3 required credentials conforming strictly to `CREDENTIAL_LAYOUTS`:
```json
[
  {
    "issuer_did_suffix": "aiimsn",
    "credential_type": "Degree",
    "recipient_display_name": "asha",
    "claims": {
      "holder_name": "Dr. Asha Sharma",
      "degree_name": "MBBS",
      "major": "Medicine and Surgery",
      "institution": "AIIMS Nagpur",
      "graduation_year": 2024,
      "grade": "Distinction"
    }
  },
  {
    "issuer_did_suffix": "mmc",
    "credential_type": "MedicalLicense",
    "recipient_display_name": "asha",
    "claims": {
      "holder_name": "Dr. Asha Sharma",
      "license_type": "Physician & Surgeon",
      "registration_no": "MMC-2024-9982",
      "council": "Maharashtra Medical Council",
      "valid_until": "2029-12-31",
      "license_status": "active"
    }
  },
  {
    "issuer_did_suffix": "uidai",
    "credential_type": "GovernmentId",
    "recipient_display_name": "asha",
    "claims": {
      "holder_name": "Dr. Asha Sharma",
      "dob": "2000-05-15",
      "address": "Civil Lines, Nagpur, Maharashtra",
      "nationality": "Indian"
    }
  }
]
```

### 2.4 `seed/verifiers.json`
Specifies the evaluating verifiers:
```json
[
  {
    "name": "Apollo Hospitals - Medical Verification Board"
  },
  {
    "name": "State Health Recruitment Service"
  }
]
```

---

## 3. Configuration Contract (`scripts/config.ts`)

Per `AGENTS.md` §2, `scripts/config.ts` is the **single anchor** reading `process.env`.
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root if available
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export interface SeedConfig {
  apiBaseUrl: string;
  adminToken: string;
  walletPassphrase: string;
}

function loadConfig(): SeedConfig {
  const apiBaseUrl = process.env.SEED_API_BASE_URL || process.env.PUBLIC_BASE_URL
    ? `${process.env.PUBLIC_BASE_URL}/api/v1`
    : 'http://localhost:8080/api/v1';

  const adminToken = process.env.SEED_ADMIN_TOKEN || process.env.ISSUER_ADMIN_TOKEN || '';
  const walletPassphrase = process.env.SEED_WALLET_PASSPHRASE || 'AshaSecurePassphrase2026!';

  if (!adminToken) {
    console.warn('[seed] WARNING: SEED_ADMIN_TOKEN is unset. Issuer creation/issuance may fail if auth is enforced.');
  }

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    adminToken,
    walletPassphrase,
  };
}

export const config = loadConfig();
```

---

## 4. Pipeline Logic (`scripts/seed.ts`)

### Phase 1: Health & Connectivity Check
- Performs `GET ${config.apiBaseUrl}/health`.
- Validates that the backend responds with status `ok` or `degraded`.

### Phase 2: Idempotent Issuer Registration
- Performs `GET ${config.apiBaseUrl}/issuers`.
- For each entry in `seed/issuers.json`:
  - Check if `did === "did:zkred:${issuer.did_suffix}"`.
  - If missing, issue `POST ${config.apiBaseUrl}/issuers` with header `X-Issuer-Admin-Token: ${config.adminToken}`.
  - Record the `issuer_id` for credential issuance.

### Phase 3: Idempotent Verifier Registration
- Performs `GET ${config.apiBaseUrl}/verifiers`.
- For each entry in `seed/verifiers.json`:
  - Check if `name === verifier.name`.
  - If missing, issue `POST ${config.apiBaseUrl}/verifiers`.

### Phase 4: Holder Wallet Creation
- Checks `GET ${config.apiBaseUrl}/wallets/lookup?display_name=asha`.
- If 404 (not found):
  - Generate keypair via `walletCrypto.generateWalletKeyPair()`: `{ publicKeyB64, privateKeyJwk }`.
  - Call `POST ${config.apiBaseUrl}/wallets` with `{ display_name: "asha", enc_public_key: publicKeyB64 }`.
  - Obtain `id` and `wallet_token`.
- If already exists:
  - Log that wallet `asha` is registered. (In dev, wallet private key can be re-derived or loaded from local cache).

### Phase 5: Credential Issuance & Batch Anchoring
- For each item in `seed/credentials.json`:
  - Find matching `issuer_id`.
  - Call `POST ${config.apiBaseUrl}/issuers/${issuer_id}/credentials` with `claims`, `wallet_id`, and `credential_type`.
  - Logs resulting `credential_id` and `offer_id`.
- For each issuer:
  - Query `GET ${config.apiBaseUrl}/issuers/${issuer_id}/batches`.
  - Find open batches (`status === 'open' && size > 0`).
  - Call `POST ${config.apiBaseUrl}/issuers/${issuer_id}/batches/${batch_id}/anchor`.

### Phase 6: Offer Decryption & Claiming
- If `wallet_token` and `privateKeyJwk` are available:
  - Call `GET ${config.apiBaseUrl}/wallets/${wallet_id}/offers` with `Authorization: Bearer ${wallet_token}`.
  - For each offer where `claimed_at === null`:
    - Decrypt payload via `walletCrypto.decryptOffer(privateKeyJwk, offer)`.
    - Fetch issuer key and verify BBS+ signature using `verifyCredential()`.
    - Claim offer via `POST ${config.apiBaseUrl}/wallets/${wallet_id}/offers/${offer.id}/claim`.
    - Store credential in memory for backup generation.

### Phase 7: Encrypted Backup Generation
- Call `walletCrypto.encryptBackup(config.walletPassphrase, { wallet_id, credentials }, 100000)`.
- Submit via `PUT ${config.apiBaseUrl}/wallets/${wallet_id}/backup` with `Authorization: Bearer ${wallet_token}`.

---

## 5. Security & Idempotency Rules

1. **Deterministic Execution**:
   - Running the script twice will not crash or insert duplicate issuers, verifiers, or claims.
2. **Zero Plaintext PII on Server**:
   - Offers are encrypted with Asha's ECDH public key before leaving the server.
   - Backups are encrypted with PBKDF2/AES-GCM using `SEED_WALLET_PASSPHRASE` before upload.
3. **No Crypto Implementation in Seed Script**:
   - Strictly uses `@zkred/zk-core` for all BBS+, ECDH, AES-GCM, and PBKDF2 functions.
