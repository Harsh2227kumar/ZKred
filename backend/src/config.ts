// The ONLY place in the backend that reads process.env (AGENTS.md §2).
// Missing/invalid required vars → the process exits before serving anything.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Local dev convenience: load backend/.env, then the repo-root .env. Real deployments inject env directly.
for (const file of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env")]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address");
const hexPrivateKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte private key");
const base64Secret = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded");
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
    PUBLIC_BASE_URL: z.url(),

    ISSUER_ADMIN_TOKEN: z.string().min(32),
    KEY_ENCRYPTION_SECRET: base64Secret,
    GOVERNANCE_KEY_ENCRYPTION_SECRET: base64Secret,
    DEMO_MODE: z.stringbool().default(false),

    CHAIN_ID: z.coerce.number().int().positive(),
    CHAIN_NETWORK_NAME: z.string().min(1),
    CHAIN_RPC_URL: z.url(),
    ACCREDITOR_PRIVATE_KEY: hexPrivateKey,
    ISSUER_REGISTRY_ADDRESS: hexAddress,
    ANCHOR_REGISTRY_ADDRESS: hexAddress,
    STATUS_REGISTRY_ADDRESS: hexAddress,
    EXPLORER_TX_URL_TEMPLATE: z.string().includes("{tx}"),
    ISSUER_GAS_FUNDING_WEI: z.string().regex(/^\d+$/).default("2000000000000000"),
    CHAIN_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
    CHAIN_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),

    BREACH_WINDOW_SECONDS: z.coerce.number().int().positive().default(172800),
    REQUEST_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    STATUS_LIST_SIZE: z.coerce.number().int().min(1024).default(16384),
    BATCH_MAX_SIZE: z.coerce.number().int().positive().default(256),
    CLAIM_MAX_CHARS: z.coerce.number().int().positive().default(256),
    LIST_DEFAULT_LIMIT: z.coerce.number().int().positive().default(50),
    LIST_MAX_LIMIT: z.coerce.number().int().positive().default(200),
    AGE_PROOF_MAX_SKEW_DAYS: z.coerce.number().int().min(0).default(1),
    ZK_ARTIFACTS_DIR: z.string().min(1),

    AWS_REGION: z.string().min(1),
    BEDROCK_MODEL_ID: z.string().min(1),
    AWS_BEARER_TOKEN_BEDROCK: optionalNonEmpty,
    AWS_ACCESS_KEY_ID: optionalNonEmpty,
    AWS_SECRET_ACCESS_KEY: optionalNonEmpty,
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    AI_MAX_TOKENS: z.coerce.number().int().positive().default(4000),
    AI_HEALTH_TTL_MS: z.coerce.number().int().positive().default(300000),
    HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  })
  .refine((e) => e.KEY_ENCRYPTION_SECRET !== e.GOVERNANCE_KEY_ENCRYPTION_SECRET, {
    message: "KEY_ENCRYPTION_SECRET and GOVERNANCE_KEY_ENCRYPTION_SECRET must differ",
    path: ["GOVERNANCE_KEY_ENCRYPTION_SECRET"],
  })
  .refine((e) => Boolean(e.AWS_ACCESS_KEY_ID) === Boolean(e.AWS_SECRET_ACCESS_KEY), {
    message: "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together",
    path: ["AWS_SECRET_ACCESS_KEY"],
  });

export type Config = z.infer<typeof EnvSchema>;

function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`);
    // Never print values: some are secrets.
    console.error(`Invalid backend configuration:\n${problems.join("\n")}`);
    process.exit(1);
  }
  return parsed.data;
}

export const config: Config = loadConfig();

export const API_BASE_PATH = "/api/v1";
export const APP_VERSION = "0.1.0";
