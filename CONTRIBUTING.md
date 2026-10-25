# Git workflow (2-person, 20-hour edition)

**One protected `main` + short-lived owner branches.** No permanent `dev`/`frontend`/`backend` branches.

## Branches

| Branch | Rule |
|---|---|
| `main` | Protected. Always runs and is always demoable. Deployed to EC2 by `git pull` + `docker compose up -d --build`. Changes only via PR merges. |
| `<owner>/<task-id>-<name>` | One task; lives 30 min – 3 h. e.g. `sparsh/V1-S2-wallet-inbox`, `harsh/V1.1-H2-verifier-engine` |
| `hotfix/<name>` | Only after the feature freeze, for demo-breaking bugs |

## Loop (every task)

```bash
git switch main && git pull --ff-only
git switch -c sparsh/V1-S3-verifier-pages
# ... work, commit after every working step ...
bash scripts/check-hardcoded.sh
git fetch origin && git rebase origin/main
git push -u origin sparsh/V1-S3-verifier-pages
# open a PR -> main using the template
```

## Commits

Conventional + task ID: `feat(frontend): V1-S3 verifier result page polls verifications`
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

## Pull requests

- Small: ideally < 300 changed lines, only your own folders.
- Fill in the template (`.github/PULL_REQUEST_TEMPLATE.md`).
- **1 approval from the other person** (HARSH reviews SPARSH, SPARSH reviews HARSH). Review within 10 minutes: only owner folders touched, no hardcoded data, no contract change, it runs.
- HARSH merges (backup: SPARSH). **Squash and merge.** Delete the branch after merging.
- Merge cadence: each person lands something in `main` at least every 2 hours.
- If the reviewer is asleep (rest window), the author may self-merge **only** a green PR inside their own folders, and note it in their progress file.

## Conflicts

- The branch owner resolves them: rebase on `main`, read both sides, rerun the app.
- A conflict in a file you don't own means ownership broke. Tell HARSH.

## Never

- Push to `main` · force-push the other person's branch · commit `.env`, private keys or wallet tokens
- Merge with a failing check or a failing `check-hardcoded.sh`
- Let an AI agent push, merge, or choose the branch on its own

## GitHub settings (SPARSH, H0)

- HARSH creates the repo and adds SPARSH as admin.
- Branch protection on `main`: require PR, 1 approval, block force pushes, require status checks once CI exists.
- Settings → auto-delete head branches: ON. Allow only squash merge.
- Replace `@HARSH` / `@SPARSH` in `.github/CODEOWNERS` with real handles.

## Timeline gates (H0 = planning frozen; ~20h total)

| When | Rule |
|---|---|
| H15 | **Feature freeze.** Only fixes, polish, seed data, docs |
| H17 | Only `hotfix/*` PRs, demo-breaking bugs only |
| H19 | **Code freeze.** Nobody merges. Tag `demo-final` |
