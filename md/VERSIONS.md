# Versions — ZKred

> **V0 → V1 → V1.x are built inside the hackathon (~20h left at planning).** V2 and V3 show the long-term direction (the pitch's "What's next" slide); they are **not built**.
> Each version must leave `main` working and deployed.

---

## Timeline at a glance (20h compressed; H0 = the moment planning is frozen)

| Version | Hours | Theme | Exit gate (must be true to move on) |
|---|---|---|---|
| **V0 – Skeleton** | H0 – H2 | Contracts frozen, repo, compose, hello-world deploy, contracts on Base Sepolia, circuit built | EC2 URL serves the frontend shell; `/api/v1/health` green with DB + chain; zk-core spike signs/verifies one BBS credential |
| **V1.0 – Walking skeleton** | H2 – H6 | Issue → claim → request → submit exists end to end in its thinnest form (verification may be `501`) | Click through demo steps 1–5 on the live URL with seeded data |
| **V1.1 – Core crypto + AI** | H6 – H10 | Real BBS derived proofs, age SNARK, verifier engine, Bedrock policy | Demo steps 1–5 produce a real VERIFIED result |
| **V1.2 – Complete MVP** | H10 – H14 | Revocation, breach flow, attack console, error/empty states, seed | Demo steps 1–7 work on the live URL |
| **V1.3 – Stretch** | H14 – H15 | P1 items only if V1.2 is stable (QR, explorer links, CI) | Nothing in V1.2 broke |
| **Freeze** | H15 | Feature freeze | — |
| **V1.4 – Polish & hardening** | H15 – H19 | Bugs, UI polish, reseed, README, deck, video, rehearsal | Demo rehearsed on a clean seed |
| **Code freeze** | H19 | Tag `demo-final` | Nobody merges; 1h buffer before judging |

Why a walking skeleton first: with no mock data allowed, the fastest way to unblock SPARSH's frontend is for HARSH to ship **real but thin** endpoints early (real DB read/write; crypto steps return `501` until ready). The frontend always talks to the real API.

---

## V0 — Skeleton (H0–H2)

- PS understood, demo flow agreed, MVP-SCOPE frozen
- `md/CONTRACTS.md` frozen: endpoints, schemas, tables, env vars, error shape, zk-core interface, Solidity interface
- pnpm monorepo: `backend/`, `frontend/`, `packages/zk-core/`, `contracts/`, `circuits/`
- Config modules (backend + frontend) read env and fail fast
- Postgres up via docker compose, first Drizzle migration applied
- `GET /health`, `GET /meta/enums`, `GET /meta/chain` live
- Contracts deployed to Base Sepolia, addresses in `.env`
- `age_gte` circuit compiled; wasm/zkey/vkey committed
- Frontend shell deployed behind Caddy on EC2; typed API client generated from OpenAPI

## V1.0 — Walking skeleton (H2–H6)

- Issuers, keys, issuance (BBS sign), offers, anchoring, wallets, backups, verifiers, requests: real DB + real chain txs
- Policy parsing and verification return `501 NOT_IMPLEMENTED` with the standard shape until V1.1
- Every demo page exists and calls its real endpoint
- Seed script v1 creates the issuers, holder wallet, 3 credentials and the anchored batches through the API

## V1.1 — Core crypto + AI (H6–H10)

- `zk-core.buildPresentation()` in the browser: BBS derived proofs + age SNARK
- `core/verifier.verifyPresentation()` with the 4-step chain
- Bedrock Claude: NL → policy + consent summary
- Integration checkpoint at H8 and H10: full flow on the live URL

## V1.2 — Complete MVP (H10–H14)

- Revocation (status list + on-chain hash)
- Breach: steal key → forge + inject into an anchored batch → full check accepts ⚠ → compromise → full check rejects → holder refresh (re-issue)
- Attack console with live counters
- Loading / empty / error states everywhere; seed realistic and re-runnable
- `check-hardcoded.sh` passes on `main`

## V1.3 — Stretch (H14–H15)

- QR codes, BaseScan links, CI workflow, holder binding, Hardhat 48h replay, in priority order. Drop instantly if they threaten stability.

## V1.4 — Polish & hardening (H15–H19)

- Bug fixes only, UI polish, README, deck, backup video, rehearsal ×2

---

## V2 — Post-hackathon product (not built; roadmap)

Goal: a usable credential network for one real institution pilot (e.g. one university + one hospital HR team).

- ZK batch-membership proof (Circom Merkle inclusion) so even the batch id stays hidden → full unlinkability
- ZK non-revocation (accumulator) instead of status-list download
- Standards: W3C VC Data Model 2.0 + Data Integrity `bbs-2023` cryptosuite, OpenID4VCI / OpenID4VP flows, `did:web` / `did:ethr` resolution
- Mobile wallet (React Native) with secure-enclave keys; cloud backup with social recovery
- Issuer SDK + bulk issuance (CSV) for registrars
- Tests + CI hardening, audit of circuits (trusted setup ceremony)

## V3 — Production / scale (not built; vision)

Goal: a national-scale, multi-issuer trust fabric for degrees, licenses and work history.

- Accreditation governance: an on-chain council multisig (e.g. UGC / NMC-like bodies) that accredits issuers and can co-sign compromise events
- L2 mainnet deployment with a gas sponsor / account abstraction for issuers
- Integration with DigiLocker / Academic Bank of Credits style sources as issuers
- Employer ATS integrations, public verifier API, rate limits, billing
- HSM / KMS-held issuer keys, threshold signing for universities, monitoring, incident response runbooks
- Compliance: DPDP Act 2023 data-minimisation reporting built in

---

## Version boundaries

| Concern | V1 (hackathon) | V2 | V3 |
|---|---|---|---|
| Data | Postgres, seeded via the API; holder PII only in the browser + encrypted backup | Real pilot users | Multi-tenant issuers, retention policies |
| Crypto | BBS+ selective disclosure, Groth16 age proof, batch id disclosed | Full unlinkability, ZK non-revocation | Audited circuits, MPC trusted setup |
| Chain | Base Sepolia testnet | Base Sepolia + mainnet staging | L2 mainnet, governance multisig |
| Auth | Admin token (issuer), wallet token (holder), public verifier | OAuth for issuers/verifiers | SSO, RBAC, KMS/HSM keys |
| Deploy | One EC2 + docker compose | Staging + prod | Managed AWS (ECS/RDS), monitored |
| AI | Claude Sonnet on Bedrock: NL → policy, consent summary | Policy linting, over-collection warnings | Org-level policy templates, multilingual consent |
