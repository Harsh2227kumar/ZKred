# ZKred pitch: deck outline (draft)

> Status: **outline started in V1.2-S5**; slides and visuals are finished in V1.4-S2.
> Format: 8 slides + live demo, about 6 minutes, then judge Q&A. Rehearse twice on the live URL (V1.4-ALL).
> Every number on a slide comes from the live demo or the repo, never a made-up statistic.

---

## Slide 1: Title (10 s)

- **ZKred**: portable proofs, zero data exposure.
- CASCADE '26 · Theme 4 · Problem 3, *The Identity Monopoly*. Team HARSH + SPARSH.
- One-line hook: *"Prove you're a qualified doctor without handing over your name, birthday or address, and survive the day your university's signing key is stolen."*

## Slide 2: The problem (30 s)

- To prove one fact, people hand over whole documents: transcript, DOB, address.
- Verifiers phone the issuer's central database: a monopoly on the evidence, and a privacy leak every time.
- When an issuer's key leaks, today's systems can't tell a forgery from a real certificate. **Trust everything, or revoke everyone.**

## Slide 3: What we built (40 s)

Three roles, one picture (reuse the system overview in [architecture.md §1](architecture.md#1-system-overview)):

1. **Issuer** signs with BBS+ and anchors each batch's Merkle root on Base Sepolia.
2. **Holder** keeps credentials in a browser wallet. The server never stores their PII.
3. **Verifier** types the requirement in plain English → Claude on Bedrock → a strict, minimal proof policy.

Say: *"The issuer signs, the chain timestamps, the holder discloses, and the verifier checks all three without calling the issuer."*

## Slide 4: Live demo, part 1: verify (about 2 min, live)

Follow [README → Demo script](../README.md#demo-script-steps-17-5-min), steps 1–5:

- Employer sentence → policy chips with minimisation notes ("DOB not requested: proving age ≥ 21 with ZK instead").
- Wallet consent screen: **revealed** / **proven in zero knowledge** / **never leaves the device**.
- The eval chain goes green: Issuer Signature → ZK Claim → Revocation Status → Key-Epoch/Anchor → **Verified Portable Credential**.
- Point at the "never received: name, DOB, address" panel.

Backup: the recorded video (V1.4-S2) if the venue Wi-Fi fails.

## Slide 5: Live demo, part 2: the breach (the wow, about 1.5 min, live)

Steps 6–7 on the attack console:

- Steal AIIMS Nagpur's signing key → forge **200 degrees** → slip them into a real batch that gets anchored.
- Full verifier: **200 / 200 accepted** (signed, anchored, in the Merkle root). The naive signature-only verifier is fooled too.
- Issuer clicks **Report compromise**, which sends one transaction.
- Verify again: **0 / 200 accepted, 200 isolated**. Asha's legacy degree **still verifies**. Meera's in-window degree shows *Needs refresh* → refresh → ✓.

Say it out loud: ***"We trust chain time, not claimed time."***

## Slide 6: How it works (60 s, for technical judges)

- **BBS+** gives unlinkable selective disclosure of signed fields. **Groth16** proves age ≥ 21 on a Poseidon commitment that the issuer signed.
- **Anchors carry block time**, which can't be backdated. `markCompromised(key, now − window)` invalidates exactly what was anchored after the cutoff.
- **Re-issue can't launder forgeries.** The commitment must be in the registrar's own records, and the credential must be byte-for-byte the one the issuer signed (its recorded digest).
- **Revocation with herd privacy:** verifiers download the whole 16k-entry status list, and only its hash is on-chain.
- **Fail closed:** if the chain can't be read, verification is rejected, never "probably fine".

## Slide 7: Why it matters / what's next (30 s)

- Works today: real chain, real proofs in the browser, real AI policy compiler; no fake data anywhere (`check-hardcoded.sh` gate).
- Next (md/VERSIONS.md): ZK Merkle membership to hide the batch; ZK non-revocation; holder binding so a copied credential file is useless; OpenID4VC interop.

## Slide 8: Team + ask (10 s)

- HARSH: backend, crypto, contracts, circuit, AI. SPARSH: frontend, DevOps/EC2, seed, QA, docs, pitch.
- Links: live URL, repo, contracts on BaseScan.

---

## Judge Q&A cheat sheet

| Question | One-line answer |
|---|---|
| Why BBS+ and not just a SNARK? | BBS+ gives cheap, unlinkable selective disclosure of signed fields; the SNARK is only for a predicate (age ≥ 21) on a hidden value, bound to the signature through a signed Poseidon commitment. |
| How do you isolate forged degrees without revoking everyone? | Issuance time is the on-chain anchor's block time. After `markCompromised(key, now − window)`, only batches anchored before the cutoff stay valid; honest in-window holders refresh. |
| Couldn't the attacker re-issue a forgery under the new key? | No. Re-issue checks the registrar's own records and the exact signed credential (its digest); forgeries never entered the records, and a copy of an honest serial with other claims has a different signature. |
| Does revocation leak who was revoked? | No. Verifiers download the whole list; only its hash is on-chain. |
| What does the verifier still learn? | The fields the policy asks for, the issuer, and the batch + status slot (k-anonymity within a batch). V2 hides those with ZK membership + non-revocation. |
| Where does my data live? | Only in your browser, plus a backup that only your passphrase opens. |
| What if Bedrock or the RPC is down? | Bedrock: a visible error and the manual policy builder. RPC: verification fails closed. |
| Is the AI trusted? | No. Its output is a structured policy validated by Zod (one retry); privacy rules such as never revealing DOB are enforced in code, not by the prompt. |

## Timing plan

| Part | Time |
|---|---|
| Slides 1–3 | 1:20 |
| Demo part 1 (verify) | 2:00 |
| Demo part 2 (breach) | 1:30 |
| Slides 6–8 | 1:40 |
| **Total** | **≈ 6:30** (cut slide 7 if over) |
