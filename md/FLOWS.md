# Flows — ZKred

> One section per flow. Every flow lists **who owns each step**, the **API calls** (which must exist in `CONTRACTS.md`), the **data** it reads/writes, and the **failure cases**.
> Rule: a flow step with no owner or no contract is not ready to build.
> Owners: **HARSH** = backend, `packages/zk-core`, contracts, circuits, AI. **SPARSH** = frontend, infra, seed, scripts, docs.

---

## 0. System overview

```text
                 ┌────────────────────────── Browser (frontend/, SPARSH) ─────────────────────────┐
                 │ Issuer console │ Wallet (IndexedDB + zk-core + snarkjs WASM) │ Verifier │ Attack │
                 └───────┬───────────────────────────┬──────────────────────────────┬────────────┘
                         │ HTTPS /api/v1             │                              │
                 ┌───────▼───────────────────────────▼──────────────────────────────▼────────────┐
                 │ Backend API (backend/src/api, HARSH)  — Express + Zod + OpenAPI                │
                 │   core/ (verifier engine, issuance, breach)  ai/ (Bedrock Claude)               │
                 │   integrations/chain (ethers v6)           db/ (Drizzle → Postgres)             │
                 └───────┬──────────────────────────┬─────────────────────────────┬──────────────┘
                         │                          │                             │
                   Postgres 16              Base Sepolia contracts          AWS Bedrock
                 (issuers, batches,     IssuerRegistry / AnchorRegistry /  (Claude Sonnet:
                  offers, backups,         StatusRegistry                   NL → policy)
                  requests, verifs)

packages/zk-core (HARSH) is imported by BOTH backend and frontend: BBS+, message layout,
Merkle, status list, age-proof prove/verify, policy types.
```

Trust model in one line: **the issuer signs (BBS+), the chain timestamps (anchor), the holder discloses (ZK), the verifier checks all three without calling the issuer.**

---

## 1. Main end-to-end flow (the demo flow)

Goal: Asha proves "medical degree + age ≥ 21 + active license" to an employer, revealing nothing else; then the system survives a stolen issuer key.

```text
Issuer issues 3 credentials → batch anchored on-chain
  → Wallet claims encrypted offers, stores locally, encrypted backup
  → Verifier types NL requirement → Claude → policy → request (nonce)
  → Wallet: consent screen → BBS derived proofs + age SNARK in browser → submit
  → Verifier engine: signature → ZK claim → revocation → key epoch/anchor → VERIFIED
```

| # | Step | Frontend (SPARSH) | API (HARSH) | Core / zk-core (HARSH) | Chain / AI (HARSH) | Data written |
|---|---|---|---|---|---|---|
| 1 | Issuer console lists issuers + keys | `features/issuer/pages/IssuerListPage.tsx` | `GET /issuers` | — | — | — |
| 2 | Issue a credential to a wallet | `features/issuer/components/IssueForm.tsx` (tab of `IssuerDetailPage.tsx`) | `POST /issuers/{id}/credentials` | `issuance.issueCredential()` → `zk-core.signCredential()` | — | `issued_credentials`, `credential_offers` (ciphertext), open `issuance_batches` |
| 3 | Anchor the open batch | `features/issuer/components/BatchesTab.tsx` "Anchor" button | `POST /issuers/{id}/batches/{batch_id}/anchor` | `merkle.buildRoot()` | `AnchorRegistry.anchor()` | `issuance_batches.anchored_at, anchor_tx` |
| 4 | Wallet create / unlock | `features/wallet/pages/WalletSetupPage.tsx` | `POST /wallets` | browser: wallet ECDH keypair, passphrase → AES key | — | `wallets` |
| 5 | Claim offers | `features/wallet/pages/WalletInboxPage.tsx` | `GET /wallets/{id}/offers`, `POST /wallets/{id}/offers/{offer_id}/claim` | browser: decrypt offer, `zk-core.verifyCredential()` | — | `credential_offers.claimed_at`; IndexedDB |
| 6 | Encrypted backup | `features/wallet/components/BackupStatus.tsx` (auto after claim) | `PUT /wallets/{id}/backup` | browser AES-GCM | — | `wallet_backups` |
| 7 | Verifier writes NL requirement | `features/verifier/pages/NewRequestPage.tsx` | `POST /presentation-requests/parse` | `ai/policyFromText()` | Bedrock Claude | — |
| 8 | Verifier confirms policy → request | same page, "Create request" | `POST /presentation-requests` | `policy.validate()` | — | `presentation_requests` (nonce, policy, consent_summary) |
| 9 | Wallet opens request link | `features/wallet/pages/RespondRequestPage.tsx` (`/wallet/respond?request=<id>`) | `GET /presentation-requests/{id}` | — | — | — |
| 10 | Consent + proof generation (browser) | `features/wallet/components/ConsentScreen.tsx` | — | `zk-core.buildPresentation()` (BBS derive + age SNARK) | — | — |
| 11 | Submit presentation | `features/wallet/pages/RespondRequestPage.tsx` | `POST /presentation-requests/{id}/presentations` | `core/verifier.verifyPresentation()` | reads IssuerRegistry, AnchorRegistry, StatusRegistry | `verifications` (steps, result; no PII) |
| 12 | Verifier sees result | `features/verifier/pages/RequestResultPage.tsx` (polls) | `GET /presentation-requests/{id}/verifications` | — | — | — |

