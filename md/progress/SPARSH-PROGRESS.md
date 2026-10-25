# SPARSH — Progress

**Role:** Frontend · DevOps (Docker, EC2, Caddy, Bedrock access) · seed pipeline · QA · docs · pitch
**Owns:** `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, `*.env.example`
**AI tools:** Antigravity / opencode (free models). Always paste the task ID + its numbered steps from `md/VERSION-PLAN.md`; never let the agent write crypto.
**Current branch:** `sparsh/V0-S0-scope-setup`
**Current task:** `V0-S0`

> Only SPARSH (and SPARSH's AI agent) edits this file. Append; don't rewrite history.
> Read the bottom of this file aloud at every sync.

---

## Status board

| Task ID | Task | Status | PR |
|---|---|---|---|
| V0-S0 | Scope freeze & environment templates | DONE | |
| V0-S1 | Frontend scaffold | TODO | |
| V0-S2 | docker-compose + Dockerfiles + Caddyfile + .env.examples | TODO | |
| V0-S3 | GitHub repo settings, CODEOWNERS handles | TODO | |
| V0-S4 | EC2 deploy hello-world | TODO | |
| V0-S5 | Bedrock model access + credentials | TODO | |

## Blocked on

| Since | Waiting for | From whom | Contract / task |
|---|---|---|---|
| | | | |

## Requests to others

> Changes I need in files I don't own. The owner moves them into their own status board.

| Time | To | Request | Why | Done? |
|---|---|---|---|---|
| | | | | |

## Contract change requests (to HARSH)

| Time | Endpoint / table / env var | Proposed change | Approved? |
|---|---|---|---|
| | | | |

## Log

Format: `HH:MM | TASK-ID | STARTED/DONE/BLOCKED/HANDOFF | what happened | files`

- 18:35 | V0-S0 | DONE | Froze MVP-SCOPE.md at 18:30 (Gate 0); created root .env.example matching backend config, contracts/.env.example, scripts/.env.example; verified check-hardcoded.sh OK | md/MVP-SCOPE.md, .env.example, contracts/.env.example, scripts/.env.example, docs/

## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Where does my data live?* Only in your browser, plus an encrypted backup that only your passphrase opens.
- *How is it deployed?* One EC2 with docker compose: Postgres, API, and Caddy (HTTPS + frontend). The same file runs on a laptop.
