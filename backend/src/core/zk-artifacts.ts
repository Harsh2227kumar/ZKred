// The Groth16 verification key of the committed age_gte circuit (ZK_ARTIFACTS_DIR/vkey.json), read once.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../config";

let vkey: Promise<object> | undefined;

export function ageVerificationKey(): Promise<object> {
  vkey ??= readFile(resolve(process.cwd(), config.ZK_ARTIFACTS_DIR, "vkey.json"), "utf8").then(
    (text) => JSON.parse(text) as object,
    (err: unknown) => {
      vkey = undefined; // let a later call retry instead of caching the failure
      throw err;
    },
  );
  return vkey;
}
