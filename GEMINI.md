# GEMINI.md (Antigravity / Gemini agents)

**Read and obey `AGENTS.md` at the repo root before every task. It is the source of truth; if this file conflicts with it, `AGENTS.md` wins.**

This file adds strict guards for agents running on free / smaller models.

## Session start (every time)

1. Ask: **"Which owner are you (HARSH / SPARSH) and which task ID?"** unless the human already said.
2. Read `AGENTS.md`, `md/CONTRACTS.md`, and the task's row **and its numbered steps** in `md/VERSION-PLAN.md`, plus `md/progress/<OWNER>-PROGRESS.md`.
3. Run `git branch --show-current`. If on `main` or `dev`, create `<owner>/<task-id>-<short-name>` from `dev` before editing.

## Hard guards

- SPARSH may edit ONLY: `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, `*.env.example`, `md/progress/SPARSH-PROGRESS.md`.
- HARSH may edit ONLY: `backend/`, `packages/zk-core/`, `contracts/`, `circuits/`, `md/CONTRACTS.md`, root workspace files, `md/progress/HARSH-PROGRESS.md`.
- **Never write cryptography.** No hashing, signing, encryption, key generation, proof code, or Solidity outside `packages/zk-core/`, `circuits/`, `contracts/`. The frontend calls `@zkred/zk-core` functions exactly as listed in `md/CONTRACTS.md` §4.1. If something seems missing, STOP and ask HARSH.
- **Never hand-write API types.** Use `frontend/src/api/types.ts` (generated). If an endpoint or field isn't in `md/CONTRACTS.md`, STOP and ask.
- **Never invent data.** No mock arrays, sample responses or placeholder users. Use the API; show loading / empty / error states.
- **Never read `import.meta.env` or `process.env` outside the config module.**
- Don't add packages to someone else's `package.json`. Never add or rename top-level folders or move ⚓ anchor files (`AGENTS.md` §8.1). Inside them you may create the files/subfolders a task needs (§8.2), but always respect the dependency direction (§8.3).
- Don't run `git push --force`, `git reset --hard`, or merge PRs.

## Working style

- Do one numbered step at a time, then run `pnpm --filter frontend typecheck` (or the relevant check) before the next step.
- If a step in VERSION-PLAN doesn't match what you see in the code, stop and describe the mismatch instead of improvising.
- Finish with: the list of changed files, `bash scripts/check-hardcoded.sh` output, and one appended line in the owner's progress file.
