// OpenAPI document built from the Zod contract schemas. Served at GET /api/v1/openapi.json;
// the frontend generates src/api/types.ts from it. Register every new endpoint here.
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { API_BASE_PATH, APP_VERSION } from "../config";
import { ErrorResponse } from "./common.schema";
import { Health } from "./health.schema";
import { Issuer, IssuerCreate, IssuerKey, IssuerList, IssuerParams } from "./issuers.schema";
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

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "ZKred API", version: APP_VERSION },
    servers: [{ url: API_BASE_PATH }],
  });
}
