# Git workflow (2-person, 20-hour edition)

**Two long-lived branches — `main` (stable) and `dev` (integration) — plus short-lived owner branches.** No `frontend`/`backend` branches.

```
<owner>/<task-id>-<name> ──PR──▶ dev ──release PR (only when stable)──▶ main ──▶ EC2
```

## Branches

| Branch | Rule |
|---|---|
| `main` | Protected. **Stable only**: always runs and is always demoable. Deployed to EC2 by `git pull` + `docker compose up -d --build`. Changes only via a release PR from `dev`. Updated rarely, never directly. |
| `dev` | Protected. **Integration / testing branch**: holds the full latest code. Every feature PR targets `dev`. May be briefly broken; fix it fast. |
| `<owner>/<task-id>-<name>` | One task, branched from `dev`; lives 30 min – 3 h. e.g. `sparsh/V1-S2-wallet-inbox`, `harsh/V1.1-H2-verifier-engine` |
| `hotfix/<name>` | Only after the feature freeze, for demo-breaking bugs. Branched from `main`, PR → `main`, then merge `main` back into `dev`. |

## Loop (every task)

```bash
git switch dev && git pull --ff-only
git switch -c sparsh/V1-S3-verifier-pages
# ... work, commit after every working step ...
bash scripts/check-hardcoded.sh
git fetch origin && git rebase origin/dev
git push -u origin sparsh/V1-S3-verifier-pages
# open a PR -> dev using the template
```

## Releasing `dev` → `main`

Only when `dev` is stable — not after every PR.

1. On `dev`: app builds and starts (`docker compose up -d --build`), the demo flow works end to end, `check-hardcoded.sh` passes.
2. Open a PR **`dev` → `main`** titled `release: <what's in it>`. The other person approves.
3. **Merge with a merge commit** (not squash), so `main` and `dev` keep a shared history.
4. Deploy `main` to EC2 and run the smoke test (`/api/v1/health`).

## Commits

Conventional + task ID: `feat(frontend): V1-S3 verifier result page polls verifications`
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

## Pull requests

- Feature PRs target **`dev`**, never `main`.
- Small: ideally < 300 changed lines, only your own folders.
- Fill in the template (`.github/PULL_REQUEST_TEMPLATE.md`).
- **1 approval from the other person** (HARSH reviews SPARSH, SPARSH reviews HARSH). Review within 10 minutes: only owner folders touched, no hardcoded data, no contract change, it runs.
- HARSH merges (backup: SPARSH). Feature PRs → `dev`: **Squash and merge.** Delete the branch after merging.
- **Don't stack branches.** Branch each task from `dev`, not from another open task branch. If you must build on an unmerged branch, after the lower PR is squash-merged run `git fetch origin && git rebase origin/dev` on the upper branch before merging it.
- Merge cadence: each person lands something in `dev` at least every 2 hours.
- If the reviewer is asleep (rest window), the author may self-merge **only** a green PR into `dev` inside their own folders, and note it in their progress file. Never self-merge into `main`.

## Conflicts

- The branch owner resolves them: rebase on `dev`, read both sides, rerun the app.
- A conflict in a file you don't own means ownership broke. Tell HARSH.

## Never

- Push directly to `main` or `dev` · open a feature PR into `main` · force-push the other person's branch · commit `.env`, private keys or wallet tokens
- Merge with a failing check or a failing `check-hardcoded.sh`
- Let an AI agent push, merge, or choose the branch on its own

## GitHub settings (SPARSH, H0)

- HARSH creates the repo and adds SPARSH as admin.
- Default branch: **`dev`** (so new PRs target it automatically).
- Branch protection on **`main` and `dev`**: require PR, 1 approval, block force pushes, require status checks once CI exists.
- Settings → auto-delete head branches: ON. Allow squash merge (feature PRs) and merge commits (release PRs).
- Replace `@HARSH` / `@SPARSH` in `.github/CODEOWNERS` with real handles.

## Timeline gates (H0 = planning frozen; ~20h total)

| When | Rule |
|---|---|
| H15 | **Feature freeze.** Only fixes, polish, seed data, docs. Release `dev` → `main`. |
| H17 | Only `hotfix/*` PRs into `main`, demo-breaking bugs only |
| H19 | **Code freeze.** Nobody merges. Tag `demo-final` on `main` |
