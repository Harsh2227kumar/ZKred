import { z } from "zod";
import { DateTime, Hex32 } from "./common.schema";

export const StealKeyIn = z.object({ issuer_id: z.uuid() }).meta({ id: "StealKeyIn" });
export const StolenKey = z.object({ issuer_id: z.uuid(), key_id: Hex32, stolen_at: DateTime }).meta({ id: "StolenKey" });

export const ForgeIn = z
  .object({
    issuer_id: z.uuid(),
    count: z.number().int().min(1).max(1000),
    claims: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .meta({ description: "Degree claims to forge (validated like a real Degree)" }),
  })
  .meta({ id: "ForgeIn" });

export const ForgeOut = z
  .object({
    forged_set_id: z.uuid(),
    forged_count: z.number().int(),
    batch_id: Hex32,
    anchor_tx_hash: z.string().nullable().meta({ description: "null when the stolen key can no longer anchor" }),
  })
  .meta({ id: "ForgeOut" });

export const VerifyForgedIn = z.object({ mode: z.enum(["naive", "full"]) }).meta({ id: "VerifyForgedIn" });

export const AttackRunOut = z
  .object({
    mode: z.enum(["naive", "full"]),
    total: z.number().int(),
    accepted: z.number().int(),
    rejected: z.number().int(),
    by_code: z.record(z.string(), z.number().int()),
    ran_at: DateTime,
  })
  .meta({ id: "AttackRunOut" });

export const AttackState = z
  .object({ stolen_keys: z.array(StolenKey), forged_count: z.number().int(), runs: z.array(AttackRunOut) })
  .meta({ id: "AttackState" });

export const OkOut = z.object({ ok: z.literal(true) }).meta({ id: "OkOut" });

export type ForgeIn = z.infer<typeof ForgeIn>;
export type ForgeOut = z.infer<typeof ForgeOut>;
export type StolenKey = z.infer<typeof StolenKey>;
export type AttackRunOut = z.infer<typeof AttackRunOut>;
export type AttackState = z.infer<typeof AttackState>;
