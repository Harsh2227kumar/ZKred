// OpenAPI document built from the Zod contract schemas. Served at GET /api/v1/openapi.json;
// the frontend generates src/api/types.ts from it. Register every new endpoint here.
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";
import { API_BASE_PATH, APP_VERSION } from "../config";
import { ErrorResponse } from "./common.schema";
import { Health } from "./health.schema";
import {
  Batch,
  BatchLeaves,
  BatchList,
  BatchParams,
  IssueCredentialIn,
  IssueCredentialOut,
  IssuedCredentialList,
  IssuerBatchParams,
  IssuerCredentialParams,
  ListQuery,
  ReissueIn,
  ReissueOut,
  RevokeOut,
  StatusListOut,
  StatusListParams,
} from "./issuance.schema";
import { AttackRunOut, AttackState, ForgeIn, ForgeOut, OkOut, StealKeyIn, StolenKey, VerifyForgedIn } from "./attack.schema";
import {
  CompromiseCreate,
  CompromiseReport,
  Issuer,
  IssuerCreate,
  IssuerKey,
  IssuerKeyParams,
  IssuerList,
  IssuerParams,
} from "./issuers.schema";
import {
  ParseIn,
  ParseOut,
  Presentation,
  PresentationRequest,
  RequestCreate,
  RequestParams,
  Verification,
  VerificationList,
  Verifier,
  VerifierCreate,
  VerifierList,
} from "./verifiers.schema";
import {
  Backup,
  BackupIn,
  CredentialOffer,
  CredentialOfferList,
  WalletCreate,
  WalletCreated,
  WalletLookupQuery,
  WalletOfferParams,
  WalletParams,
  WalletPublic,
} from "./wallets.schema";
import { ChainInfo, CredentialSchemaList, Enums } from "./meta.schema";

const registry = new OpenAPIRegistry();

const json = <T>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const errorResponses = { default: json(ErrorResponse, "Standard error (CONTRACTS §2)") };

const adminAuth = registry.registerComponent("securitySchemes", "adminToken", {
  type: "http",
  scheme: "bearer",
  description: "ISSUER_ADMIN_TOKEN (🔐 endpoints)",
});
const admin = [{ [adminAuth.name]: [] }];

