import { z } from "zod";
import { Base64url, DateTime, Uuid } from "./common.schema";
import { CredentialType } from "./issuance.schema";

const NonEmptyBase64url = Base64url.min(1);

export const WalletCreate = z
  .object({
    display_name: z.string().trim().min(2).max(60),
    enc_public_key: NonEmptyBase64url.meta({ description: "ECDH P-256 public key (raw), generated in the browser" }),
  })
  .meta({ id: "WalletCreate" });

export const WalletCreated = z
  .object({ id: z.uuid(), display_name: z.string(), wallet_token: z.string().meta({ description: "Shown once" }) })
  .meta({ id: "WalletCreated" });

export const WalletLookupQuery = z.object({ display_name: z.string().trim().min(2).max(60) });

export const WalletPublic = z
  .object({ id: z.uuid(), display_name: z.string(), enc_public_key: Base64url })
  .meta({ id: "WalletPublic" });

export const CredentialOffer = z
  .object({
    id: z.uuid(),
    wallet_id: z.uuid(),
    issuer_id: z.uuid(),
    credential_type: CredentialType,
    ephemeral_public_key: Base64url,
    iv: Base64url,
    ciphertext: Base64url.meta({ description: "ECDH-ES + AES-256-GCM of the SignedCredential JSON" }),
    created_at: DateTime,
    claimed_at: DateTime.nullable(),
  })
  .meta({ id: "CredentialOffer" });

export const CredentialOfferList = z.object({ items: z.array(CredentialOffer) }).meta({ id: "CredentialOfferList" });

export const BackupIn = z
  .object({
    ciphertext: NonEmptyBase64url,
    iv: NonEmptyBase64url,
    salt: NonEmptyBase64url,
    kdf_iterations: z.number().int().positive(),
    version: z.number().int().positive(),
  })
  .meta({ id: "BackupIn" });

export const Backup = BackupIn.extend({ wallet_id: z.uuid(), updated_at: DateTime }).meta({ id: "Backup" });

export const WalletParams = z.object({ wallet_id: Uuid });
export const WalletOfferParams = z.object({ wallet_id: Uuid, offer_id: Uuid });

export type WalletCreate = z.infer<typeof WalletCreate>;
export type WalletCreated = z.infer<typeof WalletCreated>;
export type WalletPublic = z.infer<typeof WalletPublic>;
export type CredentialOffer = z.infer<typeof CredentialOffer>;
export type BackupIn = z.infer<typeof BackupIn>;
export type Backup = z.infer<typeof Backup>;
