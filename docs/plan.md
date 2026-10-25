# V0-S3 Plan: GitHub Repository Governance & CODEOWNERS

## Overview
- **Task ID:** `V0-S3` (per `md/VERSION-PLAN.md`)
- **Owner:** SPARSH
- **Target Output:** Active `.github/CODEOWNERS` with verified real GitHub handles (`@Harsh2227kumar` and `@Sparsh566`), repository branch protection verification, PR workflow compliance, and check script integrity.
- **Done When:** All placeholder handles in `.github/CODEOWNERS` are replaced with real GitHub handles, PR template functions seamlessly, and `bash scripts/check-hardcoded.sh` passes.

---

## 1. Scope & Impact

### A. Automatic Code Review & Ownership Enforcement
- Replace placeholders `@HARSH` and `@SPARSH` with `@Harsh2227kumar` and `@Sparsh566`.
- Ensures GitHub automatically assigns the designated owner as a required reviewer on every PR that modifies their owned directories.
- Protects frozen files (`md/CONTRACTS.md`, root workspace configurations) and crypto packages (`packages/zk-core/`, `circuits/`, `contracts/`).

### B. Branch Protections & Repository Settings
- Confirm `main` and `dev` branch protections (prevent direct pushes, enforce PR reviews before merging, prevent force pushes).
- Verify default branch is set to `dev` for feature PR target consistency.
- Verify automatic deletion of head branches on PR merge.

---

## 2. Step-by-Step Execution Plan

### Step 1: Update `.github/CODEOWNERS`
- Map every folder per `AGENTS.md §1`:
  - Default owner: `@Harsh2227kumar`
  - Backend, crypto core, contracts, circuits, and root workspace files: `@Harsh2227kumar`
  - Frontend, infra, docker-compose, scripts, seed, docs, `.github/`, and README: `@Sparsh566`
  - Shared tracking files (`md/progress/`): Individual ownership.

### Step 2: Validate PR Template (`.github/PULL_REQUEST_TEMPLATE.md`)
- Ensure the template enforces task ID tracking, change breakdown, testing declaration (`Tests: TDD | integration | unit | manual`), and the compliance checklist.

### Step 3: Verify Integrity & Hardcoded Checks
- Run `bash scripts/check-hardcoded.sh` to ensure no prohibited literals or hardcoded secrets are introduced.

### Step 4: Progress Tracking
- Update `md/progress/SPARSH-PROGRESS.md` logging `V0-S3` completion.
