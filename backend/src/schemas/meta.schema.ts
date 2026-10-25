import { z } from "zod";
import { Address, EnumOption } from "./common.schema";

export const Enums = z
  .object({
    issuer_kinds: z.array(EnumOption),
    credential_types: z.array(EnumOption),
    key_statuses: z.array(EnumOption),
    batch_statuses: z.array(EnumOption),
    predicate_types: z.array(EnumOption),
    verification_steps: z.array(EnumOption),
    verification_results: z.array(EnumOption),
  })
  .meta({ id: "Enums" });

export const ChainInfo = z
  .object({
    chain_id: z.number().int(),
    network_name: z.string(),
    issuer_registry: Address,
    anchor_registry: Address,
    status_registry: Address,
    explorer_tx_url_template: z.string(),
    breach_window_seconds: z.number().int(),
    demo_mode: z.boolean(),
  })
  .meta({ id: "ChainInfo" });

export const CredentialSchemaField = z
  .object({
    name: z.string(),
    label: z.string(),
    kind: z.enum(["string", "date", "int"]),
    pii: z.boolean(),
    index: z.number().int(),
    source: z.enum(["meta", "claim", "derived"]),
  })
  .meta({ id: "CredentialSchemaField" });

export const CredentialSchema = z
  .object({
    type: z.string(),
    version: z.number().int(),
    fields: z.array(CredentialSchemaField),
  })
  .meta({ id: "CredentialSchema" });

export const CredentialSchemaList = z
  .object({ items: z.array(CredentialSchema) })
  .meta({ id: "CredentialSchemaList" });

export type Enums = z.infer<typeof Enums>;
export type ChainInfo = z.infer<typeof ChainInfo>;
export type CredentialSchemaList = z.infer<typeof CredentialSchemaList>;
