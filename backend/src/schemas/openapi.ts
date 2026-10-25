// OpenAPI document built from the Zod contract schemas. Served at GET /api/v1/openapi.json;
// the frontend generates src/api/types.ts from it. Register every new endpoint here.
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { API_BASE_PATH, APP_VERSION } from "../config";
import { ErrorResponse } from "./common.schema";
import { Health } from "./health.schema";
import { ChainInfo, CredentialSchemaList, Enums } from "./meta.schema";

const registry = new OpenAPIRegistry();

const json = <T>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const errorResponses = { default: json(ErrorResponse, "Standard error (CONTRACTS §2)") };

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

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "ZKred API", version: APP_VERSION },
    servers: [{ url: API_BASE_PATH }],
  });
}
