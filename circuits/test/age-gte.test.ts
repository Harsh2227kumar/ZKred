// Roundtrip tests against the COMMITTED artifacts in build/ (the same files the wallet and verifier use).
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { beforeAll, describe, expect, it } from "vitest";

const WASM = new URL("../build/age_gte.wasm", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ZKEY = new URL("../build/age_gte.zkey", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const VKEY = new URL("../build/vkey.json", import.meta.url);

const EPOCH = Date.UTC(1900, 0, 1);
const days = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - EPOCH) / 86_400_000;

let poseidon: Awaited<ReturnType<typeof buildPoseidon>>;
let vkey: object;
const commit = (dobDays: number, salt: bigint) => poseidon.F.toString(poseidon([BigInt(dobDays), salt]));
const randomSalt = () => BigInt(`0x${randomBytes(31).toString("hex")}`); // < field size

beforeAll(async () => {
  poseidon = await buildPoseidon();
  vkey = JSON.parse(await readFile(VKEY, "utf8"));
});

async function prove(input: Record<string, string>) {
  return snarkjs.groth16.fullProve(input, WASM, ZKEY);
}

describe("age_gte circuit", () => {
  const cutoff21 = days("2005-10-25"); // 2026-10-25 − 21 calendar years

  it("proves age ≥ 21 and exposes only [dob_commitment, cutoff_days]", async () => {
    const dob = days("2000-01-01");
    const salt = randomSalt();
    const commitment = commit(dob, salt);
    const { proof, publicSignals } = await prove({
      dob_days: String(dob),
      salt: String(salt),
      dob_commitment: commitment,
      cutoff_days: String(cutoff21),
    });
    expect(publicSignals).toEqual([commitment, String(cutoff21)]);
    expect(await snarkjs.groth16.verify(vkey, publicSignals, proof)).toBe(true);
  });

  it("accepts a birthday exactly on the cutoff", async () => {
    const salt = randomSalt();
    const { proof, publicSignals } = await prove({
      dob_days: String(cutoff21),
      salt: String(salt),
      dob_commitment: commit(cutoff21, salt),
      cutoff_days: String(cutoff21),
    });
    expect(await snarkjs.groth16.verify(vkey, publicSignals, proof)).toBe(true);
  });

  it("cannot prove when the holder is under age", async () => {
    const dob = days("2010-06-15");
    const salt = randomSalt();
    await expect(
      prove({ dob_days: String(dob), salt: String(salt), dob_commitment: commit(dob, salt), cutoff_days: String(cutoff21) }),
    ).rejects.toThrow();
  });

  it("cannot prove against someone else's commitment", async () => {
    const dob = days("2000-01-01");
    const other = commit(dob, randomSalt());
    await expect(
      prove({ dob_days: String(dob), salt: String(randomSalt()), dob_commitment: other, cutoff_days: String(cutoff21) }),
    ).rejects.toThrow();
  });

  it("rejects out-of-range dates (16-bit day count)", async () => {
    const dob = 70_000;
    const salt = randomSalt();
    await expect(
      prove({ dob_days: String(dob), salt: String(salt), dob_commitment: commit(dob, salt), cutoff_days: String(cutoff21) }),
    ).rejects.toThrow();
  });

  it("a valid proof fails verification if a public signal is tampered with", async () => {
    const dob = days("2000-01-01");
    const salt = randomSalt();
    const { proof, publicSignals } = await prove({
      dob_days: String(dob),
      salt: String(salt),
      dob_commitment: commit(dob, salt),
      cutoff_days: String(cutoff21),
    });
    const tampered = [publicSignals[0]!, String(cutoff21 + 3650)];
    expect(await snarkjs.groth16.verify(vkey, tampered, proof)).toBe(false);
  });
});
