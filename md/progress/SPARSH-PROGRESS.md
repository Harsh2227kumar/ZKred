# SPARSH — Progress

**Role:** Frontend · DevOps (Docker, EC2, Caddy, Bedrock access) · seed pipeline · QA · docs · pitch
**Owns:** `frontend/`, `infra/`, `docker-compose.yml`, `scripts/`, `seed/`, `docs/`, `.github/`, `README.md`, `*.env.example`
**AI tools:** Antigravity / opencode (free models). Always paste the task ID + its numbered steps from `md/VERSION-PLAN.md`; never let the agent write crypto.
**Current branch:** `<branch>`
**Current task:** `<task ID from VERSION-PLAN.md>`

> Only SPARSH (and SPARSH's AI agent) edits this file. Append; don't rewrite history.
> Read the bottom of this file aloud at every sync.

---

## Status board

| Task ID | Task | Status | PR |
|---|---|---|---|
| V0-S1 | Frontend scaffold | DONE | #10 |
| V0-S2 | docker-compose + Dockerfiles + Caddyfile + .env.examples | DONE | #11 |
| V0-S3 | GitHub repo settings, CODEOWNERS handles | DONE | #12 |
| V0-S4 | EC2 deploy hello-world | DONE | #13 |
| V0-S5 | Bedrock model access + credentials | DONE | #14 |

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

- 18:50 | V0-S1 | DONE | Vite React 19 + TS + Tailwind v4 frontend scaffold; PR #10 | frontend/, pnpm-lock.yaml
- 19:25 | V0-S2 | DONE | Container infra: docker-compose.yml; backend.Dockerfile; frontend.Dockerfile; Caddyfile; PR #11 | docker-compose.yml, infra/, *.env.example, docs/
- 19:42 | V0-S3 | DONE | GitHub repo governance: .github/CODEOWNERS with @Harsh2227kumar & @Sparsh566; PR #12 | .github/CODEOWNERS, docs/
- 19:50 | V0-S4 | DONE | EC2 deployment automation tooling: setup-ec2.sh, deploy.sh; PR #13 | infra/, docs/
- 20:15 | V0-S5 | DONE | Bedrock integration setup guide: IAM policies, AnthropicBedrock SDK Runtime, pingModel() check | docs/

## Notes for the pitch

> Things judges might ask about my part, with one-line answers.

- *Where does my data live?* Only in your browser, plus an encrypted backup that only your passphrase opens.
- *How is it deployed?* One EC2 with docker compose: Postgres, API, and Caddy (HTTPS + frontend). The same file runs on a laptop.
