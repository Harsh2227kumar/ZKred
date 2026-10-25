import { describe, expect, it } from "vitest";
import { PresentationPolicySchema, PresentationSchema, type PresentationPolicy } from "../src";
import { randomHex32, randomText } from "./factories";

function policy(overrides: Partial<PresentationPolicy["requirements"][number]> = {}, never: string[] = []) {
  return {
    purpose: randomText("purpose"),
    requirements: [
      {
        id: "r1",
        credential_type: "GovernmentId",
        accredited_only: true,
        issuer_kinds: ["government"],
        issuer_dids: null,
        reveal: ["nationality"],
        equals: [],
        predicates: [{ type: "age_gte", years: 21 }],
        require_not_revoked: true,
        ...overrides,
      },
    ],
    never_collect: never,
  };
}

describe("PresentationPolicySchema", () => {
  it("accepts a valid policy", () => {
    expect(PresentationPolicySchema.safeParse(policy({}, ["holder_name", "dob", "address"])).success).toBe(true);
  });

  it("rejects reveal ∩ never_collect", () => {
    const r = PresentationPolicySchema.safeParse(policy({ reveal: ["dob"] }, ["dob"]));
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes("never_collect"))).toBe(true);
  });

  it("rejects fields not in the credential layout", () => {
    expect(PresentationPolicySchema.safeParse(policy({ reveal: ["degree_name"] })).success).toBe(false);
  });

  it("rejects revealing dob_salt (with dob_commitment it lets a verifier brute-force the date of birth)", () => {
    const r = PresentationPolicySchema.safeParse(policy({ reveal: ["dob_salt"] }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path.join(".") === "requirements.0.reveal.0")).toBe(true);
    // Its public counterpart stays revealable.
    expect(PresentationPolicySchema.safeParse(policy({ reveal: ["dob_commitment"] })).success).toBe(true);
  });

  it("rejects equals on a field that is not revealed", () => {
    expect(PresentationPolicySchema.safeParse(policy({ equals: [{ field: "address", value: "x" }] })).success).toBe(false);
    expect(PresentationPolicySchema.safeParse(policy({ equals: [{ field: "issuer_did", value: "x" }] })).success).toBe(true);
  });

  it("rejects age_gte on a non-GovernmentId credential and out-of-range years", () => {
    expect(PresentationPolicySchema.safeParse(policy({ credential_type: "Degree", reveal: ["degree_name"] })).success).toBe(false);
    expect(PresentationPolicySchema.safeParse(policy({ predicates: [{ type: "age_gte", years: 0 }] })).success).toBe(false);
  });

  it("rejects duplicate requirement ids and unknown issuer kinds", () => {
    const p = policy();
    expect(PresentationPolicySchema.safeParse({ ...p, requirements: [p.requirements[0], p.requirements[0]] }).success).toBe(false);
    expect(PresentationPolicySchema.safeParse(policy({ issuer_kinds: ["bank" as never] })).success).toBe(false);
  });
});

describe("PresentationSchema", () => {
  const item = () => ({
    requirement_id: "r1",
    credential_type: "GovernmentId",
    issuer_did: randomText("did:zkred"),
    key_id: randomHex32(),
    disclosed: { "0": "GovernmentId", "13": randomHex32() },
    bbs_proof: "AbC-_9",
    merkle_proof: [randomHex32()],
    age_proof: { proof: { pi_a: [] }, public_signals: ["1", "38000"] },
  });

  it("accepts a well-formed presentation", () => {
    const r = PresentationSchema.safeParse({ request_id: crypto.randomUUID(), nonce: "bm9uY2U", items: [item()] });
    expect(r.success).toBe(true);
  });

  it("rejects non-index disclosed keys and bad key ids", () => {
    const bad = { ...item(), disclosed: { holder_name: "x" } };
    expect(PresentationSchema.safeParse({ request_id: crypto.randomUUID(), nonce: "bm9uY2U", items: [bad] }).success).toBe(false);
    const badKey = { ...item(), key_id: "0x12" };
    expect(PresentationSchema.safeParse({ request_id: crypto.randomUUID(), nonce: "bm9uY2U", items: [badKey] }).success).toBe(false);
  });

  it("rejects age proofs whose public signals are not exactly two canonical decimals", () => {
    for (const public_signals of [["1"], ["1", "-5"], ["1", "05"], ["1", "0x10"], ["1", "2", "3"]]) {
      const bad = { ...item(), age_proof: { proof: { pi_a: [] }, public_signals } };
      expect(PresentationSchema.safeParse({ request_id: crypto.randomUUID(), nonce: "bm9uY2U", items: [bad] }).success).toBe(false);
    }
  });
});
