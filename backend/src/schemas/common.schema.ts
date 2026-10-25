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
