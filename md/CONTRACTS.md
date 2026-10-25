# Contracts — ZKred

> **Owner: HARSH.** Frozen at the end of V0 (H2). This file lets 2 people (and their AI agents) build in parallel without touching each other's code.
> Any change: HARSH edits this file + `backend/src/schemas/` (+ `packages/zk-core/src/{policy,layouts}.ts` if shared), adds a changelog row, and tells SPARSH. SPARSH regenerates `frontend/src/api/types.ts` (`pnpm --filter frontend gen:api`).
> Never break an existing field. Add new optional fields instead.

---

## 1. API conventions

- Base path: `/api/v1` (behind Caddy: `https://$DOMAIN/api/v1`)
- JSON keys: `snake_case`. Timestamps: ISO-8601 UTC strings. DB ids: UUID strings. Chain ids (`issuer_chain_id`, `key_id`, `batch_id`, `list_id`): `0x`-prefixed 32-byte hex (`Hex32`).
- Binary (keys, proofs, ciphertext): base64url strings.
- Auth:
  - Issuer/admin endpoints 🔐: `Authorization: Bearer <ISSUER_ADMIN_TOKEN>`
  - Wallet endpoints 👛: `Authorization: Bearer <wallet_token>` (returned once by `POST /wallets`)
  - Attack endpoints ☠: admin token **and** `DEMO_MODE=true`, else `404`
  - Everything else: public
- Lists: `GET /things?limit=&cursor=` → `{ "items": [...], "next_cursor": string | null }`
- Logic that isn't implemented yet returns `501` with code `NOT_IMPLEMENTED` (never fake data).
- A verification that **rejects** is a `200` with `result: "rejected"`; HTTP errors are for broken requests only.

