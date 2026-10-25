# ZKred

> Portable, user-held credentials. Prove "degree + age ≥ 21 + active medical license" to an employer with zero-knowledge proofs, reveal nothing else, and survive a stolen university signing key without hurting a single honest graduate.

**Team:** HARSH (lead · backend · crypto · chain · AI) · SPARSH (frontend · DevOps · seed · docs · pitch)
**Event:** CASCADE '26, IIIT Nagpur (TantraFiesta 2026) · 24 hours · **PS:** Theme 4 · Problem 3 — *The Identity Monopoly: Decentralized Portable Proofs*

**Live demo:** `<https://DOMAIN>` · **Demo video:** `<link>` · **Deck:** `<link>` · **Contracts:** `<BaseScan links>`

---

## The problem

Institutions monopolise the evidence of what people have achieved. To prove one fact, people hand over whole documents (a full transcript, DOB, home address) and verifiers phone central databases. When an issuer's key leaks, nobody can tell forged certificates from real ones, so systems either trust everything or revoke everything.

## Our solution

1. **Issuers** (a university, a medical council) sign credentials with **BBS+** signatures and anchor each issuance batch's Merkle root **on-chain** (Base Sepolia).
2. **Holders** keep credentials in a **browser wallet** (end-to-end encrypted delivery, encrypted backup). The server never keeps their PII.
3. **Verifiers** describe what they need in plain English; **Claude (AWS Bedrock)** turns that into a strict, minimal proof policy.
4. The wallet builds **selective-disclosure proofs** (BBS+) and a **Circom/Groth16 proof of age ≥ 21** in the browser. The verifier learns *only* what the policy needs.
5. Verification runs the PS's eval chain: **Issuer Signature → ZK Claim → Revocation Status → Key-Epoch/Anchor → Verified Portable Credential**, all without contacting the issuer.
6. **Breach:** one on-chain `markCompromised(key, now − window)` isolates every credential that wasn't anchored before the cutoff. Legacy degrees stay valid, and in-window honest credentials are re-issued. *We trust chain time, not claimed time.*

## Architecture

```text
Browser (frontend/, SPARSH)  ── Issuer console · Wallet (IndexedDB + zk-core WASM) · Verifier · Attack console
        │ HTTPS /api/v1  (Caddy on EC2)
Backend (backend/, HARSH)    ── Express + Zod/OpenAPI · core (issuance, verifier engine, breach) · ai (Bedrock Claude)
        │                 │                         │
   Postgres 16      Base Sepolia contracts      AWS Bedrock
                    IssuerRegistry · AnchorRegistry · StatusRegistry
packages/zk-core (HARSH): BBS+, Merkle, status list, age SNARK, wallet crypto, used by backend AND browser
```

Details: [md/FLOWS.md](md/FLOWS.md) · [md/CONTRACTS.md](md/CONTRACTS.md) · `docs/architecture.md`

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vite, React, TypeScript, Tailwind, shadcn/ui, TanStack Query |
| Backend | Node 22+, Express, Zod, zod-to-openapi, Drizzle ORM |
| Database | Postgres 16 (Docker) |
| Crypto | BBS+ (`@digitalbazaar/bbs-signatures`), Circom 2 + snarkjs (Groth16), Poseidon, WebCrypto |
| Chain | Solidity + Hardhat, ethers v6, Base Sepolia |
| AI | Claude Sonnet on AWS Bedrock |
| Deploy | AWS EC2 + docker compose + Caddy (auto-HTTPS) |

---

## Run locally

### 1. Prerequisites

Node 22+ (24 OK), pnpm (`corepack enable`), Docker Desktop, Git. (`circom` is only needed to rebuild the circuit; the built artifacts are committed.)

### 2. Environment

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp contracts/.env.example contracts/.env
cp scripts/.env.example scripts/.env
```

Fill every value (see [md/CONTRACTS.md §6](md/CONTRACTS.md)). The app **refuses to start** if a required variable is missing.

### 3. Everything with Docker

```bash
docker compose up -d --build
```

### 4. Or dev mode

```bash
pnpm install
docker compose up -d db
pnpm --filter backend db:migrate
pnpm --filter backend dev
pnpm --filter frontend dev
```

### 5. Seed demo data (through the real API)

```bash
pnpm --filter scripts seed
```

---

## Repo map

```text
AGENTS.md            rules for every AI agent (source of truth)
CLAUDE.md            Claude Code additions      GEMINI.md + .agent/rules/   Antigravity additions
CONTRIBUTING.md      git workflow for the hackathon
md/                  MVP-SCOPE, FLOWS, FEATURES, VERSIONS, VERSION-PLAN, CONTRACTS, progress/
backend/             HARSH   API, db, core, ai, integrations
packages/zk-core/    HARSH   shared crypto (Node + browser)
contracts/           HARSH   Solidity registries + Hardhat
circuits/            HARSH   Circom age_gte + committed build artifacts
frontend/            SPARSH  React app
infra/, docker-compose.yml, scripts/, seed/, docs/, .github/   SPARSH
```

## Team

| Member | Role | GitHub |
|---|---|---|
| HARSH | Lead: backend, crypto, contracts, circuits, AI | `<@handle>` |
| SPARSH | Frontend, DevOps/EC2, seed, QA, docs, pitch | `<@handle>` |
