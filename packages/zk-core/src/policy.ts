// Presentation policy + presentation Zod schemas. Single source for the backend (validation, OpenAPI) and the
// frontend (consent screen). Mirrors md/CONTRACTS.md §3.6 PresentationPolicy / Presentation.
import { z } from "zod";
import { CREDENTIAL_LAYOUTS, CREDENTIAL_TYPES, MANDATORY_REVEAL_MAX_INDEX } from "./layouts";

/** Mirrors the `issuer_kind` DB enum (CONTRACTS §5). */
export const ISSUER_KINDS = ["university", "medical_council", "government"] as const;
export type IssuerKind = (typeof ISSUER_KINDS)[number];

/** Predicate types a requirement may ask for; `age_gte` needs a GovernmentId (dob_commitment at index 13). */
export const PREDICATE_TYPES = ["age_gte"] as const;

const Hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected 0x-prefixed 32-byte hex");
const Base64urlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, "expected base64url");

export const PredicateSchema = z.object({
  type: z.literal("age_gte"),
  years: z.int().min(1).max(120),
});

export const RequirementSchema = z
  .object({
    id: z.string().min(1).max(32),
    credential_type: z.enum(CREDENTIAL_TYPES),
    accredited_only: z.boolean(),
    issuer_kinds: z.array(z.enum(ISSUER_KINDS)).nullable(),
    issuer_dids: z.array(z.string().min(1)).nullable(),
    reveal: z.array(z.string().min(1)),
    equals: z.array(z.object({ field: z.string().min(1), value: z.string() })),
    predicates: z.array(PredicateSchema),
    require_not_revoked: z.boolean(),
  })
  .superRefine((r, ctx) => {
    const fields = CREDENTIAL_LAYOUTS[r.credential_type].fields;
    const byName = new Map(fields.map((f) => [f.name, f]));
    r.reveal.forEach((name, i) => {
      if (!byName.has(name)) {
        ctx.addIssue({ code: "custom", path: ["reveal", i], message: `${name} is not a ${r.credential_type} field` });
      }
    });
    // equals is checked on revealed values: the field must be revealed explicitly or be mandatory meta (0–6).
    r.equals.forEach((e, i) => {
      const f = byName.get(e.field);
      const revealed = f !== undefined && (f.index <= MANDATORY_REVEAL_MAX_INDEX || r.reveal.includes(e.field));
      if (!revealed) {
        ctx.addIssue({ code: "custom", path: ["equals", i, "field"], message: `${e.field} must be revealed to be compared` });
      }
    });
    if (r.predicates.length > 0 && r.credential_type !== "GovernmentId") {
      ctx.addIssue({ code: "custom", path: ["predicates"], message: "age_gte requires a GovernmentId credential" });
    }
  });

export const PresentationPolicySchema = z
  .object({
    purpose: z.string().min(1).max(500),
    requirements: z.array(RequirementSchema).min(1),
    never_collect: z.array(z.string().min(1)),
  })
  .superRefine((p, ctx) => {
    const ids = p.requirements.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["requirements"], message: "requirement ids must be unique" });
    }
    const never = new Set(p.never_collect);
    p.requirements.forEach((r, ri) => {
      r.reveal.forEach((name, i) => {
        if (never.has(name)) {
          ctx.addIssue({
            code: "custom",
            path: ["requirements", ri, "reveal", i],
            message: `${name} is listed in never_collect`,
          });
        }
      });
    });
  });

export const PresentationItemSchema = z.object({
  requirement_id: z.string().min(1),
  credential_type: z.enum(CREDENTIAL_TYPES),
  issuer_did: z.string().min(1),
  key_id: Hex32Schema,
  disclosed: z.record(z.string().regex(/^(0|[1-9]\d*)$/, "keys are BBS message indices"), z.string()),
  bbs_proof: Base64urlSchema,
  merkle_proof: z.array(Hex32Schema),
  age_proof: z
    .object({
      proof: z.record(z.string(), z.unknown()),
      public_signals: z.array(z.string()),
    })
    .nullable(),
});

export const PresentationSchema = z.object({
  request_id: z.uuid(),
  nonce: Base64urlSchema,
  items: z.array(PresentationItemSchema).min(1),
});

export type PresentationPolicy = z.infer<typeof PresentationPolicySchema>;
export type PresentationRequirement = z.infer<typeof RequirementSchema>;
export type Presentation = z.infer<typeof PresentationSchema>;
export type PresentationItem = z.infer<typeof PresentationItemSchema>;
