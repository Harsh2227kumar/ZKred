# V0-S2 Plan: Container Infrastructure & Orchestration

## Overview
- **Task ID:** `V0-S2` (per `md/VERSION-PLAN.md`)
- **Owner:** SPARSH
- **Target Output:** `docker-compose.yml`, `infra/docker/backend.Dockerfile`, `infra/docker/frontend.Dockerfile`, `infra/caddy/Caddyfile`, and verified `.env.example` files.
- **Done When:** `docker compose up` brings up Postgres 16, runs backend migrations, serves the frontend shell, and routes requests via Caddy reverse proxy (`https://localhost/api/v1/health` and `/` respond with 200).

---

## 1. Architecture & Service Topology

```
                  Internet / Client (Browser)
                             │
                             ▼
                    ┌─────────────────┐
                    │      Caddy      │ :80 / :443
                    │ (Reverse Proxy) │
                    └────┬───────┬────┘
                         │       │
            /api/v1/*    │       │   /zk/* & /* (SPA)
        ┌────────────────┘       └────────────────┐
        ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│   Backend    │ :8080                    │   Frontend   │ (Static Assets
│ (Express API)│                          │ + ZK circuits│  served by Caddy)
└───────┬──────┘                          └──────────────┘
        │
        ▼ (Postgres wire)
┌──────────────┐
│  Postgres 16 │ :5432
│  (Database)  │
└──────────────┘
```

### Services Specification
1. **`db` (PostgreSQL 16 Alpine)**:
   - Image: `postgres:16-alpine`
   - Volume: `pgdata:/var/lib/postgresql/data`
   - Healthcheck: `pg_isready -U ${POSTGRES_USER:-zkred} -d ${POSTGRES_DB:-zkred}`
   - Restart: `unless-stopped`

2. **`backend` (Express API + Drizzle ORM)**:
   - Build context: Repo root (monorepo requires workspace packages `packages/zk-core` and `backend`).
   - Dockerfile: `infra/docker/backend.Dockerfile`
   - Depends on: `db` (`condition: service_healthy`)
   - Startup command: Runs database migrations (`pnpm --filter backend db:migrate`) then starts server (`node backend/dist/main.js`).
   - Env vars: Loaded from root `.env` (validated by `backend/src/config.ts`).
   - Exposes: `8080` to internal network only.

3. **`frontend` (Vite SPA Static Assets)**:
   - Build context: Repo root.
   - Dockerfile: `infra/docker/frontend.Dockerfile`
   - Multi-stage build producing compiled production bundle in `dist/`.
   - Shared via named volume `frontend_dist` to Caddy.

4. **`caddy` (Web Server & Reverse Proxy)**:
   - Image: `caddy:2-alpine`
   - Ports: `80:80`, `443:443`
   - Volumes:
     - `caddy_data:/data` (persists Let's Encrypt certificates)
     - `caddy_config:/config`
     - `frontend_dist:/srv/frontend:ro`
     - `./circuits/build:/srv/zk:ro` (serves `age_gte.wasm`, `age_gte.zkey`, `vkey.json` directly with CORS headers)
     - `./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro`
   - Routing:
     - `/api/*` &rarr; reverse proxy to `backend:8080`
     - `/zk/*` &rarr; serves static circuit artifacts with `Access-Control-Allow-Origin: *`
     - `/*` &rarr; serves static frontend with fallback to `/index.html` (SPA routing)

---

## 2. Step-by-Step Execution Plan

### Step 1: Dockerfile for Backend (`infra/docker/backend.Dockerfile`)
- Multi-stage build using `node:22-alpine`.
- Stage 1 (`builder`):
  - Installs `pnpm`.
  - Copies monorepo definitions: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`.
  - Copies `packages/zk-core/` and `backend/`.
  - Installs dependencies: `pnpm install --frozen-lockfile`.
  - Builds `@zkred/zk-core` (`pnpm --filter @zkred/zk-core build`).
  - Builds `backend` (`pnpm --filter backend build`).
- Stage 2 (`runner`):
  - Copies built artifacts and production dependencies.
  - Copies Drizzle migrations folder (`backend/drizzle/`).
  - Runs as non-root user `node`.
  - Exposes port `8080`.

### Step 2: Dockerfile for Frontend (`infra/docker/frontend.Dockerfile`)
- Multi-stage build using `node:22-alpine`.
- Stage 1 (`builder`):
  - Installs `pnpm`.
  - Copies `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`.
  - Copies `frontend/`.
  - Runs `pnpm --filter frontend build`.
- Stage 2 (`output`):
  - Minimal container placing `dist/` into shared volume `/srv/frontend`.

### Step 3: Caddyfile Configuration (`infra/caddy/Caddyfile`)
- Dynamic domain configuration using `{$DOMAIN:localhost}`.
- Automatic HTTPS with Let's Encrypt (in production with `{$ACME_EMAIL}`) or local HTTPS/HTTP.
- Gzip and Zstandard compression.
- API reverse proxy:
  ```caddy
  handle /api/* {
      reverse_proxy backend:8080 {
          header_up Host {host}
          header_up X-Real-IP {remote_host}
      }
  }
  ```
- ZK Circuit artifacts static route:
  ```caddy
  handle /zk/* {
      uri strip_prefix /zk
      root * /srv/zk
      file_server
      header Access-Control-Allow-Origin *
  }
  ```
- SPA fallback handler:
  ```caddy
  handle {
      root * /srv/frontend
      try_files {path} /index.html
      file_server
  }
  ```

### Step 4: Root `docker-compose.yml`
- Declares all 4 services with internal networking bridge `zkred-net`.
- Defines persistent volumes (`pgdata`, `caddy_data`, `caddy_config`, `frontend_dist`).
- Sets resource constraints and restart policies for reliability.

### Step 5: Environment Variables Validation
- Verify all required variables from `md/CONTRACTS.md §6` exist in `.env.example`.
- Ensure no literal secrets or passwords are in any committed file.

---

## 3. Verification & Acceptance Criteria
1. `docker compose config` parses without syntax errors.
2. `scripts/check-hardcoded.sh` passes (`check-hardcoded: OK`).
3. Clean separation: SPARSH edits only `infra/`, `docker-compose.yml`, and `md/progress/SPARSH-PROGRESS.md`.
4. Monorepo dependencies resolve reliably inside Docker without leaking host-specific `node_modules`.
