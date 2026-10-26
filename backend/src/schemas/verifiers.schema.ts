import { PresentationPolicySchema, PresentationSchema } from "@zkred/zk-core";
import { z } from "zod";
import { Base64url, DateTime, Uuid } from "./common.schema";

export const PresentationPolicy = PresentationPolicySchema.meta({ id: "PresentationPolicy" });
export const Presentation = PresentationSchema.meta({ id: "Presentation" });

export const VerifierCreate = z.object({ name: z.string().trim().min(2).max(120) }).meta({ id: "VerifierCreate" });

export const Verifier = z
  .object({ id: z.uuid(), name: z.string(), did: z.string(), created_at: DateTime })
  .meta({ id: "Verifier" });

export const VerifierList = z.object({ items: z.array(Verifier) }).meta({ id: "VerifierList" });

export const ParseIn = z.object({ text: z.string().trim().min(10).max(2000) }).meta({ id: "ParseIn" });

export const ParseOut = z
  .object({ policy: PresentationPolicy, consent_summary: z.string(), minimisation_notes: z.array(z.string()) })
  .meta({ id: "ParseOut" });

export const RequestCreate = z
  .object({
    verifier_id: z.uuid(),
    policy: PresentationPolicy,
    nl_text: z.string().trim().max(2000).nullable().default(null),
  })
  .meta({ id: "RequestCreate" });

export const PresentationRequest = z
  .object({
    id: z.uuid(),
    verifier_id: z.uuid(),
    verifier_name: z.string(),
    policy: PresentationPolicy,
    consent_summary: z.string(),
    nonce: Base64url,
    expires_at: DateTime,
    created_at: DateTime,
    wallet_url: z.string().meta({ description: "PUBLIC_BASE_URL + /wallet/respond?request=<id>" }),
  })
  .meta({ id: "PresentationRequest" });

export const VerificationStepResult = z
  .object({
    requirement_id: z.string(),
    step: z.enum(["issuer_signature", "zk_claim", "revocation_status", "key_epoch_anchor"]),
    ok: z.boolean(),
    code: z.string(),
    message: z.string(),
  })
  .meta({ id: "VerificationStepResult" });

export const Verification = z
  .object({
    id: z.uuid(),
    request_id: z.uuid(),
    mode: z.enum(["full", "naive"]),
    result: z.enum(["accepted", "rejected"]),
    steps: z.array(VerificationStepResult),
    revealed: z.record(z.string(), z.record(z.string(), z.string())),
    created_at: DateTime,
  })
  .meta({ id: "Verification" });

export const VerificationList = z.object({ items: z.array(Verification) }).meta({ id: "VerificationList" });

export const RequestParams = z.object({ request_id: Uuid });

export type VerifierCreate = z.infer<typeof VerifierCreate>;
export type Verifier = z.infer<typeof Verifier>;
export type RequestCreate = z.infer<typeof RequestCreate>;
export type PresentationRequest = z.infer<typeof PresentationRequest>;
export type Verification = z.infer<typeof Verification>;
