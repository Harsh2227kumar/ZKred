# Pending work (paused 2026-10-25)

Paused while re-planning around the hackathon kit template (`D:\Download\hackathon-kit.zip`).
Full approved plan: `C:\Users\ACER\.claude\plans\f-hackathon-cascade-cascade26-problem-s-serialized-dusk.md`

PS: CASCADE '26 · Theme 4 · Problem 3 — The Identity Monopoly: Decentralized Portable Proofs.

## Decisions already made
- Stack: TypeScript full-stack
- ZK: BBS+ signatures (selective disclosure) + Circom/Groth16 range proof for age ≥ 21 (bound to the credential by a signed `Poseidon(dob, salt)` commitment)
- Registry: local EVM chain (Hardhat) with IssuerRegistry (key epochs), AnchorRegistry (batch Merkle roots, chain timestamp = trusted issuance time), StatusRegistry (bitstring revocation list hash)
- Breach defence: `markCompromised(key, now − 48h)` → only credentials whose batch was anchored before the cutoff stay valid; honest in-window credentials get re-issued under the rotated key
- Deliverables: working MVP + architecture/pitch docs + team-splittable skeleton

## Task status when paused (historical — superseded by md/VERSION-PLAN.md)
| # | Task | Status |
|---|---|---|
| 1 | Check toolchain | DONE: Node v24.15, npm 12, pnpm 12.15 (via corepack), git 2.54. **circom NOT installed**, Rust/cargo NOT installed |
| 2 | Scaffold monorepo + TEAM.md | TODO (now to be built from the hackathon kit) |
| 3 | Contracts + tests + deploy | TODO |
| 4 | Circom age circuit + TS wrapper | TODO (needs the circom binary: prebuilt Windows release or circom2 via npm) |
| 5 | Core lib: BBS, status list, merkle, verifier engine | TODO |
| 6 | Issuer API + seed + breach demo | TODO |
| 7 | Web app: issuer / wallet / verifier / attack | TODO |
| 8 | Docs, pitch, demo script, end-to-end verification | TODO |

## Kit adaptation: DONE
The hackathon kit has been adapted to ZKred. New decisions (these supersede the plan above where they differ):
- Team = 2: HARSH (backend + zk-core + contracts + circuits + Bedrock AI) · SPARSH (frontend + infra/EC2 + seed + docs/pitch)
- Backend Express + Zod + Drizzle + Postgres 16 (Docker); frontend Vite React + Tailwind + shadcn + TanStack Query
- Chain: Base Sepolia (Hardhat local as fallback); breach window configurable (`BREACH_WINDOW_SECONDS`)
- AI: Claude Sonnet on AWS Bedrock (`AnthropicBedrockMantle`, model id from env)
- Wallet: browser IndexedDB + client-side-encrypted server backup
- Deploy: one EC2 + docker compose + Caddy
- ~20h left at planning time

## Next
Resume at `md/VERSION-PLAN.md` V0 (HARSH: V0-H1…H5; SPARSH: V0-S1…S6).
