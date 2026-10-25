import { ISSUER_KINDS } from "@zkred/zk-core";
import { z } from "zod";
import { Address, Base64url, DateTime, Hex32, Uuid } from "./common.schema";

export const IssuerKind = z.enum(ISSUER_KINDS).meta({ id: "IssuerKind" });
export const KeyStatus = z.enum(["active", "rotated", "compromised"]).meta({ id: "KeyStatus" });

export const IssuerCreate = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: IssuerKind,
    did_suffix: z
      .string()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "lowercase letters, digits and '-' only"),
  })
  .meta({ id: "IssuerCreate" });

export const IssuerKey = z
  .object({
    key_id: Hex32,
    public_key: Base64url.meta({ description: "BBS BLS12-381 G2 public key" }),
    status: KeyStatus,
    active_from: DateTime,
    compromised_from: DateTime.nullable(),
    tx_hash: z.string(),
  })
  .meta({ id: "IssuerKey" });

export const Issuer = z
  .object({
    id: z.uuid(),
    did: z.string(),
    name: z.string(),
    kind: IssuerKind,
    issuer_chain_id: Hex32.meta({ description: "keccak256(did)" }),
    governance_address: Address,
    accredited: z.boolean().meta({ description: "Read from IssuerRegistry" }),
    accredited_as_of: DateTime.meta({
      description: "When `accredited` was read from the chain (cached up to ISSUER_CACHE_TTL_MS; older if the RPC is down)",
    }),
    keys: z.array(IssuerKey),
    created_at: DateTime,
  })
  .meta({ id: "Issuer" });

export const IssuerList = z.object({ items: z.array(Issuer) }).meta({ id: "IssuerList" });

export const IssuerParams = z.object({ issuer_id: Uuid });

export type IssuerCreate = z.infer<typeof IssuerCreate>;
export type IssuerKey = z.infer<typeof IssuerKey>;
export type Issuer = z.infer<typeof Issuer>;

export const CompromiseCreate = z
  .object({
    window_seconds: z
      .number()
      .int()
      .positive()
      .max(10 * 365 * 24 * 3600)
      .optional()
      .meta({ description: "Default BREACH_WINDOW_SECONDS" }),
  })
  .meta({ id: "CompromiseCreate" });

export const BatchVerdict = z
  .enum(["legacy_valid", "in_window_needs_reissue", "unanchored_invalid"])
  .meta({ id: "BatchVerdict" });

export const CompromiseReport = z
  .object({
    key_id: Hex32,
    compromised_from: DateTime.meta({ description: "chain time − window" }),
    new_key: IssuerKey,
    tx_hashes: z.array(z.string()),
    affected_batches: z.array(z.object({ batch_id: Hex32, anchored_at: DateTime.nullable(), verdict: BatchVerdict })),
  })
  .meta({ id: "CompromiseReport" });

export const IssuerKeyParams = z.object({ issuer_id: Uuid, key_id: Hex32 });

export type CompromiseCreate = z.infer<typeof CompromiseCreate>;
export type CompromiseReport = z.infer<typeof CompromiseReport>;
