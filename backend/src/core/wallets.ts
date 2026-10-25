// Holder wallets (CONTRACTS §3.3). The server only ever sees ciphertext: offers are encrypted to the wallet key,
// backups with the holder's passphrase. The wallet token is returned once and stored as a SHA-256 hash.
import { walletCrypto } from "@zkred/zk-core";
import * as repo from "../db/repositories/wallets.repo";
import { isUniqueViolation } from "../db/errors";
import type { Backup, BackupIn, CredentialOffer, WalletCreate, WalletCreated, WalletPublic } from "../schemas/wallets.schema";
import { hashWalletToken, newWalletToken } from "./auth";
import { AppError } from "./errors";

const toOffer = (o: repo.OfferRow): CredentialOffer => ({
  id: o.id,
  wallet_id: o.walletId,
  issuer_id: o.issuerId,
  credential_type: o.credentialType,
  ephemeral_public_key: o.ephemeralPublicKey,
  iv: o.iv,
  ciphertext: o.ciphertext,
  created_at: o.createdAt.toISOString(),
  claimed_at: o.claimedAt?.toISOString() ?? null,
});

const toBackup = (b: repo.BackupRow): Backup => ({
  wallet_id: b.walletId,
  ciphertext: b.ciphertext,
  iv: b.iv,
  salt: b.salt,
  kdf_iterations: b.kdfIterations,
  version: b.version,
  updated_at: b.updatedAt.toISOString(),
});

export async function createWallet(input: WalletCreate): Promise<WalletCreated> {
  if (!(await walletCrypto.isValidPublicKey(input.enc_public_key))) {
    throw new AppError("VALIDATION_ERROR", "Invalid wallet key", { enc_public_key: "not a raw P-256 public key" });
  }
  const token = newWalletToken();
  try {
    const row = await repo.insertWallet({
      displayName: input.display_name,
      encPublicKey: input.enc_public_key,
      tokenHash: hashWalletToken(token),
    });
    return { id: row.id, display_name: row.displayName, wallet_token: token };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "Display name is taken", { display_name: "already taken" });
    throw err;
  }
}

export async function lookupWallet(displayName: string): Promise<WalletPublic> {
  const row = await repo.findWalletByDisplayName(displayName);
  if (!row) throw new AppError("NOT_FOUND", "Wallet not found");
  return { id: row.id, display_name: row.displayName, enc_public_key: row.encPublicKey };
}

/** The wallet a token opens, or null for an unknown token. */
export const walletIdForToken = (token: string): Promise<string | null> => repo.findWalletIdByTokenHash(hashWalletToken(token));

export async function listOffers(walletId: string): Promise<{ items: CredentialOffer[] }> {
  return { items: (await repo.listOffers(walletId)).map(toOffer) };
}

export async function claimOffer(walletId: string, offerId: string): Promise<CredentialOffer> {
  const offer = await repo.claimOffer(walletId, offerId, new Date());
  if (!offer) throw new AppError("NOT_FOUND", "Offer not found");
  return toOffer(offer);
}

export async function saveBackup(walletId: string, input: BackupIn): Promise<Backup> {
  return toBackup(
    await repo.upsertBackup({
      walletId,
      ciphertext: input.ciphertext,
      iv: input.iv,
      salt: input.salt,
      kdfIterations: input.kdf_iterations,
      version: input.version,
      updatedAt: new Date(),
    }),
  );
}

export async function getBackup(walletId: string): Promise<Backup> {
  const backup = await repo.findBackup(walletId);
  if (!backup) throw new AppError("NOT_FOUND", "No backup for this wallet yet");
  return toBackup(backup);
}
