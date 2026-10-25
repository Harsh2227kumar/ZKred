# Features — ZKred

> Every feature has a priority, a version, owners per layer, and the contract it depends on.
> Priority: **P0** = demo flow (MUST) · **P1** = SHOULD · **P2** = V2/V3 roadmap (not built in 24h; shown in the pitch).
> 2-person team: **HARSH** = backend + zk-core + contracts + circuits + AI · **SPARSH** = frontend + infra + seed + docs/pitch.

## Feature table

| ID | Feature | Priority | Version | FE (SPARSH) | API/DB (HARSH) | Crypto/Chain/AI (HARSH) | Ops/Seed (SPARSH) | Contract |
|---|---|---|---|---|---|---|---|---|
| F1 | Issuer registry + key epochs on-chain | P0 | V1.0 | ✔ | ✔ | ✔ | ✔ seed | `POST /issuers`, `GET /issuers`, IssuerRegistry |
| F2 | Issue BBS+ credential as an encrypted offer | P0 | V1.0 | ✔ | ✔ | ✔ | ✔ seed | `POST /issuers/{id}/credentials` |
| F3 | Batch anchoring (Merkle root on-chain) | P0 | V1.0 | ✔ | ✔ | ✔ | ✔ seed | `POST .../batches/{batch_id}/anchor`, AnchorRegistry |
| F4 | Browser wallet: claim, store, encrypted backup | P0 | V1.0 | ✔ | ✔ | ✔ zk-core | | `/wallets/*` |
| F5 | NL → proof policy (Claude on Bedrock) | P0 | V1.1 | ✔ | ✔ | ✔ | | `POST /presentation-requests/parse` |
| F6 | Presentation request + consent screen | P0 | V1.0 | ✔ | ✔ | | | `POST/GET /presentation-requests` |
| F7 | Selective disclosure (BBS derived proof) in browser | P0 | V1.1 | ✔ | | ✔ | | zk-core `buildPresentation()` |
| F8 | ZK age ≥ N proof (Circom/Groth16) | P0 | V1.1 | ✔ | | ✔ | | zk-core `proveAgeGte()` |
| F9 | Verifier engine (4-step eval chain) | P0 | V1.1 | ✔ | ✔ | ✔ | | `POST /presentation-requests/{id}/presentations` |
| F10 | Revocation via status list + on-chain hash | P0 | V1.2 | ✔ | ✔ | ✔ | | `POST .../revoke`, `GET /status-lists/...`, StatusRegistry |
| F11 | Breach: steal key, forge, compromise, isolate, re-issue | P0 | V1.2 | ✔ | ✔ | ✔ | | `/attack/*`, `POST .../compromise`, `POST /issuers/{id}/reissue` |
| F12 | Deployed on EC2 with HTTPS | P0 | V0 → V1.2 | | | | ✔ | docker-compose, Caddyfile |
| F13 | QR code for requests | P1 | V1.3 | ✔ | | | | — |
| F14 | BaseScan explorer links | P1 | V1.3 | ✔ | | | | `GET /meta/chain.explorer_tx_url_template` |
| F15 | Holder binding (proof tied to the wallet key) | P1 | V1.3 | | | ✔ | | zk-core |
| F16 | Hardhat 48h time-travel replay | P1 | V1.3 | | | ✔ | | `contracts/scripts/replay48h.ts` |
| F17 | ZK batch-membership (hide batch id) | P2 | V2 | | | ✔ | | — |
| F18 | OpenID4VP / W3C VC-API interop, mobile wallet | P2 | V2 | ✔ | ✔ | | | — |
| F19 | Multi-issuer governance (DAO / council multisig for accreditation) | P2 | V3 | | | ✔ | | — |

---

## Feature details (P0)

### F1 — Issuer registry + key epochs
- **User story:** As a verifier, I want to check an issuer's key status on-chain so that I never have to call the university.
- **Acceptance criteria:**
  - [ ] `POST /issuers` generates a BBS keypair, stores the secret key **encrypted** (`KEY_ENCRYPTION_SECRET`), and registers `{issuerDid, keyId, pubKeyHash}` on IssuerRegistry from the issuer governance wallet
  - [ ] `GET /issuers` returns keys with status `active | rotated | compromised` read from DB + chain, plus the tx hash
  - [ ] An issuer can't be used for verification unless `accredited == true` on-chain
- **Contracts:** `POST /issuers`, `GET /issuers`, `GET /issuers/{id}`, IssuerRegistry
- **Demo line:** "IIIT Nagpur's public key lives on Base Sepolia. Nobody needs to phone the registrar."

