// scripts/config.ts
// ⚓ Anchor: The ONLY file in scripts/ allowed to read process.env (AGENTS.md §2). Every value is required and
// validated up front, so a missing variable stops the seed before it touches the API (no literal fallbacks).

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root, backend, and scripts/ if present
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

/** Which seed entries to run: "legacy" (default) or "in_window" (`--in-window`, right before the breach demo). */
export type SeedPhase = "legacy" | "in_window";

export interface SeedConfig {
  apiBaseUrl: string;
  adminToken: string;
  walletPassphrase: string;
  phase: SeedPhase;
}

/** Same rule as the browser wallet (VERSION-PLAN V1-S2): backups need a passphrase of 10+ characters. */
const MIN_PASSPHRASE_LENGTH = 10;

function loadConfig(): SeedConfig {
  const problems: string[] = [];
  const required = (name: string): string => {
    const value = process.env[name]?.trim() ?? "";
    if (!value) problems.push(`${name} is not set`);
    return value;
  };

  const apiBaseUrl = required("SEED_API_BASE_URL");
  if (apiBaseUrl && !URL.canParse(apiBaseUrl)) problems.push("SEED_API_BASE_URL must be a URL, e.g. <scheme>://<host>/api/v1");
  const adminToken = required("SEED_ADMIN_TOKEN");
  const walletPassphrase = required("SEED_WALLET_PASSPHRASE");
  if (walletPassphrase && walletPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    problems.push(`SEED_WALLET_PASSPHRASE must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }

  if (problems.length) {
    throw new Error(`[seed] Invalid configuration (see scripts/.env.example):\n  - ${problems.join("\n  - ")}`);
  }
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    adminToken,
    walletPassphrase,
    phase: process.argv.includes("--in-window") ? "in_window" : "legacy",
  };
}

export const config: SeedConfig = (() => {
  try {
    return loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