Failure cases:

- Policy NL is ambiguous → `422 POLICY_AMBIGUOUS` with `details.questions[]` → the UI shows the questions and lets the verifier edit the text.
- Bedrock down / not enabled → `502 AI_UNAVAILABLE` → the UI shows the error and the manual policy builder (types from `/meta/enums`, fields from `/meta/credential-schemas`).
- Wallet lacks a required credential → the wallet shows "missing: MedicalLicense" and doesn't submit.
- Request expired / nonce reused → `409 NONCE_USED` or `410 REQUEST_EXPIRED`.
- Proof invalid → `200` with `result: "rejected"` and the failing step marked ✗ with a reason (rejections are results, not HTTP errors).
- Chain RPC unreachable → `502 CHAIN_UNAVAILABLE`; the verification is NOT accepted on missing chain data (fail closed).

---

## 2. Auth flow (minimal, by role)

```text
Issuer/admin actions → Authorization: Bearer <ISSUER_ADMIN_TOKEN>   (typed once into the Issuer console, kept in sessionStorage)
Wallet actions       → Authorization: Bearer <wallet_token>          (returned once by POST /wallets, kept in IndexedDB)
Verifier actions     → public (create request, read results by request id)
Attack endpoints     → only when DEMO_MODE=true, plus the admin token
```

No user accounts, no passwords stored by us.

---

## 3. Revocation flow

Purpose: the issuer revokes Asha's medical license; the next verification fails at step 3, and no one learns whose credential was revoked.

```text
Issuer console → Revoke → backend flips bit status_index in the issuer's bitstring list
  → new list hash → StatusRegistry.setListHash(issuerKeyId, listId, hash)
  → verifier engine downloads the WHOLE list (GET /status-lists/...), checks hash == on-chain, reads the bit
```

| # | Step | Owner | Contract | Data |
|---|---|---|---|---|
| 1 | Click revoke on an issued credential | SPARSH (`features/issuer/components/IssuedTab.tsx`) | `POST /issuers/{id}/credentials/{credential_id}/revoke` | `issued_credentials.revoked_at`, `status_lists.bitstring` |
| 2 | Publish the hash on-chain | HARSH (`integrations/chain`) | `StatusRegistry.setListHash` | `status_lists.onchain_hash, tx` |
| 3 | Re-verify → ✗ Revocation | HARSH (`core/verifier`) | `POST /presentation-requests/{id}/presentations` | `verifications` |

Failure cases: the on-chain hash ≠ the served list → `REVOCATION_LIST_TAMPERED` → step 3 ✗ (fail closed).

---

## 4. Breach flow (red team, the "wow")

Purpose: a university's issuance pipeline is breached (signing key stolen + forgeries slipped into its batches); forged degrees flood in and **pass full verification**; one on-chain tx isolates every credential anchored in the window without touching legacy holders.

Threat model: the attacker controls the BBS signing key **and** can inject leaves into the issuer's open batch (a compromised issuance server), so forgeries get anchored like real ones. The attacker does **not** control the registrar's records (`issued_credentials`), which is how honest in-window credentials are told apart from forgeries during re-issue.

