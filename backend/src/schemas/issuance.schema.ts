import { CREDENTIAL_TYPES } from "@zkred/zk-core";
import { z } from "zod";
import { config } from "../config";
import { Base64url, DateTime, Hex32, Uuid } from "./common.schema";

export const CredentialType = z.enum(CREDENTIAL_TYPES).meta({ id: "CredentialType" });
export const BatchStatus = z.enum(["open", "anchored"]).meta({ id: "BatchStatus" });

export const IssueCredentialIn = z
  .object({
    credential_type: CredentialType,
    wallet_id: z.uuid(),
    claims: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .meta({ description: "Keys = CredentialSchema fields with source 'claim'. GovernmentId: dob = YYYY-MM-DD" }),
  })
  .meta({ id: "IssueCredentialIn" });

export const IssueCredentialOut = z
  .object({
    credential_id: z.uuid(),
    offer_id: z.uuid(),
    batch_id: Hex32,
    status_list_id: Hex32,
    status_index: z.number().int(),
    commitment: Hex32,
  })
  .meta({ id: "IssueCredentialOut" });

export const IssuedCredential = z
  .object({
    id: z.uuid(),
    credential_type: CredentialType,
    wallet_id: z.uuid(),
    batch_id: Hex32,
    status_index: z.number().int(),
    commitment: Hex32,
    key_id: Hex32,
    issued_at: DateTime,
    revoked_at: DateTime.nullable(),
  })
  .meta({ id: "IssuedCredential", description: "Issuer view: no claims" });

export const IssuedCredentialList = z
  .object({ items: z.array(IssuedCredential), next_cursor: z.string().nullable() })
  .meta({ id: "IssuedCredentialList" });

export const Batch = z
  .object({
    batch_id: Hex32,
    issuer_id: z.uuid(),
    key_id: Hex32,
    size: z.number().int(),
    status: BatchStatus,
    root: Hex32.nullable(),
    anchored_at: DateTime.nullable(),
    tx_hash: z.string().nullable(),
  })
  .meta({ id: "Batch" });

export const BatchList = z.object({ items: z.array(Batch) }).meta({ id: "BatchList" });

export const BatchLeaves = z
  .object({ batch_id: Hex32, root: Hex32.nullable(), leaves: z.array(Hex32) })
  .meta({ id: "BatchLeaves" });

export const StatusListOut = z
  .object({
    list_id: Hex32,
    issuer_id: z.uuid(),
    size: z.number().int(),
    encoded: Base64url.meta({ description: "gzip bitstring" }),
    hash: Hex32,
    onchain_hash: Hex32,
  })
  .meta({ id: "StatusListOut" });

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(config.LIST_MAX_LIMIT).default(config.LIST_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

export const IssuerBatchParams = z.object({ issuer_id: Uuid, batch_id: Hex32 });
export const BatchParams = z.object({ batch_id: Hex32 });
export const StatusListParams = z.object({ list_id: Hex32 });

export type IssueCredentialIn = z.infer<typeof IssueCredentialIn>;
export type IssueCredentialOut = z.infer<typeof IssueCredentialOut>;
export type IssuedCredential = z.infer<typeof IssuedCredential>;
export type Batch = z.infer<typeof Batch>;
export type BatchLeaves = z.infer<typeof BatchLeaves>;
export type StatusListOut = z.infer<typeof StatusListOut>;

export const RevokeOut = z
  .object({ credential_id: z.uuid(), status_list_id: Hex32, status_index: z.number().int(), list_hash: Hex32, tx_hash: z.string() })
  .meta({ id: "RevokeOut" });

export const SignedCredentialSchema = z
  .object({
    type: CredentialType,
    issuer_did: z.string().min(1),
    key_id: Hex32,
    values: z.record(z.string(), z.string()),
    signature: Base64url.min(1),
  })
  .meta({ id: "SignedCredential" });

export const ReissueIn = z
  .object({ wallet_id: z.uuid(), old_credential: SignedCredentialSchema.meta({ description: "Full credential; proves possession" }) })
  .meta({ id: "ReissueIn" });

export const ReissueOut = z.object({ offer_id: z.uuid() }).meta({ id: "ReissueOut" });

export const IssuerCredentialParams = z.object({ issuer_id: Uuid, credential_id: Uuid });

export type RevokeOut = z.infer<typeof RevokeOut>;
export type ReissueIn = z.infer<typeof ReissueIn>;
