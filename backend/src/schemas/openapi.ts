// OpenAPI document built from the Zod contract schemas. Served at GET /api/v1/openapi.json;
// the frontend generates src/api/types.ts from it. Register every new endpoint here.
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
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
  ListQuery,
  StatusListOut,
  StatusListParams,
} from "./issuance.schema";
import { Issuer, IssuerCreate, IssuerKey, IssuerList, IssuerParams } from "./issuers.schema";
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

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "ZKred API", version: APP_VERSION },
    servers: [{ url: API_BASE_PATH }],
  });
}
