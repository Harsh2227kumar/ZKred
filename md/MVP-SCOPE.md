# MVP Scope — ZKred

> Written at the end of Hour 0 planning and frozen at the start of execution.
> Changes after the freeze need both members (HARSH + SPARSH) to agree, and get logged in §10.

**Status:** `FROZEN at 18:30 (Cascade 26 Gate 0)`
**Event:** CASCADE '26 (IIIT Nagpur, TantraFiesta 2026) · 24h offline · **~20h left at planning time**
**PS:** Theme 4 · Problem 3 — *The Identity Monopoly: Decentralized Portable Proofs*

---

## 1. Problem

Universities, medical councils and governments hold the only copy of the evidence of a person's achievements. To prove one fact ("I have a degree"), people re-request documents from a central database and hand over far more than needed: a full transcript, a DOB, a home address. When an issuer's signing key leaks, today's systems can't tell a forged certificate from a real one, so they either trust everything or revoke everything.

## 2. Target user

**Primary:** a job applicant (holder) who must prove *"MBBS degree from a recognised university + age ≥ 21 + active medical license"* to an employer (verifier) **without revealing name, DOB or address**.
Secondary: the issuer (a university / medical council) that signs credentials and responds to a key breach.

## 3. The demo flow (the only thing that must work)

```text
1. Issuer console: "IIIT Nagpur" and "State Medical Council" exist (registered on-chain on Base Sepolia).
   They issue a Degree, an Age/ID credential and a Medical License to holder "Asha"; the batches are anchored on-chain.
2. Wallet: Asha's browser wallet claims the 3 credential offers (end-to-end encrypted to her wallet key)
   and backs them up encrypted to the server.
3. Verifier: an employer types in plain English: "Need a medical degree from an accredited university,
   age over 21, and an active medical license. Don't collect DOB, name or address."
   → Claude (Bedrock) turns this into a strict JSON proof policy → a request link with a nonce (QR code is a V1.3 stretch).
4. Wallet opens the request → shows a plain-language consent screen listing exactly what leaves the device
   → generates BBS+ selective-disclosure proofs + a Circom ZK proof of age ≥ 21, all in the browser → submits.
5. Verifier sees the eval chain go green: Issuer Signature ✓ → ZK Claim ✓ → Revocation Status ✓ →
   Key-Epoch/Anchor ✓ → VERIFIED PORTABLE CREDENTIAL. The payload contains no name, DOB or address.
6. Red-team: the attack console breaches IIIT Nagpur's issuance pipeline: it steals the signing key and slips
   200 forged degrees into a batch that gets anchored. The FULL verifier accepts them all (signed, anchored, in the root).
7. Issuer clicks "Report compromise" → on-chain the key is marked compromised from (now − window).
   Re-run: all 200 forgeries ✗ (anchored inside the compromise window), Asha's legacy degree still ✓,
   an honest in-window degree is re-issued under the rotated key → ✓. Asha's proof never changed.
```

This flow is shown live to the judges. Every MUST item below exists to make this flow work.

## 4. The "wow" moment

Step 6→7: a live counter shows **"200 forged degrees accepted" flipping to "0 accepted / 200 isolated, legacy degrees still valid"** after a single on-chain transaction, while the verifier still learns nothing about any innocent holder. The insight to say out loud: **"we trust chain time, not claimed time."**

---

## 5. Scope

### MUST (the demo fails without it)

| ID | Item | Owner(s) |
|---|---|---|
| M1 | Solidity registries on Base Sepolia: IssuerRegistry (keys + epochs + compromise), AnchorRegistry (batch roots), StatusRegistry (status-list hash) | HARSH |
| M2 | `packages/zk-core`: BBS+ keygen/sign/derive/verify, credential message layout, Merkle batch tree, bitstring status list | HARSH |
| M3 | Circom `age_gte` circuit (Poseidon(dob,salt) commitment + ≥ threshold) with committed wasm/zkey/vkey, browser + node prove/verify | HARSH |
| M4 | Backend API (Express + Zod + Drizzle + Postgres): issuers, keys, issuance, batches/anchoring, revocation, wallets/offers/backup, verifiers, requests, verification, attack endpoints | HARSH |
| M5 | Verifier engine: runs the 4-step eval chain and returns per-step results with reasons | HARSH |
| M6 | NL → policy with Claude Sonnet on Bedrock (structured output validated by Zod) + plain-language consent summary | HARSH |
| M7 | Frontend: Issuer console, Wallet, Verifier, Attack console pages wired to the real API | SPARSH |
| M8 | In-browser proof generation in the Wallet (uses `zk-core`) + encrypted backup | SPARSH (UI) + HARSH (`zk-core` API) |
| M9 | Docker compose (Postgres + backend + Caddy serving the frontend) running on one EC2 with HTTPS | SPARSH |
| M10 | Seed pipeline: `seed/*.json` → `scripts/seed.ts` → real API (issuers, holder, credentials, legacy anchors) | SPARSH |

