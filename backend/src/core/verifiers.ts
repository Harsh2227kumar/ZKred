// Verifiers, presentation requests and presentations (CONTRACTS §3.4). The verification itself is core/verifier.ts.
import { randomBytes, randomUUID } from "node:crypto";
import { consentSummary, policyFromText, type ParseResult } from "../ai/policy";
import { config } from "../config";
import * as repo from "../db/repositories/verifiers.repo";
import type { Presentation } from "@zkred/zk-core";
import type {
  PresentationRequest,
  RequestCreate,
  Verification,
  Verifier,
  VerifierCreate,
} from "../schemas/verifiers.schema";
import { consentTemplate } from "./consent";
import { AppError } from "./errors";
import { verifyPresentation } from "./verifier";

const NONCE_BYTES = 32;
const VERIFIER_DID_PREFIX = "did:zkred:verifier:";
const WALLET_RESPOND_PATH = "/wallet/respond";

const toVerifier = (v: repo.VerifierRow): Verifier => ({
  id: v.id,
  name: v.name,
  did: v.did,
  created_at: v.createdAt.toISOString(),
});

function walletUrl(requestId: string): string {
  const url = new URL(WALLET_RESPOND_PATH, config.PUBLIC_BASE_URL);
  url.searchParams.set("request", requestId);
  return url.toString();
}

function toRequest(r: repo.RequestRow, verifierName: string): PresentationRequest {
  return {
    id: r.id,
    verifier_id: r.verifierId,
    verifier_name: verifierName,
    policy: r.policy as PresentationRequest["policy"],
    consent_summary: r.consentSummary,
    nonce: r.nonce,
    expires_at: r.expiresAt.toISOString(),
    created_at: r.createdAt.toISOString(),
    wallet_url: walletUrl(r.id),
  };
}

/** Plain-English requirement → policy (Bedrock). AI failures surface as 502 / 422 POLICY_AMBIGUOUS. */
export const parseRequestText = (text: string): Promise<ParseResult> => policyFromText(text);

export async function createVerifier(input: VerifierCreate): Promise<Verifier> {
  return toVerifier(await repo.insertVerifier({ name: input.name, did: `${VERIFIER_DID_PREFIX}${randomUUID()}` }));
}

export async function listVerifiers(): Promise<{ items: Verifier[] }> {
  return { items: (await repo.listVerifiers()).map(toVerifier) };
}

export async function createRequest(input: RequestCreate): Promise<PresentationRequest> {
  const verifier = await repo.findVerifier(input.verifier_id);
  if (!verifier) throw new AppError("VALIDATION_ERROR", "Unknown verifier", { verifier_id: "no verifier with this id" });
  // Claude writes the consent text; if Bedrock is down the deterministic template is used (never blocks a request).
  const consent = await consentSummary(verifier.name, input.policy).catch(() => consentTemplate(verifier.name, input.policy));
  const now = new Date();
  const row = await repo.insertRequest({
    verifierId: verifier.id,
    nlText: input.nl_text,
    policy: input.policy,
    consentSummary: consent,
    nonce: randomBytes(NONCE_BYTES).toString("base64url"),
    expiresAt: new Date(now.getTime() + config.REQUEST_TTL_SECONDS * 1000),
    createdAt: now,
  });
  return toRequest(row, verifier.name);
}

/** 404 if unknown, 410 REQUEST_EXPIRED once past expires_at (the wallet must not answer it any more). */
export async function getRequest(requestId: string): Promise<PresentationRequest> {
  const found = await repo.findRequest(requestId);
  if (!found) throw new AppError("NOT_FOUND", "Presentation request not found");
  if (found.request.expiresAt.getTime() <= Date.now()) {
    throw new AppError("REQUEST_EXPIRED", "This presentation request has expired", {
      expires_at: found.request.expiresAt.toISOString(),
    });
  }
  return toRequest(found.request, found.verifierName);
}

const toVerification = (v: repo.VerificationRow): Verification => ({
  id: v.id,
  request_id: v.requestId,
  mode: v.mode as Verification["mode"],
  result: v.result,
  steps: v.steps as Verification["steps"],
  revealed: v.revealed as Verification["revealed"],
  created_at: v.createdAt.toISOString(),
});

export async function listVerifications(requestId: string): Promise<{ items: Verification[] }> {
  if (!(await repo.findRequest(requestId))) throw new AppError("NOT_FOUND", "Presentation request not found");
  return { items: (await repo.listVerifications(requestId)).map(toVerification) };
}

/**
 * Runs the full eval chain on a holder's presentation and stores the result. A rejection is a normal 200 result;
 * only an accepted presentation consumes the nonce, so a holder can fix a rejected answer and try again.
 */
export async function submitPresentation(requestId: string, p: Presentation): Promise<Verification> {
  if (p.request_id !== requestId) {
    throw new AppError("VALIDATION_ERROR", "Presentation is for another request", { request_id: "does not match the URL" });
  }
  const ids = p.items.map((i) => i.requirement_id);
  if (new Set(ids).size !== ids.length) {
    throw new AppError("VALIDATION_ERROR", "One item per requirement", { items: "duplicate requirement_id" });
  }
  const found = await repo.findRequest(requestId);
  if (!found) throw new AppError("NOT_FOUND", "Presentation request not found");
  const { request } = found;
  const policy = request.policy as PresentationRequest["policy"];
  const unknown = ids.filter((id) => !policy.requirements.some((r) => r.id === id));
  if (unknown.length) {
    throw new AppError("VALIDATION_ERROR", "Unknown requirement", { items: `not in the policy: ${unknown.join(", ")}` });
  }
  if (request.expiresAt.getTime() <= Date.now()) {
    throw new AppError("REQUEST_EXPIRED", "This presentation request has expired", { expires_at: request.expiresAt.toISOString() });
  }
  const nonceUsed = () => new AppError("NONCE_USED", "A presentation was already accepted for this request");
  if (request.nonceUsedAt) throw nonceUsed();

  const outcome = await verifyPresentation({ nonce: request.nonce, policy }, p, "full");
  const row = await repo.recordVerification({ requestId, ...outcome }, new Date());
  if (!row) throw nonceUsed();
  return toVerification(row);
}
