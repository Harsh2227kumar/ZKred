// Validates issuer-typed claims against the frozen credential layout and derives the computed fields
// (GovernmentId: dob_salt + dob_commitment for the age proof). Claim values are PII: never log them.
import { CREDENTIAL_LAYOUTS, dateToDays, dobCommitment, randomDobSalt, type CredentialType } from "@zkred/zk-core";
import { config } from "../config";
import { AppError } from "./errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT_RE = /^(0|[1-9]\d{0,8})$/;

function isCalendarDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** The claim fields of `type`, normalised to strings. Throws VALIDATION_ERROR with one detail per bad field. */
export function validateClaims(type: CredentialType, claims: Record<string, string | number>): Record<string, string> {
  const fields = CREDENTIAL_LAYOUTS[type].fields.filter((f) => f.source === "claim");
  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};

  for (const name of Object.keys(claims)) {
    if (!fields.some((f) => f.name === name)) errors[`claims.${name}`] = `not a ${type} claim`;
  }
  for (const f of fields) {
    const raw = claims[f.name];
    const value = typeof raw === "number" ? String(raw) : raw?.trim();
    const key = `claims.${f.name}`;
    if (!value) errors[key] = "required";
    else if (value.length > config.CLAIM_MAX_CHARS) errors[key] = `at most ${config.CLAIM_MAX_CHARS} characters`;
    else if (f.kind === "date" && !isCalendarDate(value)) errors[key] = "must be a YYYY-MM-DD date";
    else if (f.kind === "int" && !INT_RE.test(value)) errors[key] = "must be a non-negative integer";
    else values[f.name] = value;
  }

  if (type === "GovernmentId" && values.dob) {
    try {
      if (dateToDays(values.dob) > dateToDays(new Date().toISOString().slice(0, 10))) errors["claims.dob"] = "must not be in the future";
    } catch {
      errors["claims.dob"] = "outside the supported date range";
    }
  }

  if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Invalid claims", errors);
  return values;
}

/** Fields with source "derived", computed from validated claims. */
export async function deriveFields(type: CredentialType, claims: Record<string, string>): Promise<Record<string, string>> {
  if (type !== "GovernmentId") return {};
  const salt = randomDobSalt();
  const commitment = await dobCommitment(BigInt(dateToDays(claims.dob!)), salt);
  return { dob_salt: salt.toString(), dob_commitment: commitment };
}
