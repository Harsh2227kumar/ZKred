// Breach response (CONTRACTS §3.2 compromise, §4.2 reportCompromise). The issuer declares a signing key compromised
// from `chain time − window`; batches anchored before that cutoff stay valid ("chain time, not claimed time"),
// batches anchored inside the window need re-issue, and open batches of that key can never be anchored again.
// A compromised active key is rotated in the same call so the issuer can keep issuing.
import type { Hex32 } from "@zkred/zk-core";
import { config } from "../config";
import * as issuanceRepo from "../db/repositories/issuance.repo";
import * as repo from "../db/repositories/issuers.repo";
import * as chain from "../integrations/chain";
import type { CompromiseReport } from "../schemas/issuers.schema";
import { AppError } from "./errors";
import { keyRow, newSigningKey, openGovernanceKey, toIssuerKey, withIssuerLock } from "./issuers";

type Verdict = CompromiseReport["affected_batches"][number]["verdict"];

function verdictFor(batch: issuanceRepo.BatchRow, compromisedFrom: Date): Verdict {
  if (batch.status !== "anchored" || !batch.anchoredAt) return "unanchored_invalid";
  return batch.anchoredAt.getTime() < compromisedFrom.getTime() ? "legacy_valid" : "in_window_needs_reissue";
}

export async function reportCompromise(
  issuerId: string,
  keyId: Hex32,
  windowSeconds: number = config.BREACH_WINDOW_SECONDS,
): Promise<CompromiseReport> {
  return withIssuerLock(issuerId, async () => {
    const issuer = await repo.findIssuerWithSecrets(issuerId);
    if (!issuer) throw new AppError("NOT_FOUND", "Issuer not found");
    const key = await repo.findKey(keyId);
    if (!key || key.issuerId !== issuerId) throw new AppError("NOT_FOUND", "Key not found for this issuer");
    const governanceKey = openGovernanceKey(issuer.did, issuer.governanceKeyEnc);
    const txHashes: string[] = [];

    // Cutoff on the chain's clock, whole seconds (the contract stores uint64 seconds).
    const now = await chain.latestBlockTime();
    let compromisedFrom = new Date(Math.max(0, Math.floor(now.getTime() / 1000) - windowSeconds) * 1000);

    const onchain = await chain.getKey(keyId);
    if (!onchain) throw new AppError("CONFLICT", "Key is not registered on-chain");
    if (onchain.status === "compromised" && onchain.compromisedFrom && onchain.compromisedFrom.getTime() <= compromisedFrom.getTime()) {
      // Already reported with an earlier (or equal) cutoff, e.g. a previous call mined but didn't finish: keep it.
      compromisedFrom = onchain.compromisedFrom;
    } else {
      txHashes.push((await chain.markCompromised(governanceKey, issuer.issuerChainId as Hex32, keyId, compromisedFrom)).txHash);
    }

    let newKeyRow: repo.NewIssuerKeyRow | null = null;
    if (key.status === "active") {
      const next = await newSigningKey();
      const tx = await chain.rotateKey(governanceKey, issuer.issuerChainId as Hex32, keyId, next.keyId, next.pubKeyHash);
      txHashes.push(tx.txHash);
      newKeyRow = keyRow(next, tx);
    }
    await repo.recordCompromise(issuerId, keyId, compromisedFrom, newKeyRow);

    const active = (await repo.findIssuer(issuerId))?.keys.find((k) => k.status === "active");
    if (!active) throw new AppError("CONFLICT", "Issuer has no active key after the compromise report");
    // An empty batch (an issuance that failed after opening it) holds no credential: nothing to report.
    const batches = (await issuanceRepo.listBatchesByKey(keyId)).filter((b) => b.leaves.length > 0);
    return {
      key_id: keyId,
      compromised_from: compromisedFrom.toISOString(),
      new_key: toIssuerKey(active),
      tx_hashes: txHashes,
      affected_batches: batches.map((b) => ({
        batch_id: b.batchId as Hex32,
        anchored_at: b.anchoredAt?.toISOString() ?? null,
        verdict: verdictFor(b, compromisedFrom),
      })),
    };
  });
}