```text
Attack console:
  1. "Steal key"     POST /attack/steal-key {issuer_id}               → attacker holds the active BBS secret key
  2. "Forge N"       POST /attack/forge {issuer_id, count, claims}    → N degrees signed with the real key; their commitments are
                                                                         injected into the issuer's open batch, which is then anchored
  3. "Verify forged" POST /attack/verify-forged {mode:"full"}         → full engine: N accepted ⚠ (signed, anchored, in the Merkle root)
Issuer console:
  4. "Report compromise" POST /issuers/{id}/keys/{key_id}/compromise
       → IssuerRegistry.markCompromised(keyId, now − BREACH_WINDOW_SECONDS) + rotate to a new key
       → CompromiseReport: legacy batches ✓, in-window batches ⚠ need re-issue, unanchored ✗
Attack console:
  5. "Verify forged" again {mode:"full"} → N ✗ (KEY_COMPROMISED_ANCHORED_IN_WINDOW)
Wallet (holder):
  6. Asha's legacy degree (batch anchored before the cutoff) → still ✓, nothing to do
  7. A holder whose degree was issued inside the window sees "Refresh credential"
       → POST /issuers/{id}/reissue (wallet presents the old credential; the issuer finds its commitment in
         issued_credentials = honestly issued, not a forgery) → new offer signed by the new key → ✓
```

Verifier rule (implemented in `core/verifier.ts`, explained in docs):

```text
valid ⇔ BBS signature verifies under keyId
      ∧ issuer accredited ∧ key registered
      ∧ ( key not compromised ∨ batchAnchoredAt(batchId) < key.compromisedFrom )
      ∧ batch root contains the credential commitment
      ∧ status bit == 0
```

Why it works:
- **Chain time, not claimed time.** The anchor timestamp comes from the block, so the attacker can't backdate a forgery into a legacy batch: a forged commitment isn't in any legacy batch's on-chain Merkle root (`MERKLE_PROOF_INVALID`).
- Forgeries that made it into in-window batches are cut off by `compromisedFrom` (`KEY_COMPROMISED_ANCHORED_IN_WINDOW`).
- Forgeries never anchored fail `BATCH_NOT_ANCHORED`.
- Re-issue requires the commitment in the registrar's own `issued_credentials`, which injected forgeries never enter.

Failure cases: the compromise tx fails → the UI shows the tx error and nothing changes (no optimistic UI).

---

## 5. Seed / demo-data flow (SPARSH)

Purpose: recreate the demo state from zero **without hardcoded data in the app**.

```text
seed/issuers.json, seed/holders.json, seed/credentials.json, seed/verifiers.json
  -> pnpm --filter scripts seed   (scripts/seed.ts; reads SEED_API_BASE_URL + SEED_ADMIN_TOKEN + SEED_WALLET_PASSPHRASE via scripts/config.ts)
  -> POST /issuers, POST /wallets, POST /issuers/{id}/credentials, POST .../anchor, POST /verifiers
  -> "legacy" batches are anchored first; with BREACH_WINDOW_SECONDS small (demo), waiting
     > window before the live demo makes them legacy on a real chain
```

Rules:

- Seed files hold realistic data (Indian names, real-looking institutions), not "test123".
- Seed uses only the public API in `CONTRACTS.md`; if something can't be seeded via the API, HARSH adds an admin endpoint.
- Re-runnable: check-before-create by `did` / `display_name` (idempotent).
- The holder's wallet in seed is a **seed wallet** whose passphrase comes from `scripts/.env` (`SEED_WALLET_PASSPHRASE`) so the demo laptop can unlock it.

---

## 6. Error flow (applies to every flow)

```text
Backend error -> standard error JSON (CONTRACTS.md §2)
  -> frontend api client maps `code` to a friendly message
  -> UI shows a toast/inline error + retry where it makes sense
  -> nothing falls back to fake data
```

---

## 7. Deploy flow (SPARSH)

```text
PR merged to main
  -> on EC2: git pull && docker compose -f docker-compose.yml up -d --build
  -> backend container runs `drizzle-kit migrate` on start
  -> Caddy serves frontend/dist and proxies /api/* to backend:PORT, auto HTTPS for DOMAIN
  -> smoke test: curl https://$DOMAIN/api/v1/health → {status:"ok", db:"ok", chain:"ok", ai:"ok"}
Contracts: deployed once by HARSH (`pnpm --filter contracts deploy:base-sepolia`);
  addresses go into .env on EC2 (never into code).
```
