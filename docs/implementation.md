# V1-S2 Implementation Specification: Student Wallet

> **Owner:** SPARSH  
> **Task ID:** `V1-S2`  
> **Branch Target:** `sparsh/V1-S2-student-wallet`

---

## 1. File & Component Breakdown

```text
frontend/src/
├── lib/
│   ├── wallet-crypto.ts         # Encapsulates all @zkred/zk-core calls (WebCrypto ECDH, decryptOffer, BBS verify, backup)
│   └── wallet-store.ts          # idb-keyval wrapper managing wallet metadata, keys, credentials, and session passphrase
├── api/queries/
│   └── wallets.ts               # useCreateWallet, useOffers, useClaimOffer, useBackup, useSaveBackup
└── features/wallet/
    ├── components/
    │   ├── WalletSetup.tsx      # Create wallet (display name + passphrase) & Restore wallet tabs
    │   ├── WalletInbox.tsx      # Offers list with "Claim & Verify" action
    │   ├── CredentialCard.tsx   # Credential presentation card with selective PII toggle
    │   ├── CredentialList.tsx   # Grid of claimed credentials
    │   └── BackupModal.tsx      # Passphrase prompt when updating/exporting encrypted backup
    └── pages/
        └── WalletPage.tsx       # Master wallet dashboard
```

---

## 2. Technical Specifications

### 2.1 IndexedDB Storage Schema (`idb-keyval`)
- Key `zkred_wallet_meta`: `{ id: string, display_name: string, wallet_token: string }`
- Key `zkred_wallet_key`: `{ privateKeyJwk: JsonWebKey, publicKeyB64: string }`
- Key `zkred_credentials`: `SignedCredential[]` (array of held credentials)

### 2.2 Library Encapsulation (`frontend/src/lib/wallet-crypto.ts`)
Per `AGENTS.md` §8.3, **only files in `lib/` may import `@zkred/zk-core`**:
- `generateWalletKeys()`: Calls `walletCrypto.generateWalletKeyPair()`.
- `decryptAndVerifyOffer(privateKeyJwk, offer, issuerBbsPublicKey)`:
  1. `walletCrypto.decryptOffer(privateKeyJwk, offer)` -> `SignedCredential`.
  2. `verifyCredential(credential, issuerBbsPublicKey)` -> `boolean`.
- `encryptWalletBackup(passphrase, walletPayload)`: Calls `walletCrypto.encryptBackup(passphrase, walletPayload, 100_000)`.
- `decryptWalletBackup(passphrase, backupPayload)`: Calls `walletCrypto.decryptBackup(passphrase, backupPayload)`.

### 2.3 API Integration (`api/queries/wallets.ts`)
- `useCreateWallet()`: Calls `POST /wallets` with `{ display_name, enc_public_key }`.
- `useOffers(walletId, walletToken)`: Calls `GET /wallets/{walletId}/offers` with `Authorization: Bearer <wallet_token>`.
- `useClaimOffer(walletId, walletToken)`: Calls `POST /wallets/{walletId}/offers/{offerId}/claim` with `Authorization: Bearer <wallet_token>`.
- `useBackup(walletId, walletToken)`: Calls `GET /wallets/{walletId}/backup` with `Authorization: Bearer <wallet_token>`.
- `useSaveBackup(walletId, walletToken)`: Calls `PUT /wallets/{walletId}/backup` with `Authorization: Bearer <wallet_token>`.

### 2.4 Privacy & UI Guardrails
- **No plaintext holder PII on servers**: Holder claims are decrypted and verified in the browser only.
- **Selective Disclosure Toggle**: Non-PII fields (`degree_name`, `institution`, `graduation_year`) are displayed immediately. PII fields (`holder_name`, `dob`, `address`) are blurred until the user clicks *"Show on this device"*.
- **Passphrase Security**: The recovery passphrase is held in volatile React memory only; never persisted in IndexedDB or localStorage.

---

## 3. Step-by-Step Execution Plan

1. **Step 1**: Implement `frontend/src/lib/wallet-crypto.ts` (wrapping `@zkred/zk-core`) and `frontend/src/lib/wallet-store.ts` (`idb-keyval` persistence).
2. **Step 2**: Implement `frontend/src/api/queries/wallets.ts`.
3. **Step 3**: Build `WalletSetup.tsx` (create wallet + restore wallet with passphrase validation).
4. **Step 4**: Build `WalletInbox.tsx` (decrypt offer, verify BBS signature via issuer key, save to IndexedDB, call claim endpoint).
5. **Step 5**: Build `CredentialCard.tsx` and `CredentialList.tsx` with selective PII visibility.
6. **Step 6**: Wire `WalletPage.tsx` to mount the live wallet state, inbox, credential list, and backup status.
7. **Step 7 (Verification & Testing)**:
   - `pnpm --filter frontend typecheck`
   - `pnpm --filter frontend build`
   - `bash scripts/check-hardcoded.sh`
   - Browser verification: create wallet, claim offer, reload page, restore wallet on clean state.
