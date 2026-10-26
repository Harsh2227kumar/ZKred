# ZKred

> Portable, user-held credentials. Prove "degree + age ≥ 21 + active medical license" to an employer with zero-knowledge proofs, reveal nothing else, and survive a stolen university signing key without hurting a single honest graduate.

**Team:** HARSH (lead · backend · crypto · chain · AI) · SPARSH (frontend · DevOps · seed · docs · pitch)
**Event:** CASCADE '26, IIIT Nagpur (TantraFiesta 2026) · 24 hours · **PS:** Theme 4 · Problem 3 — *The Identity Monopoly: Decentralized Portable Proofs*

**Live demo:** `<https://DOMAIN>` · **Demo video:** `<link>` · **Deck:** [docs/pitch.md](docs/pitch.md) · **Contracts:** [contracts/deployments/baseSepolia.json](contracts/deployments/baseSepolia.json)

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

Diagrams of every flow (issuance, presentation, revocation, breach, trust model): [docs/architecture.md](docs/architecture.md).
Specs: [md/FLOWS.md](md/FLOWS.md) · [md/CONTRACTS.md](md/CONTRACTS.md) (API, DB, env vars).

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vite, React, TypeScript, Tailwind, TanStack Query |
| Backend | Node 22+, Express, Zod, zod-to-openapi, Drizzle ORM |
| Database | Postgres 16 (Docker) |
| Crypto | BBS+ (`@digitalbazaar/bbs-signatures`), Circom 2 + snarkjs (Groth16), Poseidon, WebCrypto |
| Chain | Solidity + Hardhat, ethers v6, Base Sepolia (local Hardhat as fallback) |
| AI | Claude Sonnet on AWS Bedrock |
| Deploy | AWS EC2 + docker compose + Caddy (auto-HTTPS) |

---

## Run locally

### 1. Prerequisites

Node 22+ (24 OK), pnpm 12 (`corepack enable`), Git, and either Docker (for Postgres / the full stack) or a local Postgres 16. `circom` is **not** needed: the circuit's wasm/zkey/vkey are committed in `circuits/build/`.

```bash
git clone <repo-url> ZKred && cd ZKred
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp contracts/.env.example contracts/.env
cp scripts/.env.example scripts/.env
```

Every variable is described in [md/CONTRACTS.md §6](md/CONTRACTS.md). The backend and the seed **refuse to start** if a required value is missing. Generate the secrets fresh:

```bash
openssl rand -hex 32      # ISSUER_ADMIN_TOKEN (also SEED_ADMIN_TOKEN in scripts/.env)
openssl rand -base64 32   # KEY_ENCRYPTION_SECRET
openssl rand -base64 32   # GOVERNANCE_KEY_ENCRYPTION_SECRET (must differ from the one above)
```

Pick a chain:

- **Base Sepolia** (what the live demo uses): `.env.example` already has the deployed registry addresses. `ACCREDITOR_PRIVATE_KEY` is the funded deployer key, which HARSH shares out of band. Never commit it.
- **Local Hardhat** (no keys or faucet needed):
  ```bash
  pnpm --filter contracts node            # terminal 1: chain on 127.0.0.1:8545, prints funded dev accounts
  pnpm --filter contracts deploy:local    # terminal 2: prints CHAIN_ID + the three registry addresses
  ```
  Then in `.env` set `CHAIN_ID=31337`, `CHAIN_NETWORK_NAME=Hardhat (local)`, `CHAIN_RPC_URL=http://127.0.0.1:8545`, `ACCREDITOR_PRIVATE_KEY=` the node's account #0 key, the three addresses, and `EXPLORER_TX_URL_TEMPLATE` to any URL containing `{tx}`.
  On a laptop that blocks Hardhat's native binary, run contract tests and deploys in Docker: `bash contracts/scripts/in-docker.sh test`.

For a short live breach demo, set `BREACH_WINDOW_SECONDS=900` (15 min) instead of the 48 h default.

### 3a. Dev mode (hot reload)

```bash
docker compose up -d db                 # or point DATABASE_URL at your own Postgres 16
pnpm --filter backend db:migrate
pnpm --filter backend dev               # API on :8080 — check http://localhost:8080/api/v1/health
pnpm --filter frontend dev              # app on :5173 (proxies /api to :8080, serves /zk artifacts)
```

### 3b. Everything in Docker (same as EC2)

```bash
docker compose up -d --build            # db + backend (runs migrations) + frontend build + Caddy
curl -k https://localhost/api/v1/health # {"status":"ok","db":"ok","chain":"ok","ai":"ok",...}
```

With local Hardhat on the host, the backend container must reach it as `CHAIN_RPC_URL=http://host.docker.internal:8545`.

