// Unit tests for ai/policy.ts with a stubbed Bedrock model (CONTRIBUTING: V1.1-H3 — "unit with a stubbed model").
// No network is touched: every test scripts the model's replies and asserts the retry contract — exactly one retry
// with the validation errors fed back, and never an unvalidated policy (or a secret field) escaping to the caller.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresentationPolicy } from "@zkred/zk-core";
import { employerPolicy } from "../policy-factory";
import { AiError, consentSummary, policyFromText } from "../../src/ai/policy";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/ai/bedrock", () => ({ bedrock: { messages: { create } } }));

const toolCall = (input: unknown, id = "toolu_1") => ({
  content: [{ type: "tool_use", id, name: "submit_policy", input }],
});
const plainText = (text: string) => ({ content: [{ type: "text", text }] });
const okInput = (policy: PresentationPolicy) => ({
  status: "ok",
  policy,
  consent_summary: "Acme sees your degree and institution, and that you are at least 21.",
  minimisation_notes: ["No date of birth leaves your device"],
});

beforeEach(() => {
  create.mockReset();
});

describe("policyFromText (stubbed model)", () => {
  it("returns the validated policy, consent summary and minimisation notes for a well-formed tool call", async () => {
    create.mockResolvedValueOnce(toolCall(okInput(employerPolicy("Employment eligibility"))));

    const out = await policyFromText("Hiring: degree, 21+, active license");

    expect(out.policy.purpose).toBe("Employment eligibility");
    expect(out.policy.requirements).toHaveLength(3);
    expect(out.consent_summary).toContain("at least 21");
    expect(out.minimisation_notes).toEqual(["No date of birth leaves your device"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on an incomplete output and shows the model its validation errors", async () => {
    create
      .mockResolvedValueOnce(toolCall({ status: "ok" })) // policy and consent_summary both missing
      .mockResolvedValueOnce(toolCall(okInput(employerPolicy("P")), "toolu_2"));

    const out = await policyFromText("degree + age 21");

    expect(out.policy.purpose).toBe("P");
    expect(create).toHaveBeenCalledTimes(2);
    // The second call is a correction round: the model's own call comes back as an errored tool result.
    const messages = vi.mocked(create).mock.calls[1]![0]!.messages as {
      role: string;
      content: unknown;
    }[];
    expect(messages).toHaveLength(3); // original ask, the model's invalid call, the errored tool result
    expect(messages[2]!.role).toBe("user");
    const retry = messages[2]!.content as { type: string; is_error?: boolean; content: string }[];
    expect(retry[0]!.type).toBe("tool_result");
    expect(retry[0]!.is_error).toBe(true);
    expect(retry[0]!.content).toContain("Invalid policy");
    expect(retry[0]!.content).toContain("policy");
  });

  it("throws AI_BAD_OUTPUT when the output is junk twice — exactly one retry, two calls total", async () => {
    create.mockResolvedValue(toolCall({ nonsense: true }));

    await expect(policyFromText("anything")).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("never returns an unvalidated policy: a schema-violating policy is retried, then rejected", async () => {
    // The worst plausible model mistake: asking the holder to reveal dob_salt, the secret behind the age proof.
    const saltSpilling = employerPolicy("P");
    saltSpilling.requirements = saltSpilling.requirements.map((r) =>
      r.id === "r1" ? { ...r, reveal: [...r.reveal, "dob_salt"] } : r,
    );
    create.mockResolvedValue(toolCall(okInput(saltSpilling)));

    await expect(policyFromText("degree + dob salt")).rejects.toBeInstanceOf(AiError);
    await expect(policyFromText("degree + dob salt")).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(create).toHaveBeenCalledTimes(4); // two attempts per call, twice
  });

  it("POLICY_AMBIGUOUS: passes the model's questions through without retrying", async () => {
    create.mockResolvedValueOnce(toolCall({ status: "ambiguous", questions: ["Which credential type should the holder present?"] }));

    const err = await policyFromText("we need some proof").catch((e) => e);

    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("POLICY_AMBIGUOUS");
    expect(err.details.questions).toEqual(["Which credential type should the holder present?"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("POLICY_AMBIGUOUS without questions still surfaces the default question", async () => {
    create.mockResolvedValueOnce(toolCall({ status: "ambiguous" }));

    const err = await policyFromText("vague").catch((e) => e);

    expect(err.code).toBe("POLICY_AMBIGUOUS");
    expect(err.details.questions).toEqual(["Which credential and which facts should the holder prove?"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("AI_BAD_OUTPUT when the model answers without calling the tool", async () => {
    create.mockResolvedValueOnce(plainText("Sure, that sounds fine!"));

    await expect(policyFromText("degree")).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("AI_UNAVAILABLE when Bedrock itself fails, before any validation", async () => {
    create.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(policyFromText("degree")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("consentSummary (stubbed model)", () => {
  it("returns the model's consent text, trimmed", async () => {
    create.mockResolvedValueOnce(plainText("  You share your degree name and institution.  \n"));

    await expect(consentSummary("Acme", employerPolicy("P"))).resolves.toBe("You share your degree name and institution.");
  });

  it("AI_BAD_OUTPUT when the model returns no text at all", async () => {
    create.mockResolvedValueOnce({ content: [] });

    await expect(consentSummary("Acme", employerPolicy("P"))).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });

  it("AI_UNAVAILABLE when Bedrock fails (the caller falls back to the deterministic template)", async () => {
    create.mockRejectedValueOnce(new Error("timeout"));

    await expect(consentSummary("Acme", employerPolicy("P"))).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
});