## 2. Error shape (every non-2xx response)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": { "field_name": "reason" } } }
```

| HTTP | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing/invalid admin or wallet token |
| 403 | `FORBIDDEN` | Token valid but not for this resource |
| 404 | `NOT_FOUND` | Resource missing (also attack endpoints when `DEMO_MODE=false`) |
| 409 | `CONFLICT` | Duplicate (issuer did, wallet name) |
| 409 | `NONCE_USED` | A presentation was already accepted for this request nonce |
| 410 | `REQUEST_EXPIRED` | Presentation request past `expires_at` |
| 422 | `VALIDATION_ERROR` | Field validation failed (`details` per field) |
| 422 | `POLICY_AMBIGUOUS` | AI couldn't build a safe policy; `details.questions: string[]` |
| 501 | `NOT_IMPLEMENTED` | Endpoint exists, logic pending |
| 502 | `AI_UNAVAILABLE` | Bedrock call failed / timed out |
| 502 | `AI_BAD_OUTPUT` | Claude output failed Zod validation after 1 retry |
| 502 | `CHAIN_UNAVAILABLE` | RPC failed (verifications fail closed) |
| 502 | `CHAIN_TX_FAILED` | A write tx reverted; `details.tx_hash` |
| 500 | `INTERNAL_ERROR` | Bug |

## 3. Endpoints

### 3.1 Meta & health

| Method | Path | Auth | Request | Response 2xx | Used by (FE) |
|---|---|---|---|---|---|
| GET | `/health` | — | — | `Health` | footer status dot |
| GET | `/meta/enums` | — | — | `Enums` | every dropdown |
| GET | `/meta/chain` | — | — | `ChainInfo` | explorer links, breach window label |
| GET | `/meta/credential-schemas` | — | — | `{ items: CredentialSchema[] }` | issue form (fields built from this) |

### 3.2 Issuers, keys, issuance, batches, revocation, breach

| Method | Path | Auth | Request | Response 2xx | Used by (FE) | Core / chain |
|---|---|---|---|---|---|---|
| POST | `/issuers` | 🔐 | `IssuerCreate` | `201 Issuer` | seed, Issuer console | BBS keygen; gov wallet; `IssuerRegistry.registerIssuer` + `addKey` |
| GET | `/issuers` | — | — | `{ items: Issuer[] }` | Issuer console, Wallet (key status) | DB + chain read |
| GET | `/issuers/{issuer_id}` | — | — | `Issuer` | Issuer detail | |
| POST | `/issuers/{issuer_id}/keys/rotate` | 🔐 | — | `IssuerKey` (new active) | Issuer detail | `IssuerRegistry.rotateKey` |
| POST | `/issuers/{issuer_id}/keys/{key_id}/compromise` | 🔐 | `CompromiseCreate` | `CompromiseReport` | Issuer detail "Report compromise" | `IssuerRegistry.markCompromised` + auto-rotate |
| POST | `/issuers/{issuer_id}/credentials` | 🔐 | `IssueCredentialIn` | `201 IssueCredentialOut` | Issue form, seed | `zk-core.signCredential`; adds leaf to open batch |
| GET | `/issuers/{issuer_id}/credentials` | 🔐 | `?limit&cursor` | list of `IssuedCredential` (no PII) | Issued list | |
| POST | `/issuers/{issuer_id}/credentials/{credential_id}/revoke` | 🔐 | — | `RevokeOut` | Issued list "Revoke" | status list bit → `StatusRegistry.setListHash` |
| GET | `/issuers/{issuer_id}/batches` | — | — | `{ items: Batch[] }` | Batches tab | |
| POST | `/issuers/{issuer_id}/batches/{batch_id}/anchor` | 🔐 | — | `Batch` (anchored) | Batches tab "Anchor", seed | `AnchorRegistry.anchor` |
| GET | `/batches/{batch_id}/leaves` | — | — | `{ batch_id, root, leaves: Hex32[] }` | Wallet (computes Merkle proof locally) | |
| POST | `/issuers/{issuer_id}/reissue` | 👛 | `ReissueIn` | `201 { offer_id }` | Wallet "Refresh credential" | verifies old credential was honestly issued; re-signs with active key |
| GET | `/status-lists/{list_id}` | — | — | `StatusListOut` | Wallet, verifier engine | |

### 3.3 Wallets (holder)

| Method | Path | Auth | Request | Response 2xx | Used by (FE) |
|---|---|---|---|---|---|
| POST | `/wallets` | — | `WalletCreate` | `201 WalletCreated` (contains `wallet_token` once) | Wallet setup, seed |
| GET | `/wallets/lookup?display_name=` | — | — | `{ id, display_name, enc_public_key }` | Issue form (pick recipient), seed |
| GET | `/wallets/{wallet_id}/offers` | 👛 | — | `{ items: CredentialOffer[] }` | Wallet inbox |
| POST | `/wallets/{wallet_id}/offers/{offer_id}/claim` | 👛 | — | `CredentialOffer` (claimed_at set) | Wallet inbox |
| PUT | `/wallets/{wallet_id}/backup` | 👛 | `BackupIn` | `Backup` | Wallet (auto after change) |
| GET | `/wallets/{wallet_id}/backup` | 👛 | — | `Backup` | Wallet restore |

### 3.4 Verifiers, requests, verification

| Method | Path | Auth | Request | Response 2xx | Used by (FE) | Core / AI |
|---|---|---|---|---|---|---|
| POST | `/verifiers` | — | `VerifierCreate` | `201 Verifier` | Verifier setup, seed | |
| GET | `/verifiers` | — | — | `{ items: Verifier[] }` | Verifier picker | |
| POST | `/presentation-requests/parse` | — | `ParseIn` | `ParseOut` | New request page | `ai.policyFromText` (Bedrock) |
| POST | `/presentation-requests` | — | `RequestCreate` | `201 PresentationRequest` | New request page | `ai.consentSummary` (falls back to a deterministic template if AI is down) |
| GET | `/presentation-requests/{request_id}` | — | — | `PresentationRequest` | Wallet respond page, verifier result page | |
| POST | `/presentation-requests/{request_id}/presentations` | — | `Presentation` | `Verification` | Wallet respond page | `core/verifier.verifyPresentation(mode="full")` |
| GET | `/presentation-requests/{request_id}/verifications` | — | — | `{ items: Verification[] }` | Verifier result page (poll 2 s) | |

### 3.5 Attack console (DEMO_MODE only) ☠

| Method | Path | Request | Response 2xx | Notes |
|---|---|---|---|---|
| POST | `/attack/steal-key` | `{ issuer_id: uuid }` | `{ issuer_id, key_id, stolen_at }` | Copies the active BBS secret key into `attack_state`. **The governance wallet is NOT stolen.** |
| POST | `/attack/forge` | `{ issuer_id, count: 1-1000, claims: object }` | `{ forged_set_id, forged_count, batch_id, anchor_tx_hash }` | Simulates a breached issuance pipeline: signs `count` degrees with the stolen key (random serials, claims from the body), injects their commitments into the issuer's open batch (`issuance_batches.leaves`), then anchors that batch. Stored in `attack_forgeries`; **never** written to `issued_credentials` (the registrar's records stay honest). |
| POST | `/attack/verify-forged` | `{ mode: "naive" \| "full" }` | `AttackRunOut` | Runs every forgery through the engine. `full` = the real 4-step chain (the demo uses this); `naive` = signature step only (for contrast). |
| GET | `/attack/state` | — | `AttackState` | Counters + timeline |
| POST | `/attack/reset` | — | `{ ok: true }` | Clears `attack_*` tables only (never chain, never issuers) |

### 3.6 Schemas

```text
Health
  status: "ok" | "degraded"
  db: "ok" | "down"
  chain: "ok" | "down"
  ai: "ok" | "down"
  version: string