### 4. Seed demo data (through the real API)

```bash
pnpm --filter scripts seed              # issuers, verifiers, holder wallets, legacy credentials (anchored now)
pnpm --filter scripts seed:in-window    # right before the breach demo: Meera's in-window MBBS
```

- The seed is idempotent, so running it again changes nothing.
- The first run prints each new wallet's **id + token once**. To open a holder in the browser: **Holder Wallet → Restore Backup**, with that id + token and `SEED_WALLET_PASSPHRASE`.
- Run `seed:in-window` at least `BREACH_WINDOW_SECONDS` after the first seed, then report the compromise within that window. That way Asha's MBBS is *legacy* (stays valid) and Meera's is *in window* (must be refreshed). Chain time decides, not the clock on your laptop.

| Holder | Credentials | Demo role |
|---|---|---|
| Dr. Asha Sharma (`asha`) | MBBS (AIIMS Nagpur), medical license (MMC), Government ID | passes the employer policy; legacy degree survives the breach |
| Dr. Meera Deshpande (`meera`) | license + ID (legacy), MBBS (in window) | her degree is isolated by the breach, then refreshed ✓ |
| Rohan Kulkarni (`rohan`) | B.Tech (IIIT Nagpur) | a second university's graduate |

### 5. Tests and checks

```bash
pnpm --filter @zkred/zk-core test       # crypto: BBS+, Merkle, status list, age SNARK, presentations
pnpm --filter backend test              # unit tests; integration suites run when TEST_* are set (below)
pnpm --filter contracts test            # Solidity registries
pnpm --filter frontend typecheck && pnpm --filter frontend lint
bash scripts/check-hardcoded.sh         # must pass before every commit
```

The backend integration suites (real Postgres + a local chain: revocation, breach, attack console, input validation) need `TEST_DATABASE_URL`, `TEST_CHAIN_RPC_URL`, `TEST_ACCREDITOR_PRIVATE_KEY` and `TEST_{ISSUER,ANCHOR,STATUS}_REGISTRY_ADDRESS` (see `backend/test/setup-env.ts`).

---

## Deploy on AWS EC2

1. **Launch** Ubuntu 24.04 on a t3.small or larger. Security group: 22 (your IP), 80 and 443 (anywhere).
2. **DNS:** point a domain at the instance, or use `<public-ip>.sslip.io`.
3. **Install Docker** (and a swap file for the image builds):
   ```bash
   git clone <repo-url> ZKred && cd ZKred
   bash infra/setup-ec2.sh && newgrp docker
   ```
4. **Configure:** `cp .env.example .env`, then set `DOMAIN`, `NODE_ENV=production`, `CORS_ORIGINS=https://<DOMAIN>`, `PUBLIC_BASE_URL=https://<DOMAIN>`, a strong `POSTGRES_PASSWORD`, fresh secrets (step 2 above), the Base Sepolia values, and Bedrock auth. For Bedrock, either attach an instance role with `bedrock:InvokeModel*` and leave the AWS keys blank, or set `AWS_BEARER_TOKEN_BEDROCK`.
5. **Deploy:** `bash infra/deploy.sh`. It builds, starts, and waits for `/api/v1/health`. Caddy gets the HTTPS certificate automatically.
6. **Smoke test:** `curl https://<DOMAIN>/api/v1/health` returns `"status":"ok"`. Then seed from your laptop with `SEED_API_BASE_URL=https://<DOMAIN>/api/v1`.

Updating: `git pull && bash infra/deploy.sh`. Only `main` is deployed (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Demo script (steps 1–7, ~5 min)

1. **Issuer console** → the seeded issuers, keys and anchored batches, each with an explorer link.
2. **Holder Wallet** → restore Asha. Her 3 credentials show *Active*; PII is hidden until "Show on this device".
3. **Verifier Portal** → "Hospital Doctor" template (or type the requirement) → Claude compiles a policy (no DOB, name or address) → request + QR.
4. **Wallet respond** → the consent screen lists what is revealed, what is proven in ZK and what never leaves the device → Share (proofs are built in the browser).
5. **Verifier result** → the 4-node eval chain goes green → *Verified Portable Credential*; the "never received" panel shows no name, DOB or address.
6. **Attack Console** → steal AIIMS Nagpur's key → forge 200 degrees → *Verify (full)*: 200/200 accepted.
7. **Issuer → Keys → Report compromise** → verify again: **0/200**, all isolated by chain time. Asha's legacy MBBS still verifies. Meera's wallet shows *Needs refresh* → **Refresh** → claim → verifies ✓.

If Bedrock is down, step 3 shows the error and the manual policy builder still works. If the RPC is down, verification fails closed.

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
