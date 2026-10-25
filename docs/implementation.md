# ZKred — Technical Implementation Specification (SPARSH)

**Target:** `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`  
**Owner:** **SPARSH**  
**Status:** **PROPOSED — REQUIRES USER APPROVAL BEFORE TASK EXECUTION**

---

## 1. Task `V0-S0`: Project Kickoff, Scope Freeze & Environment Templates

### Deliverables & Files:
- [md/MVP-SCOPE.md](file:///d:/Hackathons/Cascade/md/MVP-SCOPE.md): Update line 6 status to `FROZEN at 18:30 (Cascade 26 Gate 0)`.
- Root `.env.example`: Complete environment template with typed defaults for compose and backend.
- `contracts/.env.example`: Template for Hardhat deployer.
- `scripts/.env.example`: Template for seed pipeline.
- `md/progress/SPARSH-PROGRESS.md`: Update task board and append `V0-S0 | DONE`.

### Verification Steps:
1. Run `bash scripts/check-hardcoded.sh` to ensure zero secrets or forbidden URLs are present in source.
2. Present `git status` and `git diff` to the user for review.
3. Wait for explicit user confirmation before creating PR to `dev`.

---

## 2. Task `V0-S1`: Frontend Architecture & Navigation Shell

### Directory Architecture:
```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.app.json
├── src/
│   ├── main.tsx                    # React root entry
│   ├── App.tsx                     # QueryClientProvider + BrowserRouter
│   ├── config.ts                   # ⚓ THE ONLY FILE reading import.meta.env
│   ├── index.css                   # Tailwind v4 theme tokens & dark palette
│   │
│   ├── api/
│   │   ├── client.ts               # openapi-fetch client with toUserMessage error mapper
│   │   ├── types.ts                # Mirrored from CONTRACTS.md
│   │   └── queries/
│   │       └── meta.ts             # useHealth, useChainInfo, useEnums, useCredentialSchemas
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # 4 top-level sections + live health pulse dot
│   │   │   └── Layout.tsx          # Global header, main, and footer
│   │   └── common/
│   │       ├── Loading.tsx         # Spinner / skeleton
│   │       ├── EmptyState.tsx      # Clean empty data graphics with CTA
│   │       ├── ErrorState.tsx      # Error card with retry trigger
│   │       ├── TxLink.tsx          # Dynamic BaseScan explorer link using /meta/chain template
│   │       └── Hex.tsx             # Truncated hex viewer with one-click copy badge
│   │
│   └── features/
│       ├── home/pages/HomePage.tsx
│       ├── issuer/pages/
│       │   ├── IssuerListPage.tsx
│       │   └── IssuerDetailPage.tsx
│       ├── wallet/pages/
│       │   ├── WalletPage.tsx
│       │   └── WalletRespondPage.tsx
│       ├── verifier/pages/
│       │   ├── VerifierPage.tsx
│       │   └── RequestDetailPage.tsx
│       └── attack/pages/
│           └── AttackConsolePage.tsx
```

### Core Technical Guardrails:
1. **Config Anchor (`frontend/src/config.ts`):** Fails fast if `VITE_API_BASE_URL` or `VITE_ZK_ARTIFACTS_BASE_URL` is missing. Zero other files read `import.meta.env`.
2. **Error Translation (`frontend/src/api/client.ts`):** Implements `toUserMessage()` strictly covering all 15 error codes defined in `CONTRACTS.md §2`.
3. **Zero Hardcoded Data:** Dropdowns use `useEnums()`, forms use `useCredentialSchemas()`, explorer links use `useChainInfo()`.
4. **Privacy:** Holder PII is stored strictly in `idb-keyval` client-side.

---

## 3. Task `V0-S2`: Container Infrastructure (Docker Compose & Caddy)

### Multi-Service Compose Architecture (`docker-compose.yml`):
1. **`db`:** Postgres 16 Alpine with automatic healthcheck (`pg_isready`) and volume persistence.
2. **`backend`:** Built from `infra/docker/backend.Dockerfile`, starts after `db` is healthy.
3. **`caddy`:** Built from `infra/caddy/Caddyfile`:
   - Reverse proxies `/api/v1/*` to `backend:8080`.
   - Serves static SPA frontend files from `/var/www/html`.
   - Serves static ZK circuit artifacts (`.wasm` / `.zkey`) from `/var/www/zk`.
   - Configures automatic HTTPS via Let's Encrypt using `{$DOMAIN}` and `{$ACME_EMAIL}`.

---

## 4. Verification & Testing Protocol

Before requesting user PR approval for any task:
1. Strict TypeScript check: `pnpm --filter frontend build` must complete with zero errors.
2. Zero hardcoded data: `bash scripts/check-hardcoded.sh` must return `check-hardcoded: OK`.
3. Working tree check: Verify that only files belonging to the current task and owner folders are modified.