### F2 — Issue credential as an encrypted offer
- **User story:** As an issuer, I want to sign a credential for a holder so that only their wallet can read it.
- **Acceptance criteria:**
  - [ ] Claims are validated against the credential schema (`/meta/enums.credential_types` + schema fields)
  - [ ] The backend computes `dob_commitment = Poseidon(dob_days, salt)` for credentials with DOB
  - [ ] The signed credential is encrypted to the wallet's public key (ECDH P-256 + AES-GCM); the DB stores ciphertext only
  - [ ] Plaintext claims are not persisted after the response
- **Contracts:** `POST /issuers/{id}/credentials`
- **Demo line:** "The server forgets Asha's details the moment it signs."

### F3 — Batch anchoring
- **Acceptance criteria:** [ ] The open batch closes, the Merkle root of the commitments is computed, `AnchorRegistry.anchor(batchId, root, keyId)` runs from the governance wallet, and the block timestamp is stored as `anchored_at`.
- **Demo line:** "Issuance time is whatever the blockchain says, not whatever the certificate claims."

### F4 — Browser wallet
- **Acceptance criteria:** [ ] Wallet keys are generated in the browser · [ ] offers are decrypted and verified locally before saving · [ ] backup = AES-GCM(passphrase → PBKDF2) ciphertext only · [ ] restore on a fresh browser works with the wallet id + wallet token (shown once as a recovery code) + passphrase.

### F5 — NL → policy
- **Acceptance criteria:** [ ] Prompt lives in `backend/src/ai/prompts/policy.md` · [ ] Claude output validated with the Zod `PresentationPolicy` schema; invalid → one retry → `502 AI_BAD_OUTPUT` · [ ] the response includes `consent_summary` (plain English) and `minimisation_notes` (e.g. "DOB not needed: use the age predicate").
- **Demo line:** "The employer speaks English; the wallet receives math."

### F6 — Request + consent
- **Acceptance criteria:** [ ] The request has a nonce + expiry · [ ] the consent screen lists *revealed fields*, *predicates proven*, and *never shared* fields, computed from the policy + the wallet's credentials.

### F7 / F8 — Selective disclosure + age proof
- **Acceptance criteria:** [ ] BBS derived proof reveals only the policy's `reveal` fields + mandatory meta (`cred_type`, `issuer_did`, `key_id`, `batch_id`, `status_list_id`, `status_index`, `commitment`, `dob_commitment` when an age predicate is used) · [ ] the presentation header = request nonce (anti-replay) · [ ] the age SNARK public signals = `[dob_commitment, cutoff_days]` (cutoff = today − N calendar years) · [ ] proof generation < 5 s in Chrome on a laptop.

### F9 — Verifier engine
- **Acceptance criteria:** [ ] Returns `steps[]` in the order `issuer_signature`, `zk_claim`, `revocation_status`, `key_epoch_anchor` with `ok`, `code`, `message` · [ ] fails closed on chain/RPC errors · [ ] stores only `{request_id, result, steps, revealed_fields}`.

### F10 — Revocation
- **Acceptance criteria:** [ ] The bitstring list has ≥ 16 384 entries (herd privacy) · [ ] the served list hash == on-chain hash, or the verification fails.

### F11 — Breach
- **Acceptance criteria:** [ ] Before compromise, injected + anchored forgeries pass the **full** verifier (that is the scary part) · [ ] after compromise: 100% of in-window forgeries rejected with `KEY_COMPROMISED_ANCHORED_IN_WINDOW`, 100% of legacy credentials (anchored before the cutoff) accepted · [ ] honest in-window credentials are re-issued under the new key (eligibility = commitment in `issued_credentials`) and accepted; forgeries can't be re-issued · [ ] the attack console shows counters from real API results.
- **Demo line:** "One transaction. 200 fakes dead. Zero innocent holders touched."

---

## Cross-cutting features (always P0)

| ID | Feature | Owner |
|---|---|---|
| X1 | Config module reading env vars; the app fails fast if a required var is missing | HARSH (backend), SPARSH (frontend) |
| X2 | Standard error shape + frontend error mapping | HARSH, SPARSH |
| X3 | `GET /health` (checks DB + chain RPC + Bedrock reachability) | HARSH |
| X4 | `GET /meta/enums` + `GET /meta/chain` for every option list / chain detail the UI shows | HARSH |
| X5 | Seed pipeline (`seed/` + `scripts/seed.ts`) | SPARSH |
| X6 | Deploy pipeline + live URL from Hour 2 | SPARSH |
| X7 | Loading, empty and error states on every page | SPARSH |
| X8 | `scripts/check-hardcoded.sh` guard | SPARSH |
