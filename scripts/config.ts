// scripts/config.ts
// ⚓ Anchor: The ONLY file in scripts/ allowed to read process.env (AGENTS.md §2).

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root, backend, and scripts/ if present
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

export interface SeedConfig {
  apiBaseUrl: string;
  adminToken: string;
  walletPassphrase: string;
}

function loadConfig(): SeedConfig {
  const apiBaseUrl =
    process.env.SEED_API_BASE_URL ||
    (process.env.PORT ? `http://localhost:${process.env.PORT}/api/v1` : "http://localhost:8080/api/v1");

  const adminToken = process.env.SEED_ADMIN_TOKEN || process.env.ISSUER_ADMIN_TOKEN || "";
  const walletPassphrase = process.env.SEED_WALLET_PASSPHRASE || "AshaSecurePassphrase2026!";

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    adminToken,
    walletPassphrase,
  };
}

export const config = loadConfig();