Enums  (each item = { value: string, label: string })
  issuer_kinds: university | medical_council | government
  credential_types: Degree | MedicalLicense | GovernmentId
  key_statuses: active | rotated | compromised
  batch_statuses: open | anchored
  predicate_types: age_gte
  verification_steps: issuer_signature | zk_claim | revocation_status | key_epoch_anchor
  verification_results: accepted | rejected

ChainInfo
  chain_id: int
  network_name: string
  issuer_registry: address
  anchor_registry: address
  status_registry: address
  explorer_tx_url_template: string          # contains "{tx}"
  breach_window_seconds: int
  demo_mode: boolean

CredentialSchema
  type: CredentialType
  version: int
  fields: [{ name: string, label: string, kind: "string" | "date" | "int", pii: boolean, index: int,
            source: "meta" | "claim" | "derived" }]   # index = BBS message index; the issue form shows only source="claim"

IssuerCreate
  name: string (2-120)
  kind: IssuerKind
  did_suffix: string (3-60, [a-z0-9-])          # did becomes did:zkred:<did_suffix>

Issuer
  id: uuid
  did: string
  name: string
  kind: IssuerKind
  issuer_chain_id: Hex32                         # keccak256(did)
  governance_address: address
  accredited: boolean                            # read from chain
  keys: IssuerKey[]
  created_at: datetime

IssuerKey
  key_id: Hex32
  public_key: base64url                          # BBS BLS12-381 G2 public key
  status: KeyStatus
  active_from: datetime
  compromised_from: datetime | null
  tx_hash: string

CompromiseCreate
  window_seconds: int (optional; default BREACH_WINDOW_SECONDS)

CompromiseReport
  key_id: Hex32
  compromised_from: datetime                     # chain time − window
  new_key: IssuerKey
  tx_hashes: string[]
  affected_batches: [{ batch_id: Hex32, anchored_at: datetime | null, verdict: "legacy_valid" | "in_window_needs_reissue" | "unanchored_invalid" }]

IssueCredentialIn
  credential_type: CredentialType
  wallet_id: uuid                                 # recipient
  claims: object                                  # keys = CredentialSchema.fields where pii or claim; validated per schema
  # GovernmentId: claims.dob = "YYYY-MM-DD"; the server derives dob_days, salt, dob_commitment

IssueCredentialOut
  credential_id: uuid
  offer_id: uuid
  batch_id: Hex32
  status_list_id: Hex32
  status_index: int
  commitment: Hex32

IssuedCredential   (issuer view; NO claims)
  id, credential_type, wallet_id, batch_id, status_index, commitment, key_id, issued_at, revoked_at | null

RevokeOut
  credential_id: uuid, status_list_id: Hex32, status_index: int, list_hash: Hex32, tx_hash: string

Batch
  batch_id: Hex32, issuer_id: uuid, key_id: Hex32, size: int, status: BatchStatus,
  root: Hex32 | null, anchored_at: datetime | null, tx_hash: string | null

ReissueIn
  wallet_id: uuid
  old_credential: SignedCredential               # full credential; proves possession
  # server checks: commitment exists in issued_credentials for this issuer (honestly issued) AND not revoked

StatusListOut
  list_id: Hex32, issuer_id: uuid, size: int, encoded: base64url (gzip bitstring), hash: Hex32, onchain_hash: Hex32

WalletCreate
  display_name: string (2-60)
  enc_public_key: base64url                       # ECDH P-256 public key (raw), generated in the browser

WalletCreated
  id: uuid, display_name: string, wallet_token: string (shown once)

CredentialOffer
  id: uuid, wallet_id: uuid, issuer_id: uuid, credential_type: CredentialType,
  ephemeral_public_key: base64url, iv: base64url, ciphertext: base64url,   # ECDH-ES + AES-256-GCM of SignedCredential JSON
  created_at: datetime, claimed_at: datetime | null

BackupIn
  ciphertext: base64url, iv: base64url, salt: base64url, kdf_iterations: int, version: int
Backup
  wallet_id: uuid, ciphertext, iv, salt, kdf_iterations, version, updated_at

VerifierCreate
  name: string (2-120)
Verifier
  id: uuid, name: string, did: string, created_at

ParseIn
  text: string (10-2000)
ParseOut
  policy: PresentationPolicy
  consent_summary: string
  minimisation_notes: string[]                    # e.g. "DOB not requested: proving age ≥ 21 with ZK instead"

RequestCreate
  verifier_id: uuid
  policy: PresentationPolicy
  nl_text: string | null

