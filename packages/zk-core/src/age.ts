/// <reference path="./types/zk-libs.d.ts" />
// Age ≥ N predicate over the committed circuits/build/age_gte artifacts (V0-H4). The ONLY file that imports snarkjs
// and Poseidon. Circuit: Poseidon(dob_days, salt) == dob_commitment ∧ dob_days ≤ cutoff_days, both dates 16-bit.
// Dates = whole days since 1900-01-01 UTC. publicSignals = [dob_commitment, cutoff_days].
// Poseidon comes from poseidon-lite (pure BigInt, circomlib constants): circomlibjs's only entry point pulls in
// Node-only modules (Buffer, streams) that crash in the browser. test/age.test.ts checks both give identical hashes.
import { poseidon2 } from "poseidon-lite/poseidon2";
import * as snarkjs from "snarkjs";
import { ZkCoreError } from "./errors";
import type { ZkArtifacts } from "./types";

const DAY_MS = 86_400_000;
const EPOCH_MS = Date.UTC(1900, 0, 1);
/** The circuit range-checks both dates to 16 bits (up to 2079-06-06). */
const MAX_DAYS = 0xffff;
/** Salts are 248-bit, safely below the BN254 scalar field. */
const SALT_BYTES = 31;
/** BN254 scalar field order: Groth16 public signals are elements of [0, r). */
const BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const CANONICAL_DECIMAL = /^(0|[1-9]\d*)$/;

/** snarkjs reduces public signals mod r, so "-5", "r+5" or "05" would verify like "5". Only canonical values count. */
const isFieldElement = (s: unknown): s is string => typeof s === "string" && CANONICAL_DECIMAL.test(s) && BigInt(s) < BN254_R;

function assertDays(name: string, d: number | bigint): void {
  const n = typeof d === "bigint" ? d : BigInt(d);
  if (typeof d === "number" && !Number.isInteger(d)) throw new ZkCoreError("INVALID_DATE", `${name} must be a whole day count`);
  if (n < 0n || n > BigInt(MAX_DAYS)) throw new ZkCoreError("INVALID_DATE", `${name} is outside the circuit's 16-bit day range`);
}

/** "YYYY-MM-DD" (UTC) → days since 1900-01-01. */
export function dateToDays(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const ms = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
  const back = Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(0, 10);
  if (back !== isoDate) throw new ZkCoreError("INVALID_DATE", `not a valid YYYY-MM-DD date: ${isoDate}`);
  const days = (ms - EPOCH_MS) / DAY_MS;
  assertDays("date", days);
  return days;
}

/**
 * Latest birth day (days since 1900-01-01) that is at least `minAgeYears` calendar years before `todayDays`.
 * A Feb 29 "today" maps to Feb 28 in a non-leap target year, so nobody is counted as of age a day early.
 */
export function ageCutoffDays(todayDays: number, minAgeYears: number): number {
  assertDays("todayDays", todayDays);
  if (!Number.isInteger(minAgeYears) || minAgeYears < 1) throw new ZkCoreError("INVALID_AGE", "minAgeYears must be a positive integer");
  const today = new Date(EPOCH_MS + todayDays * DAY_MS);
  const year = today.getUTCFullYear() - minAgeYears;
  const month = today.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cutoff = (Date.UTC(year, month, Math.min(today.getUTCDate(), lastDay)) - EPOCH_MS) / DAY_MS;
  if (cutoff < 0) throw new ZkCoreError("INVALID_AGE", "age cutoff falls before 1900-01-01");
  return cutoff;
}

/** Fresh random salt for dob_commitment (issuer side, at issuance). */
export function randomDobSalt(): bigint {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return BigInt(`0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`);
}

/** Poseidon(dob_days, salt) as a decimal field element string (the value BBS-signed at GovernmentId index 13). */
export async function dobCommitment(dobDays: bigint, salt: bigint): Promise<string> {
  assertDays("dobDays", dobDays);
  if (salt < 0n || salt >= BN254_R) throw new ZkCoreError("INVALID_SALT", "salt must be a BN254 field element");
  return poseidon2([dobDays, salt]).toString();
}

const asSnarkFile = (a: ArrayBuffer | string) => (typeof a === "string" ? a : { type: "mem" as const, data: new Uint8Array(a) });

export async function proveAgeGte(i: {
  dobDays: bigint;
  salt: bigint;
  todayDays: number;
  minAgeYears: number;
  artifacts: ZkArtifacts;
}): Promise<{ proof: object; publicSignals: string[] }> {
  const cutoff = ageCutoffDays(i.todayDays, i.minAgeYears);
  if (i.dobDays > BigInt(cutoff)) throw new ZkCoreError("AGE_REQUIREMENT_NOT_MET", `holder is younger than ${i.minAgeYears}`);
  const commitment = await dobCommitment(i.dobDays, i.salt);
  try {
    return await snarkjs.groth16.fullProve(
      { dob_days: i.dobDays.toString(), salt: i.salt.toString(), dob_commitment: commitment, cutoff_days: String(cutoff) },
      asSnarkFile(i.artifacts.wasm),
      asSnarkFile(i.artifacts.zkey),
    );
  } catch (e) {
    throw new ZkCoreError("AGE_PROOF_FAILED", `age proof generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Checks the Groth16 proof only. The caller must also check publicSignals[0] == the BBS-disclosed dob_commitment
 * and publicSignals[1] (cutoff_days) ≤ its own ageCutoffDays(...) + AGE_PROOF_MAX_SKEW_DAYS. Fails closed.
 */
export async function verifyAgeGte(i: { proof: object; publicSignals: string[]; vkey: object }): Promise<boolean> {
  try {
    if (i.publicSignals.length !== 2 || !i.publicSignals.every(isFieldElement)) return false;
    return await snarkjs.groth16.verify(i.vkey, i.publicSignals, i.proof);
  } catch {
    return false;
  }
}