const walletAuth = registry.registerComponent("securitySchemes", "walletToken", {
  type: "http",
  scheme: "bearer",
  description: "wallet_token from POST /wallets (👛 endpoints); only opens its own wallet",
});
const wallet = [{ [walletAuth.name]: [] }];

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["meta"],
  responses: { 200: json(Health, "Dependency health"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/meta/enums",
  tags: ["meta"],
  responses: { 200: json(Enums, "Option lists for the UI"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/meta/chain",
  tags: ["meta"],
  responses: { 200: json(ChainInfo, "Chain + contract details"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/meta/credential-schemas",
  tags: ["meta"],
  responses: { 200: json(CredentialSchemaList, "Credential layouts (BBS message order)"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  path: "/issuers",
  tags: ["issuers"],
  security: admin,
  request: { body: json(IssuerCreate, "New issuer") },
  responses: { 201: json(Issuer, "Issuer registered on-chain"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/issuers",
  tags: ["issuers"],
  responses: { 200: json(IssuerList, "All issuers"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/issuers/{issuer_id}",
  tags: ["issuers"],
  request: { params: IssuerParams },
  responses: { 200: json(Issuer, "One issuer"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/keys/rotate",
  tags: ["issuers"],
  security: admin,
  request: { params: IssuerParams },
  responses: { 200: json(IssuerKey, "The new active key"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/credentials",
  tags: ["issuance"],
  security: admin,
  request: { params: IssuerParams, body: json(IssueCredentialIn, "Credential to issue") },
  responses: { 201: json(IssueCredentialOut, "Signed, offered to the wallet, added to the open batch"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/issuers/{issuer_id}/credentials",
  tags: ["issuance"],
  security: admin,
  request: { params: IssuerParams, query: ListQuery },
  responses: { 200: json(IssuedCredentialList, "Issued credentials, newest first (no claims)"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/issuers/{issuer_id}/batches",
  tags: ["issuance"],
  request: { params: IssuerParams },
  responses: { 200: json(BatchList, "Issuance batches, newest first"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/batches/{batch_id}/anchor",
  tags: ["issuance"],
  security: admin,
  request: { params: IssuerBatchParams },
  responses: { 200: json(Batch, "Batch anchored on-chain"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/batches/{batch_id}/leaves",
  tags: ["issuance"],
  request: { params: BatchParams },
  responses: { 200: json(BatchLeaves, "Batch commitments (wallet builds its Merkle proof)"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/status-lists/{list_id}",
  tags: ["issuance"],
  request: { params: StatusListParams },
  responses: { 200: json(StatusListOut, "Revocation bitstring + on-chain hash"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  path: "/wallets",
  tags: ["wallets"],
  request: { body: json(WalletCreate, "New holder wallet") },
  responses: { 201: json(WalletCreated, "Wallet created; wallet_token is shown only here"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/wallets/lookup",
  tags: ["wallets"],
  request: { query: WalletLookupQuery },
  responses: { 200: json(WalletPublic, "Public wallet info (pick a recipient)"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/wallets/{wallet_id}/offers",
  tags: ["wallets"],
  security: wallet,
  request: { params: WalletParams },
  responses: { 200: json(CredentialOfferList, "Encrypted credential offers, newest first"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/wallets/{wallet_id}/offers/{offer_id}/claim",
  tags: ["wallets"],
  security: wallet,
  request: { params: WalletOfferParams },
  responses: { 200: json(CredentialOffer, "Offer with claimed_at set (idempotent)"), ...errorResponses },
});
registry.registerPath({
  method: "put",
  path: "/wallets/{wallet_id}/backup",
  tags: ["wallets"],
  security: wallet,
  request: { params: WalletParams, body: json(BackupIn, "Passphrase-encrypted wallet backup") },
  responses: { 200: json(Backup, "Stored backup"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/wallets/{wallet_id}/backup",
  tags: ["wallets"],
  security: wallet,
  request: { params: WalletParams },
  responses: { 200: json(Backup, "The latest backup"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  path: "/verifiers",
  tags: ["verifiers"],
  request: { body: json(VerifierCreate, "New verifier") },
  responses: { 201: json(Verifier, "Verifier created"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/verifiers",
  tags: ["verifiers"],
  responses: { 200: json(VerifierList, "All verifiers"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/presentation-requests/parse",
  tags: ["verifiers"],
  description: "Claude on Bedrock; 422 POLICY_AMBIGUOUS with details.questions, 502 AI_UNAVAILABLE / AI_BAD_OUTPUT",
  request: { body: json(ParseIn, "Plain-English requirement") },
  responses: { 200: json(ParseOut, "Policy built by Claude"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/presentation-requests",
  tags: ["verifiers"],
  request: { body: json(RequestCreate, "Policy to request") },
  responses: { 201: json(PresentationRequest, "Request with a fresh nonce and wallet link"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/presentation-requests/{request_id}",
  tags: ["verifiers"],
  request: { params: RequestParams },
  responses: { 200: json(PresentationRequest, "The request (410 REQUEST_EXPIRED once expired)"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/presentation-requests/{request_id}/presentations",
  tags: ["verifiers"],
  description: "Runs the full 4-step eval chain. 409 NONCE_USED once a presentation was accepted, 410 when expired",
  request: { params: RequestParams, body: json(Presentation, "Presentation built by zk-core in the wallet") },
  responses: { 200: json(Verification, "Verification result (rejections are 200 too)"), ...errorResponses },
});
registry.registerPath({
  method: "get",
  path: "/presentation-requests/{request_id}/verifications",
  tags: ["verifiers"],
  request: { params: RequestParams },
  responses: { 200: json(VerificationList, "Verifications of this request, newest first"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/credentials/{credential_id}/revoke",
  tags: ["issuance"],
  security: admin,
  request: { params: IssuerCredentialParams },
  responses: { 200: json(RevokeOut, "Status bit set; new list hash pinned on-chain"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/keys/{key_id}/compromise",
  tags: ["issuers"],
  security: admin,
  request: { params: IssuerKeyParams, body: json(CompromiseCreate, "Compromise window (default BREACH_WINDOW_SECONDS)") },
  responses: { 200: json(CompromiseReport, "markCompromised (+ auto-rotate) and the affected batches"), ...errorResponses },
});
registry.registerPath({
  method: "post",
  path: "/issuers/{issuer_id}/reissue",
  tags: ["issuance"],
  security: wallet,
  request: { params: IssuerParams, body: json(ReissueIn, "The holder's old credential") },
  responses: { 201: json(ReissueOut, "New offer signed with the active key"), ...errorResponses },
});

const attack = (path: string, method: "get" | "post", response: z.ZodType, description: string, body?: z.ZodType) =>
  registry.registerPath({
    method,
    path,
    tags: ["attack"],
    security: admin,
    description: "DEMO_MODE only (404 otherwise)",
    request: body ? { body: json(body, "Attack input") } : undefined,
    responses: { 200: json(response, description), ...errorResponses },
  });
attack("/attack/steal-key", "post", StolenKey, "Copied the active BBS secret key (not the governance wallet)", StealKeyIn);
attack("/attack/forge", "post", ForgeOut, "Forged credentials injected into the issuer's batch", ForgeIn);
attack("/attack/verify-forged", "post", AttackRunOut, "Every forgery run through the engine", VerifyForgedIn);
attack("/attack/state", "get", AttackState, "Counters + timeline");
attack("/attack/reset", "post", OkOut, "Attack tables cleared");

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "ZKred API", version: APP_VERSION },
    servers: [{ url: API_BASE_PATH }],
  });
}