### SHOULD (only after all MUST items work on the deployed URL)

| ID | Item | Owner(s) |
|---|---|---|
| S1 | QR code for presentation requests (scan wallet on phone) | SPARSH |
| S2 | Explorer links (BaseScan) for every on-chain tx in the UI | SPARSH |
| S3 | Holder binding (proof bound to the wallet key, so a stolen credential file is useless) | HARSH |
| S4 | Local Hardhat "true 48h" replay script (time-travel) for technical judges | HARSH |
| S5 | CI workflow: typecheck + tests + check-hardcoded on PRs | SPARSH |

### WON'T (in the 24h; goes to V2/V3 in `VERSIONS.md`)

- ZK Merkle-membership proof hiding which batch a credential came from (we disclose the batch id: k-anonymity)
- ZK non-revocation proofs / accumulators (we use herd-privacy status lists)
- Real issuer onboarding / accreditation governance, DID method resolution beyond our registry
- Mobile native wallet, OpenID4VC / W3C VC-API interoperability
- Social login, payments, notifications, analytics, multi-tenant admin

---

## 6. Data rules (no hardcoded data)

- All business data lives in Postgres and reaches the UI through the API.
- All config and secrets come from env vars via one config module per app (`backend/src/config.ts`, `frontend/src/config.ts`).
- Contract addresses and chain id come from env → exposed by `GET /meta/chain`; never literals in code.
- Demo data enters through `scripts/seed.ts` → the real API, or through the app UI.
- UI option lists (credential types, issuer kinds, statuses) come from `GET /meta/enums`.
- Unfinished endpoints return `501`, never fake data.
- **Privacy exception (by design):** holder credentials (with PII) live **only in the holder's browser** (IndexedDB) and as **client-side-encrypted** backup blobs in the DB. The server never stores plaintext holder claims after signing.

## 7. Tech stack (final)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query + React Router | Fast to build; in-browser WASM (snarkjs) works without SSR issues |
| Backend | Node 22+ / Express + TypeScript + Zod (+ `@asteasolutions/zod-to-openapi`) | Same language as the crypto libraries; OpenAPI → typed frontend client |
| Database | Postgres 16 (Docker) + Drizzle ORM + drizzle-kit migrations | Runs the same locally and on EC2 |
| Crypto | `@digitalbazaar/bbs-signatures` (BBS, BLS12-381), Circom 2 + snarkjs (Groth16), circomlibjs Poseidon | Real selective disclosure + real ZK range proof |
| Chain | Solidity + Hardhat, ethers v6, **Base Sepolia** (local Hardhat as dev fallback) | Public, cheap, judges can inspect txs |
| AI | Claude Sonnet on **AWS Bedrock** (`@anthropic-ai/bedrock-sdk`, Mantle client), model id + region from env | NL request → strict policy JSON; consent summaries |
| Deploy | One AWS EC2 + `docker compose` (Caddy for HTTPS + static frontend + `/api` proxy) | One URL, the same compose file locally |

## 8. Done criteria (judge-ready)

- [ ] Demo flow steps 1–7 work end to end on the **deployed URL** with seeded real data
- [ ] No hardcoded data (`bash scripts/check-hardcoded.sh` passes on `main`)
- [ ] Errors show friendly messages, not crashes or blank screens
- [ ] `scripts/seed.ts` recreates the demo state from zero in < 3 min (testnet tx latency included)
- [ ] README run steps work on a clean machine (`docker compose up`)
- [ ] Backup demo video recorded
- [ ] Deck done, pitch rehearsed twice

## 9. Risks

| Risk | Plan B | Owner |
|---|---|---|
| Base Sepolia RPC / faucet trouble | `CHAIN_RPC_URL` → local Hardhat node (same contracts, same code) | HARSH |
| Bedrock model access / region not enabled | Request access at H0; policy form fallback (verifier picks fields), returns `502 AI_UNAVAILABLE` visibly, never fake output | SPARSH (access, V0-S5) / HARSH (code) |
| Circom toolchain on Windows | Build once (WSL or prebuilt `circom.exe`), **commit** wasm/zkey/vkey so nobody else needs circom | HARSH |
| BBS library API mismatch | All BBS calls wrapped in `packages/zk-core/src/bbs.ts`; swap to `@mattrglobal/bbs-signatures` if needed | HARSH |
| Venue Wi-Fi fails | Phone hotspot + recorded video + local compose | SPARSH |
| 2-person team, HARSH overloaded | Sparsh takes all UI/ops/docs; HARSH ships thin endpoints early (walking skeleton) so SPARSH is never blocked | both |

## 10. Change log

| Time | Change | Agreed by |
|---|---|---|
| | | |
