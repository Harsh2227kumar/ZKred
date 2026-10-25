// Verifiers and presentation requests (CONTRACTS §3.4). Verification itself (presentations) lands in V1.1-H2,
// NL parsing in V1.1-H3; until then those endpoints answer 501.
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "../config";
import * as repo from "../db/repositories/verifiers.repo";
import type {
  PresentationRequest,
  RequestCreate,
  Verification,
  Verifier,
  VerifierCreate,
} from "../schemas/verifiers.schema";
import { consentTemplate } from "./consent";
import { AppError } from "./errors";

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

export async function createVerifier(input: VerifierCreate): Promise<Verifier> {
  return toVerifier(await repo.insertVerifier({ name: input.name, did: `${VERIFIER_DID_PREFIX}${randomUUID()}` }));
}

export async function listVerifiers(): Promise<{ items: Verifier[] }> {
  return { items: (await repo.listVerifiers()).map(toVerifier) };
}

export async function createRequest(input: RequestCreate): Promise<PresentationRequest> {
  const verifier = await repo.findVerifier(input.verifier_id);
  if (!verifier) throw new AppError("VALIDATION_ERROR", "Unknown verifier", { verifier_id: "no verifier with this id" });
  const now = new Date();
  const row = await repo.insertRequest({
    verifierId: verifier.id,
    nlText: input.nl_text,
    policy: input.policy,
    consentSummary: consentTemplate(verifier.name, input.policy),
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

export async function listVerifications(requestId: string): Promise<{ items: Verification[] }> {
  if (!(await repo.findRequest(requestId))) throw new AppError("NOT_FOUND", "Presentation request not found");
  return {
    items: (await repo.listVerifications(requestId)).map((v) => ({
      id: v.id,
      request_id: v.requestId,
      mode: v.mode as Verification["mode"],
      result: v.result,
      steps: v.steps as Verification["steps"],
      revealed: v.revealed as Verification["revealed"],
      created_at: v.createdAt.toISOString(),
    })),
  };
}
