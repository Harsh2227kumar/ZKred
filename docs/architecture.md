# ZKred architecture

How the pieces fit, drawn from [md/FLOWS.md](../md/FLOWS.md) (flows) and [md/CONTRACTS.md](../md/CONTRACTS.md) (API, DB, Solidity, env). Diagrams are Mermaid, so GitHub renders them.

**Trust model in one line:** the issuer signs (BBS+), the chain timestamps (anchor), the holder discloses (ZK), and the verifier checks all three without calling the issuer.

---

## 1. System overview

```mermaid
flowchart TB
  subgraph Browser["Browser · frontend/ (SPARSH)"]
    IC[Issuer console]
    W["Holder wallet<br/>IndexedDB + zk-core WASM"]
    V[Verifier portal]
    AC["Attack console<br/>(DEMO_MODE only)"]
  end
  subgraph API["Backend · backend/ (HARSH) — Express + Zod + OpenAPI"]
    R["api/ routes<br/>validate → one core call"]
    C["core/<br/>issuance · verifier engine · breach · attack"]
    AI["ai/<br/>Bedrock: NL → policy, consent text"]
    DB[("db/ · Postgres 16")]
    CH["integrations/chain · ethers v6"]
  end
  ZK["packages/zk-core<br/>BBS+ · Merkle · status list · age SNARK · wallet crypto"]
  subgraph Chain["Base Sepolia (local Hardhat fallback)"]
    IR[IssuerRegistry<br/>issuers · key epochs · compromise cutoff]
    AR[AnchorRegistry<br/>batch Merkle roots + block time]
    SR[StatusRegistry<br/>revocation list hashes]
  end
  BR[(AWS Bedrock<br/>Claude Sonnet)]

  IC & W & V & AC -- "HTTPS /api/v1 (Caddy)" --> R
  R --> C
  C --> DB & CH & AI
  CH --> IR & AR & SR
  AI --> BR
  W -. imports .-> ZK
  C -. imports .-> ZK
```

- **Dependency direction** (AGENTS.md §8.3): `api → core → db | integrations | ai`, never backwards. Routes hold no SQL, no chain calls, no crypto.
- **All cryptography lives in `packages/zk-core`.** It runs in Node (issuer signing, verification) and in the browser (proofs), and both sides import the same code.
- **No plaintext holder data at rest.** Claims are signed, encrypted to the holder's wallet key and dropped. The server keeps only the commitment, the batch and the status slot, plus a client-side-encrypted backup.

## 2. Credential anatomy

Every credential is a BBS+ signature over a frozen message vector (CONTRACTS §4.1). Indices never change:

| idx | field | revealed? |
|---|---|---|
| 0–6 | `cred_type`, `issuer_did`, `key_id`, `batch_id`, `status_list_id`, `status_index`, `commitment` | always (they drive the checks) |
| 7–8 | `issued_at` (informational), `holder_binding` (reserved) | no |
| 9+ | type fields, e.g. Degree: `holder_name`🔒 `degree_name` `major` `institution` `graduation_year` `grade`🔒 | only what the policy asks for |

- `commitment` is a random serial. Its hash is the **Merkle leaf** of the issuance batch.
- `GovernmentId` carries `dob_commitment = Poseidon(dob_days, dob_salt)`, so age is proven against a signed value without revealing `dob`.

## 3. Issue → claim → present → verify (the demo flow)

```mermaid
sequenceDiagram
  autonumber
  participant I as Issuer console
  participant B as Backend
  participant C as Chain
  participant W as Wallet (browser)
  participant V as Verifier portal
  participant A as Bedrock
  I->>B: POST /issuers/{id}/credentials
  B->>B: BBS sign (zk-core) · leaf → open batch · status slot
  B-->>W: offer (ECDH-ES + AES-GCM to the wallet key)
  I->>B: POST .../batches/{id}/anchor
  B->>C: AnchorRegistry.anchor(root) — block time = issuance time
  W->>B: GET offers → decrypt + verify signature locally → claim
  W->>B: PUT backup (encrypted with the passphrase in the browser)
  V->>B: POST /presentation-requests/parse ("need an accredited MBBS, age ≥ 21…")
  B->>A: forced tool call → Zod-validated policy (1 retry)
  V->>B: POST /presentation-requests → nonce + wallet_url (QR)
  W->>B: GET request → consent screen (revealed / proven / never shared)
  W->>W: buildPresentation: BBS derive (nonce-bound) + Merkle path + Groth16 age proof
  W->>B: POST .../presentations
  B->>C: read issuer, key, anchor, list hash (fails closed if unreachable)
  B-->>V: Verification: 4 steps per requirement → accepted / rejected
```

## 4. The verifier's eval chain

Each requirement runs these four steps in order and stops at the first failure (backend/src/core/verifier.ts). A rejection is a `200` with `result: "rejected"` and the failing step's code.

```mermaid
flowchart LR
  S1["1 · Issuer signature<br/>issuer + key on-chain · pubkey hash matches<br/>BBS proof valid for THIS nonce · issuer allowed/accredited"]
  S2["2 · ZK claim<br/>requested fields disclosed · equals checks<br/>Groth16 age proof bound to the signed dob_commitment"]
  S3["3 · Revocation status<br/>whole list's hash = on-chain hash<br/>bit at status_index is 0"]
  S4["4 · Key epoch / anchor<br/>batch anchored by that key · commitment ∈ root<br/>not anchored at/after the compromise cutoff"]
  OK(["Verified portable credential"])
  S1 --> S2 --> S3 --> S4 --> OK
```

