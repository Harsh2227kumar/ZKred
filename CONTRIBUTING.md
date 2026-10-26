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

## Testing

**The test type follows from what the task touches.** The task owner writes the tests in the same PR; nobody "adds tests later".

| If the task… | It needs | Written |
|---|---|---|
| **Decides accept / reject**: crypto, verification, revocation, breach, auth (admin / wallet tokens) | **TDD**: write the failing *attack* test first, then the code | Before the code |
| **Adds or changes an endpoint or a DB write** | **Integration test**: real Postgres (+ local Hardhat chain if it writes on-chain); happy path + at least one bad request that must return 4xx, never 500 | Same PR |
| **Is pure logic** (helpers, parsing, mapping) | **Unit test** | Same PR |
| **Is UI, docs, infra or seed** | **Manual check**, written as steps under "How to test" in the PR | At review |

Rules:

- **Every security check gets at least one test where an attacker tries to get past it.** Happy-path tests alone missed the V0 age-proof bypass: valid proofs passed, but nobody tried a forged public signal.
- Test the *failure* paths of integrations too (wrong chain, DB down, model returns junk), not just "it works".
- Tests live in `test/` mirroring `src/` (AGENTS.md §7). No literals for keys or records: use factories (AGENTS.md §2).
- In the PR description, write one line: `Tests: TDD | integration | unit | manual — <what>`. The reviewer rejects the PR if it doesn't match the table above.

**Gates**

| When | What runs | Who |
|---|---|---|
| Every PR | Typecheck + all tests + `check-hardcoded.sh` (by hand until CI exists, then CI as a required check) | Author; reviewer checks it's green |
| Every `dev` → `main` release | End-to-end demo flow on `dev` (issue → claim → present → verify; revoke → rejected; compromise → in-window rejected) | Releaser. A failed demo means no release |

CI (`.github/workflows/ci.yml`, V1.3-S2) should land **before** the V1 endpoint work, not after it, so every V1 PR is checked automatically.

### Which test for which task

| Task | Owner | Test type | Must include |
|---|---|---|---|
| V1-H1 issuers, keys, chain | HARSH | Integration (API + DB + Hardhat node) · unit for gov-key encryption | non-admin token → 401; on-chain issuer matches DB |
| V1-H2 issuance, batches, anchor | HARSH | Integration · **TDD** for batch/status slots | each credential gets a unique status index; leaf lands in the open batch; anchored root = `merkleRoot(leaves)` |
| V1-H3 wallet endpoints | HARSH | Integration · **TDD** for auth | wallet A's token can't read or claim wallet B's offers or backup |
| V1-H4 verifiers + requests | HARSH | Integration | expired request → 410; `parse` / `presentations` → 501 until V1.1 |
| V1.1-H1 `buildPresentation` | HARSH | **TDD** (zk-core) | build → verify round-trip; missing credential → `MISSING_CREDENTIAL`; never reveals a `never_collect` field |
| V1.1-H2 verifier engine | HARSH | **TDD** (most important) | one failing test per step code; disclosed `1`/`2` must equal the item's `issuer_did`/`key_id`; `age_proof.public_signals[0]` must equal disclosed `13`; nonce reuse → `NONCE_USED` |
| V1.1-H3 Bedrock policy | HARSH | Unit with a stubbed model | junk output → `AI_BAD_OUTPUT` after 1 retry; never returns an unvalidated policy |
| V1.2-H1 revocation | HARSH | **TDD** | revoked → `REVOKED`; edited list → `REVOCATION_LIST_TAMPERED` |
| V1.2-H2 breach + reissue | HARSH | **TDD** | forged ✗, legacy ✓, reissued ✓; reissue refuses a forged or revoked credential |
| V1.2-H3 attack endpoints | HARSH | Integration | 404 when `DEMO_MODE=false`; counters match |
| V1-S1…S5, V1.1-S1…S3, V1.2-S1…S4 (UI) | SPARSH | Manual (PR steps) | API types from `gen:api` only, so contract drift fails the typecheck |
| V1-S4 seed | SPARSH | Manual | running it twice changes nothing (idempotent) |
| V1.1-S4 QA pass, releases | SPARSH | End-to-end demo on EC2 | bugs logged in the progress file |

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
