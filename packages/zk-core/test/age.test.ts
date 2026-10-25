/// <reference types="node" />
// Runs against the COMMITTED circuits/build artifacts (the same files the wallet and verifier load).
import { readFile } from "node:fs/promises";
import { buildPoseidon } from "circomlibjs";
import { beforeAll, describe, expect, it } from "vitest";
import { ageCutoffDays, dateToDays, dobCommitment, proveAgeGte, randomDobSalt, verifyAgeGte, type ZkArtifacts } from "../src";

const build = (f: string) => new URL(`../../../circuits/build/${f}`, import.meta.url);

let artifacts: ZkArtifacts;
let vkey: object;

beforeAll(async () => {
  const [wasm, zkey, vk] = await Promise.all([readFile(build("age_gte.wasm")), readFile(build("age_gte.zkey")), readFile(build("vkey.json"), "utf8")]);
  vkey = JSON.parse(vk);
  // ArrayBuffer inputs, as the browser passes them after fetch().
  artifacts = { wasm: new Uint8Array(wasm).buffer, zkey: new Uint8Array(zkey).buffer };
});

describe("age dates", () => {
  it("counts days since 1900-01-01 UTC and rejects invalid dates", () => {
    expect(dateToDays("1900-01-01")).toBe(0);
    expect(dateToDays("1900-01-02")).toBe(1);
    expect(() => dateToDays("2001-02-29")).toThrow(/valid YYYY-MM-DD/);
    expect(() => dateToDays("2080-01-01")).toThrow(/16-bit/);
  });

  it("cutoff is exactly N calendar years back, with Feb 29 clamped to Feb 28", () => {
    expect(ageCutoffDays(dateToDays("2026-10-25"), 21)).toBe(dateToDays("2005-10-25"));
    expect(ageCutoffDays(dateToDays("2028-02-29"), 21)).toBe(dateToDays("2007-02-28"));
    expect(ageCutoffDays(dateToDays("2028-02-29"), 20)).toBe(dateToDays("2008-02-29"));
  });
});

describe("age_gte proof", () => {
  const today = dateToDays("2026-10-25");

  it("prove → verify with public signals [dob_commitment, cutoff_days]", async () => {
    const dobDays = BigInt(dateToDays("2000-01-01"));
    const salt = randomDobSalt();
    const { proof, publicSignals } = await proveAgeGte({ dobDays, salt, todayDays: today, minAgeYears: 21, artifacts });
    expect(publicSignals).toEqual([await dobCommitment(dobDays, salt), String(dateToDays("2005-10-25"))]);
    expect(await verifyAgeGte({ proof, publicSignals, vkey })).toBe(true);

    // tampering with either public signal breaks the proof
    expect(await verifyAgeGte({ proof, publicSignals: [publicSignals[0]!, String(today)], vkey })).toBe(false);
    const other = await dobCommitment(dobDays, randomDobSalt());
    expect(await verifyAgeGte({ proof, publicSignals: [other, publicSignals[1]!], vkey })).toBe(false);
    expect(await verifyAgeGte({ proof, publicSignals: [publicSignals[0]!], vkey })).toBe(false);
  });

  it("accepts a birthday exactly on the cutoff and refuses an under-age holder", async () => {
    const salt = randomDobSalt();
    const onCutoff = BigInt(dateToDays("2005-10-25"));
    const ok = await proveAgeGte({ dobDays: onCutoff, salt, todayDays: today, minAgeYears: 21, artifacts });
    expect(await verifyAgeGte({ ...ok, vkey })).toBe(true);
    await expect(
      proveAgeGte({ dobDays: onCutoff + 1n, salt, todayDays: today, minAgeYears: 21, artifacts }),
    ).rejects.toMatchObject({ code: "AGE_REQUIREMENT_NOT_MET" });
  });

  it("dobCommitment matches circomlibjs Poseidon (what the circuit uses)", async () => {
    const ref = await buildPoseidon();
    for (let i = 0; i < 5; i++) {
      const d = BigInt(Math.floor(Math.random() * 0xffff));
      const s = randomDobSalt();
      expect(await dobCommitment(d, s)).toBe(ref.F.toString(ref([d, s])));
    }
  });

  it("dobCommitment is deterministic and salt-dependent", async () => {
    const d = BigInt(dateToDays("1990-05-17"));
    const s = randomDobSalt();
    expect(await dobCommitment(d, s)).toBe(await dobCommitment(d, s));
    expect(await dobCommitment(d, s)).not.toBe(await dobCommitment(d, randomDobSalt()));
  });
});