PresentationRequest
  id: uuid, verifier_id: uuid, verifier_name: string,
  policy: PresentationPolicy, consent_summary: string,
  nonce: base64url, expires_at: datetime, created_at: datetime,
  wallet_url: string                              # PUBLIC_BASE_URL + /wallet/respond?request=<id>

PresentationPolicy   (Zod in packages/zk-core/src/policy.ts — single source)
  purpose: string
  requirements: [{
    id: string,                                   # "r1"
    credential_type: CredentialType,
    accredited_only: boolean,
    issuer_kinds: IssuerKind[] | null,
    issuer_dids: string[] | null,
    reveal: string[],                             # field names (non-PII preferred)
    equals: [{ field: string, value: string }],   # checked on revealed values
    predicates: [{ type: "age_gte", years: int (1-120) }],
    require_not_revoked: boolean
  }]
  never_collect: string[]                         # e.g. ["holder_name","dob","address"]; reveal ∩ never_collect must be ∅

Presentation   (built by zk-core.buildPresentation in the browser)
  request_id: uuid
  nonce: base64url
  items: [{
    requirement_id: string,
    credential_type: CredentialType,
    issuer_did: string,
    key_id: Hex32,
    disclosed: { [message_index: string]: string },   # revealed BBS messages (meta + reveal fields)
    bbs_proof: base64url,                             # presentation header = nonce
    merkle_proof: Hex32[],                            # commitment ∈ batch root
    age_proof: { proof: object, public_signals: string[] } | null
  }]

Verification
  id: uuid, request_id: uuid, mode: "full" | "naive",
  result: VerificationResult,
  steps: [{ requirement_id: string, step: VerificationStep, ok: boolean, code: string, message: string }],
  revealed: { [requirement_id: string]: { [field: string]: string } },
  created_at: datetime

AttackRunOut
  mode, total: int, accepted: int, rejected: int, by_code: { [code: string]: int }, ran_at: datetime
AttackState
  stolen_keys: [{ issuer_id, key_id, stolen_at }], forged_count: int, runs: AttackRunOut[]
```

Verification step codes (`steps[].code`): `OK`, `BBS_INVALID`, `ISSUER_UNKNOWN`, `ISSUER_NOT_ACCREDITED`, `KEY_UNKNOWN`, `PUBKEY_HASH_MISMATCH`, `POLICY_FIELD_MISSING`, `POLICY_EQUALS_FAILED`, `AGE_PROOF_INVALID`, `AGE_COMMITMENT_MISMATCH`, `AGE_PROOF_STALE_DATE`, `REVOKED`, `REVOCATION_LIST_TAMPERED`, `BATCH_NOT_ANCHORED`, `MERKLE_PROOF_INVALID`, `KEY_COMPROMISED_ANCHORED_IN_WINDOW`, `CHAIN_UNAVAILABLE`.

## 4. Internal interfaces

### 4.1 `packages/zk-core` (owner HARSH; imported by backend AND frontend)

Must run in Node 22 **and** browsers (no `fs` in the browser path; artifacts are passed in as `ArrayBuffer`/URLs).

```ts
// packages/zk-core/src/index.ts
export type Hex32 = `0x${string}`;
export { CREDENTIAL_LAYOUTS, type CredentialType, type CredentialLayout } from "./layouts";   // mirrors §3.6 CredentialSchema
export { PresentationPolicySchema, PresentationSchema, type PresentationPolicy, type Presentation } from "./policy";

// BBS+ (wrapper over @digitalbazaar/bbs-signatures; only file that imports it: src/bbs.ts)
export function generateIssuerKeyPair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array; keyId: Hex32 }>;
export function pubKeyHash(publicKey: Uint8Array): Hex32;                                  // keccak256, stored on-chain
export function encodeMessages(type: CredentialType, values: Record<string, string>): Uint8Array[];
export function signCredential(i: { secretKey: Uint8Array; publicKey: Uint8Array; type: CredentialType; values: Record<string, string> }): Promise<SignedCredential>;
export function verifyCredential(c: SignedCredential, publicKey: Uint8Array): Promise<boolean>;
export function deriveDisclosure(c: SignedCredential, publicKey: Uint8Array, revealFields: string[], nonce: Uint8Array): Promise<{ disclosed: Record<string, string>; bbsProof: Uint8Array }>;
export function verifyDisclosure(i: { publicKey: Uint8Array; type: CredentialType; disclosed: Record<string, string>; bbsProof: Uint8Array; nonce: Uint8Array }): Promise<boolean>;

