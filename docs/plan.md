# V0-S6 Plan: Automated OpenAPI Frontend Type Generation

## Overview
- **Task ID:** `V0-S6` (per `md/VERSION-PLAN.md`)
- **Owner:** SPARSH
- **Target Output:** Fully automated OpenAPI TypeScript generation pipeline (`pnpm --filter frontend gen:api`), producing strictly typed contract definitions in `frontend/src/api/types.ts` from backend `/api/v1/openapi.json`.
- **Done When:** Running `pnpm --filter frontend gen:api` generates `frontend/src/api/types.ts` from the OpenAPI schema and `pnpm --filter frontend build` (or typecheck) compiles with 0 errors.

---

## 1. Scope & Impact

### A. Contract Integrity & Zero Type Drift
- The backend defines Zod schemas in `backend/src/schemas/` and exposes the compiled OpenAPI 3.1 specification at `/api/v1/openapi.json` via `@asteasolutions/zod-to-openapi`.
- `V0-S6` sets up `openapi-typescript` in the frontend so that types are **100% generated, never hand-edited** (fulfilling `AGENTS.md §1` & `§3`).
- Any backend contract change automatically flows into the frontend with full TypeScript compiler verification.

### B. Type-Safe Client Integration
- `openapi-fetch` client in `frontend/src/api/client.ts` uses the generated `paths` interface:
  ```typescript
  import createClient from 'openapi-fetch';
  import type { paths } from './types';

  export const apiClient = createClient<paths>({ baseUrl: config.apiBaseUrl });
  ```
- All endpoints (`/health`, `/meta/chain`, `/meta/enums`, `/meta/credential-schemas`) become strictly typed with request/response auto-completion.

---

## 2. Step-by-Step Execution Plan

### Step 1: OpenAPI Schema Generation Utility
- Ensure the OpenAPI spec can be generated either from a running backend server or via a static generator script (`scripts/gen-openapi.ts` or direct `openapi-typescript` runner) so developers can generate types offline without running a database.

### Step 2: Configure `gen:api` in `frontend/package.json`
- Add script:
  ```json
  "scripts": {
    "gen:api": "openapi-typescript http://localhost:8080/api/v1/openapi.json -o src/api/types.ts"
  }
  ```
- Provide an offline fallback:
  ```json
  "gen:api:local": "tsx ../scripts/export-openapi.ts && openapi-typescript ../backend/dist/openapi.json -o src/api/types.ts"
  ```

### Step 3: Run Generation & Verify Compilation
- Execute generation into `frontend/src/api/types.ts`.
- Verify `frontend/src/api/client.ts` imports and types compile cleanly.
- Run `pnpm --filter frontend build` to verify end-to-end type safety.

### Step 4: Verification & Tracking
- Run `bash scripts/check-hardcoded.sh`.
- Update `md/progress/SPARSH-PROGRESS.md`.
