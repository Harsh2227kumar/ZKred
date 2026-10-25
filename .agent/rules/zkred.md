---
trigger: always_on
---

# ZKred workspace rules (Antigravity)

1. Before any task, read `AGENTS.md` and `GEMINI.md` at the repo root and follow them exactly. `AGENTS.md` wins on conflicts.
2. Ask which owner (HARSH / SPARSH) and task ID from `md/VERSION-PLAN.md` before editing.
3. Edit only the owner's folders (AGENTS.md §1). Never edit the other member's progress file.
4. Never write cryptography outside `packages/zk-core/`, `circuits/`, `contracts/`. The frontend calls `@zkred/zk-core` only.
5. Zero hardcoded data: config via the single config module; data via the API; option lists via `/meta/enums`.
6. Unfinished logic = explicit `501` / thrown error, never fake data. Verification fails closed.
7. Work on branch `<owner>/<task-id>-<name>`; never commit to `main`, never force-push, never merge.
8. Keep the fixed skeleton + anchors (`AGENTS.md` §8.1); create files/subfolders freely inside them (§8.2); never break the dependency direction (§8.3).
9. Before finishing: run the owner's checks + `bash scripts/check-hardcoded.sh`, list changed files, append one progress-log line.