// Age ZK (Circom age_gte): proves Poseidon(dob_days, salt) == dob_commitment ∧ dob_days ≤ cutoff_days.
// Dates = whole days since 1900-01-01 UTC (16-bit). cutoff_days = todayDays − minAgeYears calendar years (computed in zk-core).
// publicSignals = [dob_commitment, cutoff_days]. Verifier accepts if cutoff_days ≤ its own cutoff + AGE_PROOF_MAX_SKEW_DAYS.
export function dobCommitment(dobDays: bigint, salt: bigint): Promise<string>;              // circomlib Poseidon (computed with poseidon-lite: same constants, browser-safe)
export function proveAgeGte(i: { dobDays: bigint; salt: bigint; todayDays: number; minAgeYears: number; artifacts: ZkArtifacts }): Promise<{ proof: object; publicSignals: string[] }>;
export function verifyAgeGte(i: { proof: object; publicSignals: string[]; vkey: object }): Promise<boolean>;

// Merkle (keccak256, sorted pairs — same as OpenZeppelin MerkleProof)
export function merkleRoot(leaves: Hex32[]): Hex32;
export function merkleProof(leaves: Hex32[], leaf: Hex32): Hex32[];
export function verifyMerkleProof(root: Hex32, leaf: Hex32, proof: Hex32[]): boolean;

// Status list (W3C Bitstring Status List style)
export const statusList: {
  create(size: number): Uint8Array; setBit(l: Uint8Array, i: number, v: boolean): void; getBit(l: Uint8Array, i: number): boolean;
  encode(l: Uint8Array): string /* gzip+base64url */; decode(s: string): Uint8Array; hash(l: Uint8Array): Hex32;
};

// Holder side, one call per presentation
export function buildPresentation(i: {
  request: { id: string; nonce: string; policy: PresentationPolicy };
  credentials: SignedCredential[]; issuerPublicKeys: Record<Hex32, Uint8Array>;
  batchLeaves: Record<Hex32, Hex32[]>; todayDays: number; artifacts: ZkArtifacts;
}): Promise<Presentation>;                                                                  // throws ZkCoreError("MISSING_CREDENTIAL", ...)

// Wallet crypto (WebCrypto only; works in browsers and Node 22). SPARSH's wallet UI calls these, never raw crypto.
export const walletCrypto: {
  generateWalletKeyPair(): Promise<{ publicKeyB64: string; privateKeyJwk: JsonWebKey }>;                  // ECDH P-256
  encryptOffer(recipientPublicKeyB64: string, cred: SignedCredential): Promise<{ ephemeral_public_key: string; iv: string; ciphertext: string }>; // backend uses this
  decryptOffer(privateKeyJwk: JsonWebKey, offer: { ephemeral_public_key: string; iv: string; ciphertext: string }): Promise<SignedCredential>;
  encryptBackup(passphrase: string, data: unknown, kdfIterations: number): Promise<{ ciphertext: string; iv: string; salt: string; kdf_iterations: number }>; // PBKDF2-SHA256 → AES-256-GCM
  decryptBackup(passphrase: string, b: { ciphertext: string; iv: string; salt: string; kdf_iterations: number }): Promise<unknown>; // throws ZkCoreError("BAD_PASSPHRASE")
};

