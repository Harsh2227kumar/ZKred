// Bearer-token checks (CONTRACTS §1 Auth). Tokens are compared as SHA-256 digests in constant time.
import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "../config";

const sha256 = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

const adminTokenDigest = sha256(config.ISSUER_ADMIN_TOKEN);

export function isAdminToken(token: string): boolean {
  return timingSafeEqual(sha256(token), adminTokenDigest);
}
