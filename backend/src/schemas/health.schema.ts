import { z } from "zod";

const Dependency = z.enum(["ok", "down"]);

export const Health = z
  .object({
    status: z.enum(["ok", "degraded"]),
    db: Dependency,
    chain: Dependency,
    ai: Dependency,
    version: z.string(),
  })
  .meta({ id: "Health" });

export type Health = z.infer<typeof Health>;