export interface SignedCredential { type: CredentialType; issuer_did: string; key_id: Hex32; values: Record<string, string>; signature: string /* base64url */ }
export interface ZkArtifacts { wasm: ArrayBuffer | string; zkey: ArrayBuffer | string; vkey?: object }
export class ZkCoreError extends Error { code: string }
```

BBS message layout (indices are frozen; `CREDENTIAL_LAYOUTS` is the code mirror):

| idx | Common meta (all types) | | idx | Degree | GovernmentId | MedicalLicense |
|---|---|---|---|---|---|---|
| 0 | `cred_type` | | 9 | `holder_name` 🔒 | `holder_name` 🔒 | `holder_name` 🔒 |
| 1 | `issuer_did` | | 10 | `degree_name` | `dob` 🔒 | `license_type` |
| 2 | `key_id` | | 11 | `major` | `address` 🔒 | `registration_no` 🔒 |
| 3 | `batch_id` | | 12 | `institution` | `dob_salt` 🔒 | `council` |
| 4 | `status_list_id` | | 13 | `graduation_year` | `dob_commitment` | `valid_until` |
| 5 | `status_index` | | 14 | `grade` 🔒 | `nationality` | `license_status` |
| 6 | `commitment` (random serial → Merkle leaf) | | | | | |
| 7 | `issued_at` (claimed, informational only) | | | | | |
| 8 | `holder_binding` (reserved, S3) | | | | | |

🔒 = PII, never revealed by default. Mandatory revealed meta per item: 0–6 (+13 `dob_commitment` when an `age_gte` predicate is used).

### 4.2 Backend core (owner HARSH; listed so SPARSH knows what the API calls)

```ts
// backend/src/core/issuance.ts
issueCredential(issuerId: string, input: IssueCredentialIn): Promise<IssueCredentialOut>
anchorBatch(issuerId: string, batchId: Hex32): Promise<Batch>
revokeCredential(issuerId: string, credentialId: string): Promise<RevokeOut>
reissue(issuerId: string, input: ReissueIn): Promise<{ offer_id: string }>
// backend/src/core/breach.ts
reportCompromise(issuerId: string, keyId: Hex32, windowSeconds: number): Promise<CompromiseReport>
// backend/src/core/verifier.ts
verifyPresentation(request: PresentationRequest, p: Presentation, mode: "full" | "naive"): Promise<Omit<Verification, "id" | "created_at">>
// backend/src/ai/policy.ts  (prompts in backend/src/ai/prompts/*.md)
policyFromText(text: string): Promise<ParseOut>            // throws AiError("AI_UNAVAILABLE" | "AI_BAD_OUTPUT" | "POLICY_AMBIGUOUS")
consentSummary(policy: PresentationPolicy): Promise<string>
// backend/src/integrations/chain.ts
registerIssuer, setAccredited, addKey, rotateKey, markCompromised, anchor, setListHash,
getIssuer, getKey, getAnchor, getListHash, chainHealth          // throw ChainError("CHAIN_UNAVAILABLE" | "CHAIN_TX_FAILED")
```

### 4.3 Solidity (owner HARSH; `contracts/src/*.sol`)

```solidity
// Accreditor = deployer (simulates the national accreditation body).
interface IIssuerRegistry {
  enum KeyStatus { None, Active, Rotated, Compromised }
  function registerIssuer(bytes32 issuerId, string calldata did, address governance) external;       // onlyAccreditor
  function setAccredited(bytes32 issuerId, bool accredited) external;                               // onlyAccreditor
  function addKey(bytes32 issuerId, bytes32 keyId, bytes32 pubKeyHash) external;                     // onlyGovernance(issuerId)
  function rotateKey(bytes32 issuerId, bytes32 oldKeyId, bytes32 newKeyId, bytes32 newPubKeyHash) external; // onlyGovernance
  function markCompromised(bytes32 issuerId, bytes32 keyId, uint64 compromisedFrom) external;        // onlyGovernance; compromisedFrom <= block.timestamp
  function getIssuer(bytes32 issuerId) external view returns (string memory did, address governance, bool accredited);
  function getKey(bytes32 keyId) external view returns (bytes32 issuerId, bytes32 pubKeyHash, uint64 activeFrom, KeyStatus status, uint64 compromisedFrom);
  event IssuerRegistered(bytes32 indexed issuerId, string did, address governance);
  event KeyAdded(bytes32 indexed issuerId, bytes32 indexed keyId, bytes32 pubKeyHash);
  event KeyRotated(bytes32 indexed issuerId, bytes32 oldKeyId, bytes32 newKeyId);
  event KeyCompromised(bytes32 indexed issuerId, bytes32 indexed keyId, uint64 compromisedFrom);
}
interface IAnchorRegistry {
  function anchor(bytes32 batchId, bytes32 issuerId, bytes32 keyId, bytes32 root) external;          // onlyGovernance(issuerId); key must be Active; batchId unused
  function getAnchor(bytes32 batchId) external view returns (bytes32 root, bytes32 issuerId, bytes32 keyId, uint64 anchoredAt);
  event BatchAnchored(bytes32 indexed batchId, bytes32 indexed issuerId, bytes32 keyId, bytes32 root, uint64 anchoredAt);
}
interface IStatusRegistry {
  function setListHash(bytes32 issuerId, bytes32 listId, bytes32 listHash) external;                 // onlyGovernance(issuerId)
  function getListHash(bytes32 listId) external view returns (bytes32 issuerId, bytes32 listHash, uint64 updatedAt);
  event StatusListUpdated(bytes32 indexed issuerId, bytes32 indexed listId, bytes32 listHash);
}
```

## 5. Database schema (Postgres, Drizzle; `backend/src/db/schema.ts`)

| Table | Columns (name: type, constraints) | Written by endpoint |
|---|---|---|
| `issuers` | `id uuid pk`, `did text unique`, `name text`, `kind issuer_kind`, `issuer_chain_id text unique`, `governance_address text`, `governance_key_enc text` (encrypted with `GOVERNANCE_KEY_ENCRYPTION_SECRET`), `created_at timestamptz default now()` | `POST /issuers` |
| `issuer_keys` | `id uuid pk`, `issuer_id uuid fk`, `key_id text unique`, `public_key text`, `secret_key_enc text` (encrypted with `KEY_ENCRYPTION_SECRET`), `status key_status`, `active_from timestamptz`, `compromised_from timestamptz null`, `tx_hash text`, `created_at` | `POST /issuers`, `.../rotate`, `.../compromise` |
| `issuance_batches` | `id uuid pk`, `batch_id text unique`, `issuer_id fk`, `key_id text`, `status batch_status`, `leaves text[]` (commitments; source of the Merkle root), `root text null`, `anchored_at timestamptz null`, `tx_hash text null`, `created_at` | `POST .../credentials` (opens), `.../anchor` |
| `issued_credentials` | `id uuid pk`, `issuer_id fk`, `wallet_id fk`, `credential_type credential_type`, `batch_id text`, `key_id text`, `status_list_id text`, `status_index int`, `commitment text unique`, `issued_at timestamptz`, `revoked_at timestamptz null`, `reissued_from uuid null` — **no claims/PII** | `POST .../credentials`, `.../revoke`, `.../reissue` |
| `status_lists` | `id uuid pk`, `list_id text unique`, `issuer_id fk`, `size int`, `bitstring bytea`, `next_index int`, `onchain_hash text null`, `tx_hash text null`, `updated_at` | issuance, revoke |
| `wallets` | `id uuid pk`, `display_name text unique`, `enc_public_key text`, `token_hash text` (sha256 of wallet_token), `created_at` | `POST /wallets` |
| `credential_offers` | `id uuid pk`, `wallet_id fk`, `issuer_id fk`, `credential_type`, `ephemeral_public_key text`, `iv text`, `ciphertext text`, `created_at`, `claimed_at null` | issuance, reissue, claim |
| `wallet_backups` | `wallet_id uuid pk fk`, `ciphertext text`, `iv text`, `salt text`, `kdf_iterations int`, `version int`, `updated_at` | `PUT /wallets/{id}/backup` |
| `verifiers` | `id uuid pk`, `name text`, `did text unique`, `created_at` | `POST /verifiers` |
| `presentation_requests` | `id uuid pk`, `verifier_id fk`, `nl_text text null`, `policy jsonb`, `consent_summary text`, `nonce text unique`, `nonce_used_at timestamptz null`, `expires_at timestamptz`, `created_at` | `POST /presentation-requests`, presentations |
| `verifications` | `id uuid pk`, `request_id fk`, `mode text`, `result verification_result`, `steps jsonb`, `revealed jsonb`, `created_at` | `POST .../presentations` |
| `attack_state` | `id uuid pk`, `issuer_id fk`, `key_id text`, `secret_key_enc text`, `stolen_at` | `POST /attack/steal-key` |
| `attack_forgeries` | `id uuid pk`, `forged_set_id uuid`, `issuer_id fk`, `credential jsonb`, `created_at` | `POST /attack/forge` |
| `attack_runs` | `id uuid pk`, `mode text`, `total int`, `accepted int`, `rejected int`, `by_code jsonb`, `ran_at` | `POST /attack/verify-forged` |

Postgres enums: `issuer_kind`, `credential_type`, `key_status`, `batch_status`, `verification_result`, exposed via `GET /meta/enums`.
Rules: all business data in the DB; option lists from Postgres enums via `/meta/enums`; **holder claims are never stored in plaintext**.

## 6. Environment variables

Code reads these **only** through `backend/src/config.ts` / `frontend/src/config.ts` / `contracts/hardhat.config.ts` / `scripts/config.ts`. A missing required var → the app refuses to start. Templates: `.env.example` (root, for compose + backend), `frontend/.env.example`, `contracts/.env.example`, `scripts/.env.example` (all owned by SPARSH; HARSH requests keys).

### Backend (`.env`)

| Var | Required | Example format (not a real value) | Used for |
|---|---|---|---|
| `NODE_ENV` | no (`production`) | `development` | |
| `PORT` | no (`8080`) | int | API port |
| `DATABASE_URL` | yes | `postgresql://user:pass@db:5432/zkred` | DB |
| `CORS_ORIGINS` | yes | comma-separated origins | CORS |
| `PUBLIC_BASE_URL` | yes | `https://<domain>` | `wallet_url` links |
| `ISSUER_ADMIN_TOKEN` | yes | 32+ random chars | 🔐 endpoints |
| `KEY_ENCRYPTION_SECRET` | yes | 32-byte base64 | encrypts BBS secret keys at rest |
| `GOVERNANCE_KEY_ENCRYPTION_SECRET` | yes | 32-byte base64 (≠ above) | encrypts issuer governance EVM keys |
| `DEMO_MODE` | no (`false`) | `true` | enables `/attack/*` |
| `CHAIN_ID` | yes | `84532` (Base Sepolia) / `31337` (Hardhat) | |
| `CHAIN_NETWORK_NAME` | yes | `Base Sepolia` | UI label |
| `CHAIN_RPC_URL` | yes | RPC URL | ethers provider |
| `ACCREDITOR_PRIVATE_KEY` | yes | `0x…` | registers/accredits issuers, funds gov wallets |
| `ISSUER_REGISTRY_ADDRESS` | yes | `0x…` | |
| `ANCHOR_REGISTRY_ADDRESS` | yes | `0x…` | |
| `STATUS_REGISTRY_ADDRESS` | yes | `0x…` | |
| `EXPLORER_TX_URL_TEMPLATE` | yes | `https://<explorer>/tx/{tx}` | UI links |
| `ISSUER_GAS_FUNDING_WEI` | no (`2000000000000000`) | int string | gas sent to each new gov wallet |
| `BREACH_WINDOW_SECONDS` | no (`172800` = 48h) | int; demo e.g. `900` | default compromise window |
| `REQUEST_TTL_SECONDS` | no (`900`) | int | presentation request expiry |
| `STATUS_LIST_SIZE` | no (`16384`) | int | herd-privacy list size |
| `BATCH_MAX_SIZE` | no (`256`) | int | auto-close batch size |
| `AGE_PROOF_MAX_SKEW_DAYS` | no (`1`) | int | days a proof's `cutoff_days` may exceed the verifier's own cutoff (clock drift) |
| `ZK_ARTIFACTS_DIR` | yes | path to `circuits/build` | vkey for server verification |
| `AWS_REGION` | yes | Bedrock region | Bedrock client |
| `BEDROCK_MODEL_ID` | yes | inference-profile id, e.g. `global.anthropic.claude-sonnet-4-6` (a bare `anthropic.…` id fails with "on-demand throughput isn’t supported") | Claude model |
| `AWS_BEARER_TOKEN_BEDROCK` | one of these | Bedrock API key | auth option A |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | one of these | IAM keys (or EC2 instance role: none needed) | auth option B |
| `AI_TIMEOUT_MS` | no (`30000`) | int | |
| `AI_MAX_TOKENS` | no (`4000`) | int | |

### Frontend (`frontend/.env`)

| Var | Required | Used for |
|---|---|---|
| `VITE_API_BASE_URL` | yes | API client base URL (e.g. `/api/v1` behind Caddy) |
| `VITE_ZK_ARTIFACTS_BASE_URL` | yes | where `age_gte.wasm` / `age_gte.zkey` are served (e.g. `/zk`) |

### Contracts (`contracts/.env`)

| Var | Required | Used for |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | yes | deploys + is the accreditor |
| `BASE_SEPOLIA_RPC_URL` | yes | network |
| `BASESCAN_API_KEY` | no | contract verification |

### Scripts (`scripts/.env`)

| Var | Required | Used for |
|---|---|---|
| `SEED_API_BASE_URL` | yes | seed target |
| `SEED_ADMIN_TOKEN` | yes | = `ISSUER_ADMIN_TOKEN` |
| `SEED_WALLET_PASSPHRASE` | yes | encrypts the seed holder wallet's backup |

### Infra (`.env` used by docker compose)

| Var | Required | Used for |
|---|---|---|
| `DOMAIN` | yes (prod) | Caddy site + HTTPS |
| `ACME_EMAIL` | yes (prod) | Let's Encrypt |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes | db container |

## 7. Changelog

| Time | Change | Breaking? | Announced |
|---|---|---|---|
| H0 | Initial draft | — | |
| H2 | Initial freeze | — | |
| V0-H4 | Age circuit public signals are `[dob_commitment, cutoff_days]` (exact calendar cutoff) instead of `[dob_commitment, today_days, min_age_days]`; `proveAgeGte` signature unchanged | No (zk-core not built yet) | |
| V0-H5 | zk-core additive exports: `CREDENTIAL_TYPES`, `MANDATORY_REVEAL_MAX_INDEX`, `ISSUER_KINDS`, `PREDICATE_TYPES`, `PresentationRequirement`, `PresentationItem`, `dateToDays`, `ageCutoffDays`, `randomDobSalt`. Poseidon via poseidon-lite (circomlibjs's entry point crashes browser bundles; outputs cross-checked in tests). `verifyAgeGte` checks the Groth16 proof only; the verifier compares `cutoff_days` and `dob_commitment` itself | No (additive) | |
| V0-H2 | `CredentialSchema.fields[].source` added (meta / claim / derived) so the issue form renders only claim fields | No (additive) | |
| V0-review | `Presentation.items[].age_proof.public_signals`: exactly 2 canonical decimal strings; `verifyAgeGte` returns false for any public signal that is not a canonical BN254 field element (closes a mod-r aliasing bypass of the cutoff check). DB: FK + unique `(status_list_id, status_index)` + FK indexes (migration 0001), no column changes | No (tightens validation only) | |