```text
valid ⇔ BBS signature verifies under keyId
      ∧ issuer accredited ∧ key registered
      ∧ ( key not compromised ∨ batchAnchoredAt(batchId) < key.compromisedFrom )
      ∧ batch root contains the credential commitment
      ∧ status bit == 0
```

## 5. Revocation (herd privacy)

```mermaid
sequenceDiagram
  participant I as Issuer console
  participant B as Backend
  participant C as StatusRegistry
  participant V as Verifier engine
  I->>B: POST .../credentials/{id}/revoke
  B->>B: stored list must still hash to the on-chain hash (else 409, nothing published)
  B->>B: flip bit status_index in the 16k-entry bitstring
  B->>C: setListHash(listId, keccak(bits))
  V->>B: GET /status-lists/{id} — the WHOLE list
  V->>C: getListHash(listId)
  V->>V: hash ≠ chain → REVOCATION_LIST_TAMPERED · bit set → REVOKED
```

Verifiers always download the whole list, and only its hash is on-chain, so nobody learns *whose* credential was checked or revoked.

## 6. Breach: chain time, not claimed time

Threat model: the attacker steals the BBS signing key **and** can inject leaves into the issuer's open batch (a compromised issuance server), so forgeries get anchored like real ones. The attacker does **not** control the registrar's records (`issued_credentials`) or the governance wallet.

```mermaid
timeline
  title One signing key, before and after "Report compromise"
  Legacy batch anchored : Asha's MBBS (block time T0)
  Cutoff = report time − window : compromisedFrom (written on-chain)
  In-window batches anchored : Meera's MBBS · 200 injected forgeries
  Report compromise : markCompromised(key, cutoff) + rotate to a new key
  After : legacy ✓ · in-window ✗ (KEY_COMPROMISED_ANCHORED_IN_WINDOW) · never anchored ✗ (BATCH_NOT_ANCHORED)
```

```mermaid
sequenceDiagram
  participant AC as Attack console
  participant B as Backend
  participant C as Chain
  participant W as Meera's wallet
  AC->>B: steal-key → forge 200 + inject into the open batch → anchored
  AC->>B: verify-forged (full) → 200 / 200 accepted ⚠
  Note over B,C: Issuer: Report compromise
  B->>C: IssuerRegistry.markCompromised(key, chain time − window) · rotateKey
  AC->>B: verify-forged (full) → 0 / 200 accepted
  W->>B: status: anchored after the cutoff → "Needs refresh"
  W->>B: POST /issuers/{id}/reissue (old credential + wallet token)
  B->>B: in the registrar's records for this wallet · not revoked · digest = exactly what was signed
  B-->>W: fresh offer signed by the new key → claim → verifies ✓
```

Why forgeries can't escape:

- **No backdating.** A forged commitment isn't in any legacy batch's on-chain root (`MERKLE_PROOF_INVALID`), and anchors carry block time.
- **Isolated by the cutoff.** Forgeries anchored inside the window fail `KEY_COMPROMISED_ANCHORED_IN_WINDOW`; ones never anchored fail `BATCH_NOT_ANCHORED`.
- **No laundering.** Re-issue requires the commitment in the registrar's own records **and** the exact credential the issuer signed (its recorded digest). A stolen-key copy of an honest holder's serial with upgraded claims has a different signature, so it is refused.

## 7. Data model (Postgres)

```mermaid
erDiagram
  issuers ||--o{ issuer_keys : "key epochs"
  issuers ||--o{ issuance_batches : opens
  issuers ||--o{ status_lists : owns
  issuers ||--o{ issued_credentials : "registrar records (no claims)"
  issuance_batches ||--o{ issued_credentials : "leaf in"
  status_lists ||--o{ issued_credentials : "bit for"
  wallets ||--o{ issued_credentials : "issued to"
  wallets ||--o{ credential_offers : "encrypted to"
  wallets ||--o| wallet_backups : "client-side encrypted"
  verifiers ||--o{ presentation_requests : creates
  presentation_requests ||--o{ verifications : "results (no PII)"
```

`attack_state`, `attack_forgeries` and `attack_runs` hold the red-team console's data (DEMO_MODE only). They are never mixed into `issued_credentials`.

## 8. Deployment

```mermaid
flowchart LR
  U[Browser] -- HTTPS --> CA["Caddy<br/>auto-HTTPS · DOMAIN"]
  CA -- "/" --> FE["frontend/dist<br/>(static SPA)"]
  CA -- "/zk/*" --> ZKA["circuits/build<br/>age_gte.wasm · .zkey"]
  CA -- "/api/*" --> BE["backend:8080<br/>migrates on start"]
  BE --> PG[("db: Postgres 16<br/>volume zkred_pgdata")]
  BE --> RPC[Base Sepolia RPC]
  BE --> BRK[AWS Bedrock]
```

One EC2 instance runs `docker compose` (db, backend, frontend build, Caddy). `infra/setup-ec2.sh` installs Docker; `infra/deploy.sh` builds, starts and waits for `/api/v1/health`. Steps: [README → Deploy on AWS EC2](../README.md#deploy-on-aws-ec2).
