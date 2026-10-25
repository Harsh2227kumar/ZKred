// Planned key rotation (CONTRACTS §3.2 POST /issuers/{id}/keys/rotate). The old key's open batches are anchored
// first: after rotateKey the chain refuses anchors from it, and those credentials would be stuck unverifiable.
import type { Hex32 } from "@zkred/zk-core";
import * as repo from "../db/repositories/issuers.repo";
import * as chain from "../integrations/chain";
import type { IssuerKey } from "../schemas/issuers.schema";
import { AppError } from "./errors";
import { anchorOpenBatchesOfKey } from "./issuance";
import { keyRow, newSigningKey, openGovernanceKey, withIssuerLock } from "./issuers";

/** Retires the active key on-chain and in the DB; the new key signs every credential from now on. */
export async function rotateIssuerKey(issuerId: string): Promise<IssuerKey> {
  return withIssuerLock(issuerId, async () => {
    const issuer = await repo.findIssuerWithSecrets(issuerId);
    if (!issuer) throw new AppError("NOT_FOUND", "Issuer not found");
    const current = await repo.findActiveKeyWithSecret(issuerId);
    if (!current) throw new AppError("CONFLICT", "Issuer has no active key to rotate");

    await anchorOpenBatchesOfKey(issuer, current.keyId);

    const key = await newSigningKey();
    const tx = await chain.rotateKey(
      openGovernanceKey(issuer.did, issuer.governanceKeyEnc),
      issuer.issuerChainId as Hex32,
      current.keyId as Hex32,
      key.keyId,
      key.pubKeyHash,
    );
    const row = keyRow(key, tx);
    await repo.recordKeyRotation(issuerId, current.keyId, row);
    return {
      key_id: key.keyId,
      public_key: row.publicKey,
      status: "active",
      active_from: tx.blockTime.toISOString(),
      compromised_from: null,
      tx_hash: tx.txHash,
    };
  });
}
