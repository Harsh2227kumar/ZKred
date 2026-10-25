# V1-S2 Plan: Student Wallet

> **Owner:** SPARSH  
> **Task:** `V1-S2` — Student Wallet  
> **Goal:** Browser-sovereign holder wallet with WebCrypto ECDH keypair, IndexedDB storage, offer decryption, BBS verification, selective PII display, and encrypted server backup.

---

## 1. Scope & Deliverables

1. **Wallet Initialization & Sovereignty**:
   - **Create Wallet**: Display Name (2–60 chars) + Passphrase (≥ 10 chars).
   - Generates browser ECDH P-256 keypair via `@zkred/zk-core` (`walletCrypto.generateWalletKeyPair()`).
   - Calls `POST /wallets` to register `{ display_name, enc_public_key }`.
   - Receives `wallet_token` (returned once) and stores `{ id, display_name, wallet_token, privateKeyJwk, publicKeyB64 }` in IndexedDB (`idb-keyval`).
   - **Restore Wallet**: Wallet ID + Wallet Token + Passphrase → fetches `GET /wallets/{id}/backup` → decrypts via `walletCrypto.decryptBackup` → rehydrates IndexedDB.

2. **Offers Inbox**:
   - Polls/queries `GET /wallets/{id}/offers` with `Authorization: Bearer <wallet_token>`.
   - For each unclaimed offer:
     1. Decrypts ciphertext via `walletCrypto.decryptOffer(privateKeyJwk, offer)`.
     2. Verifies BBS+ signature with issuer public key via `zk-core.verifyCredential(credential, publicKey)`.
     3. Appends verified credential to local IndexedDB store.
     4. Marks offer claimed via `POST /wallets/{id}/offers/{offer_id}/claim`.
     5. Re-encrypts and syncs backup via `PUT /wallets/{id}/backup`.

3. **Digital Credentials Display**:
   - Renders credential cards per claimed credential.
   - Displays Credential Type, Issuer DID, Active Key Status badge (via `GET /issuers`).
   - **Privacy Guard**: Non-PII fields visible; PII claims (`holder_name`, `dob`, `address`, `grade`, `registration_no`) hidden behind an explicit "Show on this device" toggle.

4. **Encrypted Backup Sync**:
   - PBKDF2-SHA256 (100,000 iterations) + AES-256-GCM.
   - Syncs automatically to `PUT /wallets/{id}/backup` on any wallet state change.
   - Passphrase remains in volatile session memory only (prompted on reload if a new backup is needed).

---

## 2. Conflict-Prevention Strategy

1. **Folder Ownership Boundary**:
   - Only edit files in `frontend/src/features/wallet/`, `frontend/src/lib/`, `frontend/src/api/queries/wallets.ts`, `docs/`, and `md/progress/SPARSH-PROGRESS.md`.
   - Zero modifications to `backend/`, `packages/zk-core/`, `contracts/`, or root configs.
2. **Crypto Isolation Rule (`AGENTS.md` §8.3)**:
   - Components in `features/wallet/` never import directly from `@zkred/zk-core`.
   - All `@zkred/zk-core` interactions are encapsulated in `frontend/src/lib/wallet-crypto.ts` and `frontend/src/lib/wallet-store.ts`.
3. **Dedicated Branch**: `sparsh/V1-S2-student-wallet`.

---

## 3. Verification & Acceptance Checklist

- [ ] Wallet setup generates real ECDH keypair and saves to IndexedDB (`idb-keyval`).
- [ ] Wallet token authenticated requests succeed (`Authorization: Bearer <wallet_token>`).
- [ ] Claiming an offer decrypts in browser, verifies BBS+ signature client-side, and calls claim endpoint.
- [ ] Claimed credentials survive a page reload.
- [ ] Restoring on a new browser session via Wallet ID + Token + Passphrase successfully restores credentials.
- [ ] `pnpm --filter frontend typecheck` passes (0 errors).
- [ ] `pnpm --filter frontend build` passes.
- [ ] `bash scripts/check-hardcoded.sh` passes.
- [ ] Interactive browser testing of wallet creation, inbox claim, PII toggle, and backup.
