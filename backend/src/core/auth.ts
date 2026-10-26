// Bearer-token checks (CONTRACTS §1 Auth). Tokens are compared as SHA-256 digests in constant time.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config";

const sha256 = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

const adminTokenDigest = sha256(config.ISSUER_ADMIN_TOKEN);

export function isAdminToken(token: string): boolean {
  return timingSafeEqual(sha256(token), adminTokenDigest);
}

const WALLET_TOKEN_BYTES = 32;

/** A fresh wallet token (returned to the holder once). */
export const newWalletToken = (): string => randomBytes(WALLET_TOKEN_BYTES).toString("base64url");

/** What the DB stores for a wallet token. Looked up by equality, so the token itself never touches the DB. */
export const hashWalletToken = (token: string): string => sha256(token).toString("hex");
