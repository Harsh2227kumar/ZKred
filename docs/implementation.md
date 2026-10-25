# V0-S3 Implementation: Repository Governance & CODEOWNERS

## 1. Updated `.github/CODEOWNERS`

Conforms strictly to `AGENTS.md §1` with real GitHub handles:
- **Lead / Backend & Crypto:** `@Harsh2227kumar`
- **Frontend / DevOps & Infra:** `@Sparsh566`

```ini
# ZKred CODEOWNERS — Automated Review Assignment
# Conforms strictly to AGENTS.md §1 and CONTRIBUTING.md

# Default fallback
*                                   @Harsh2227kumar

# HARSH: Backend, Crypto Core, Circuits, Contracts, Workspace Configs
/backend/                           @Harsh2227kumar
/packages/zk-core/                  @Harsh2227kumar
/contracts/                         @Harsh2227kumar
/circuits/                          @Harsh2227kumar
/package.json                       @Harsh2227kumar
/pnpm-workspace.yaml                @Harsh2227kumar
/tsconfig.base.json                 @Harsh2227kumar
/md/CONTRACTS.md                    @Harsh2227kumar
/md/progress/HARSH-PROGRESS.md      @Harsh2227kumar

# SPARSH: Frontend, Infra/Docker, Scripts, Seed, Docs, GitHub Configs
/frontend/                          @Sparsh566
/infra/                             @Sparsh566
/docker-compose.yml                 @Sparsh566
/scripts/                           @Sparsh566
/seed/                              @Sparsh566
/docs/                              @Sparsh566
/.github/                           @Sparsh566
/README.md                          @Sparsh566
/md/progress/SPARSH-PROGRESS.md     @Sparsh566

# Shared Markdown Planning
/md/                                @Harsh2227kumar @Sparsh566
```

---

## 2. GitHub Governance Configuration Checklist

1. **Default Branch**:
   - `dev` set as default branch in repository settings (all PRs target `dev` automatically).
2. **Branch Protections**:
   - **`main`**:
     - Require pull request before merging (1 approving review required).
     - Require review from Code Owners.
     - Restrict pushes (no direct commits).
     - Do not allow force pushes.
   - **`dev`**:
     - Require pull request before merging (1 approving review required).
     - Require review from Code Owners.
     - Restrict pushes (no direct commits).
     - Do not allow force pushes.
3. **Merge Strategies**:
   - Feature PRs (`<owner>/<task-id>-<name>` &rarr; `dev`): **Squash and merge**.
   - Release PRs (`dev` &rarr; `main`): **Merge commit** (preserves shared history).
   - Automatically delete head branches upon merge: **Enabled**.

---

## 3. Verification & Compliance
- Run `bash scripts/check-hardcoded.sh` (must return `check-hardcoded: OK`).
- Verify PR template matches `.github/PULL_REQUEST_TEMPLATE.md`.
- Update `md/progress/SPARSH-PROGRESS.md`.
