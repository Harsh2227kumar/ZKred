// scripts/export-openapi.ts
// Exports backend OpenAPI 3.1 schema to a static JSON file for frontend type generation.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../backend/src/schemas/openapi";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../frontend/src/api/openapi.json");
mkdirSync(dirname(outputPath), { recursive: true });

const doc = buildOpenApiDocument();
writeFileSync(outputPath, JSON.stringify(doc, null, 2), "utf-8");
console.log(`OpenAPI document exported successfully to: ${outputPath}`);
