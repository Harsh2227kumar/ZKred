# CLAUDE.md

@AGENTS.md

All project rules live in `AGENTS.md` (imported above). This file only adds Claude Code–specific habits.

## Session start (do this every time)

1. Ask: **"Which owner are you (HARSH / SPARSH) and which task ID?"** unless the human already said.
2. Read `md/MVP-SCOPE.md`, `md/CONTRACTS.md`, the owner's section of `md/VERSION-PLAN.md`, and the owner's `md/progress/<OWNER>-PROGRESS.md`.
3. Run `git branch --show-current` and `git status`. If on `main` or `dev`, create the owner branch from `dev` before editing.

## Usage budget (HARSH is on Claude Pro)

- One task ID per session. Don't re-read files that are already in context.
- Use plan mode for any task touching more than 3 files; skip it for single-file edits.
- Don't spawn subagents unless the human asks.
- Prefer targeted `Read` with offsets and `Grep` over reading whole large files.

## While working

- Prefer `Edit` over rewriting whole files.
- Never touch files outside the owner's folders (`AGENTS.md` §1), even to "fix" an obvious bug. Log it as a request instead.
- No hardcoded data or config (`AGENTS.md` §2). If you are about to type a URL, key, address, sample record or option list into app code, stop and use config / API / DB instead.
- Crypto changes (`packages/zk-core`, `circuits`, `contracts`): write or extend a test first, and keep BBS message indices frozen.

## Before you say "done"

- Run the relevant check: `pnpm --filter backend test`, `pnpm --filter @zkred/zk-core test`, `pnpm --filter contracts test`, or `pnpm --filter frontend typecheck && pnpm --filter frontend lint`.
- Run `bash scripts/check-hardcoded.sh`.
- Print `git diff --stat` for the human.
- Append one line to the owner's progress file.
