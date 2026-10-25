// Natural language → presentation policy, and holder consent text, with Claude on Bedrock (CONTRACTS §4.2).
// The model answers through a forced tool call; its output is validated with the same Zod schema the API uses
// (PresentationPolicySchema), with exactly one retry that feeds the validation errors back. Prompts live in
// ./prompts/*.md and get the credential layouts injected at runtime (single source: zk-core).
import { readFileSync } from "node:fs";
import { CREDENTIAL_LAYOUTS, ISSUER_KINDS, PresentationPolicySchema, type PresentationPolicy } from "@zkred/zk-core";
import { z } from "zod";
import { config } from "../config";
import { AppError } from "../core/errors";
import { bedrock } from "./bedrock";

const prompt = (name: string): string => readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), "utf8");
const POLICY_PROMPT = prompt("policy");
const CONSENT_PROMPT = prompt("consent");

/** One line per field, e.g. `  - 10 dob (date) "Date of birth" [PII]`, grouped by credential type. */
function layoutsText(): string {
  return Object.values(CREDENTIAL_LAYOUTS)
    .map((l) => {
      const fields = l.fields
        .map((f) => `  - ${f.index} ${f.name} (${f.kind}) "${f.label}"${f.pii ? " [PII]" : ""}${f.source === "meta" ? " [meta]" : ""}`)
        .join("\n");
      return `${l.type}:\n${fields}`;
    })
    .join("\n\n");
}

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), template);

export class AiError extends AppError {
  constructor(code: "AI_UNAVAILABLE" | "AI_BAD_OUTPUT" | "POLICY_AMBIGUOUS", message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = "AiError";
  }
}

const TOOL_NAME = "submit_policy";

const ToolOutput = z.object({
  status: z.enum(["ok", "ambiguous"]),
  policy: z.unknown().optional(),
  consent_summary: z.string().optional(),
  minimisation_notes: z.array(z.string()).optional(),
  questions: z.array(z.string()).optional(),
});

function toolSchema() {
  const { $schema: _drop, ...policy } = z.toJSONSchema(PresentationPolicySchema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  return {
    type: "object" as const,
    properties: {
      status: { type: "string", enum: ["ok", "ambiguous"] },
      policy,
      consent_summary: { type: "string" },
      minimisation_notes: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } },
    },
    required: ["status"],
  };
}

type Message = Parameters<typeof bedrock.messages.create>[0]["messages"][number];

async function callModel(system: string, messages: Message[], tool: boolean) {
  try {
    return await bedrock.messages.create({
      model: config.BEDROCK_MODEL_ID,
      max_tokens: config.AI_MAX_TOKENS,
      system,
      messages,
      ...(tool
        ? {
            tools: [{ name: TOOL_NAME, description: "Submit the presentation policy (or the clarifying questions).", input_schema: toolSchema() }],
            tool_choice: { type: "tool" as const, name: TOOL_NAME },
          }
        : {}),
    });
  } catch {
    throw new AiError("AI_UNAVAILABLE", "The AI service is unavailable; build the policy manually");
  }
}

export interface ParseResult {
  policy: PresentationPolicy;
  consent_summary: string;
  minimisation_notes: string[];
}

/** Plain-English requirement → validated policy. Throws AiError (AI_UNAVAILABLE | AI_BAD_OUTPUT | POLICY_AMBIGUOUS). */
export async function policyFromText(text: string): Promise<ParseResult> {
  const system = fill(POLICY_PROMPT, { LAYOUTS: layoutsText(), ISSUER_KINDS: ISSUER_KINDS.join(", ") });
  const messages: Message[] = [{ role: "user", content: `Requirement:\n<requirement>\n${text}\n</requirement>` }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callModel(system, messages, true);
    const call = res.content.find((b) => b.type === "tool_use");
    if (!call || call.type !== "tool_use") throw new AiError("AI_BAD_OUTPUT", "The AI did not return a policy");

    const out = ToolOutput.safeParse(call.input);
    let problems: string[];
    if (!out.success) {
      problems = out.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    } else if (out.data.status === "ambiguous") {
      const questions = (out.data.questions ?? []).filter(Boolean);
      throw new AiError("POLICY_AMBIGUOUS", "The requirement is ambiguous", {
        questions: questions.length ? questions : ["Which credential and which facts should the holder prove?"],
      });
    } else {
      const policy = PresentationPolicySchema.safeParse(out.data.policy);
      if (policy.success && out.data.consent_summary) {
        return { policy: policy.data, consent_summary: out.data.consent_summary.trim(), minimisation_notes: out.data.minimisation_notes ?? [] };
      }
      problems = policy.success ? ["consent_summary: required"] : policy.error.issues.map((i) => `policy.${i.path.join(".")}: ${i.message}`);
    }
    messages.push(
      { role: "assistant", content: res.content },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Invalid policy, fix these and call the tool again:\n${problems.join("\n")}` }],
      },
    );
  }
  throw new AiError("AI_BAD_OUTPUT", "The AI returned an invalid policy twice");
}

/** Holder-facing consent text for `policy`. Throws AiError("AI_UNAVAILABLE") so callers can fall back to the template. */
export async function consentSummary(verifierName: string, policy: PresentationPolicy): Promise<string> {
  const system = fill(CONSENT_PROMPT, { VERIFIER: verifierName, LAYOUTS: layoutsText(), POLICY: JSON.stringify(policy, null, 2) });
  const res = await callModel(system, [{ role: "user", content: "Write the consent text." }], false);
  const textBlock = res.content.find((b) => b.type === "text");
  const out = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  if (!out) throw new AiError("AI_BAD_OUTPUT", "The AI returned no consent text");
  return out;
}
