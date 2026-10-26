import { z } from "zod";

export const Hex32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .meta({ id: "Hex32", description: "0x-prefixed 32-byte hex" });

export const Address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .meta({ id: "Address", description: "0x-prefixed 20-byte EVM address" });

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .meta({ id: "ErrorResponse" });

export const EnumOption = z.object({ value: z.string(), label: z.string() }).meta({ id: "EnumOption" });

export const Base64url = z
  .string()
  .regex(/^[A-Za-z0-9_-]*$/)
  .meta({ id: "Base64url", description: "base64url (no padding)" });

export const DateTime = z.iso.datetime().meta({ id: "DateTime", description: "ISO-8601 UTC timestamp" });

/** Largest value of a Postgres `integer` (int4) column: request integers stored in one are capped here (422, not a 500). */
export const PG_INT_MAX = 2 ** 31 - 1;

/** Path/query param for a DB id. */
export const Uuid = z.uuid();
