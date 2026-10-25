# V0-S6 Implementation: OpenAPI Type Generation

## 1. Technical Architecture

```
Backend Contract Schemas (backend/src/schemas/*.schema.ts)
                    │
                    ▼
          OpenAPIRegistry & Generator
         (backend/src/schemas/openapi.ts)
                    │
                    ▼
           /api/v1/openapi.json
                    │
                    ▼ openapi-typescript CLI
       frontend/src/api/types.ts (Generated)
                    │
                    ▼
     openapi-fetch Client (apiClient<paths>)
                    │
                    ▼
   TanStack Query Hooks & Page Components
```

---

## 2. Implementation Artifacts

### A. Generator Script (`scripts/export-openapi.ts`)
Allows generating the OpenAPI document offline (without launching Postgres or starting the full HTTP server):

```typescript
// scripts/export-openapi.ts
// Exports the backend OpenAPI 3.1 schema to a static JSON file.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { buildOpenApiDocument } from "../backend/src/schemas/openapi";

const outputPath = resolve(process.cwd(), "frontend/src/api/openapi.json");
mkdirSync(dirname(outputPath), { recursive: true });

const doc = buildOpenApiDocument();
writeFileSync(outputPath, JSON.stringify(doc, null, 2), "utf-8");
console.log(`OpenAPI document exported to: ${outputPath}`);
```

---

### B. Frontend `gen:api` Script (`frontend/package.json`)
```json
{
  "scripts": {
    "gen:api": "openapi-typescript src/api/openapi.json -o src/api/types.ts",
    "gen:api:remote": "openapi-typescript http://localhost:8080/api/v1/openapi.json -o src/api/types.ts"
  }
}
```

---

### C. Type-Safe Client Integration (`frontend/src/api/client.ts`)
```typescript
import createClient from 'openapi-fetch';
import { config } from '@/config';
import type { paths } from './types';

export const apiClient = createClient<paths>({
  baseUrl: config.apiBaseUrl,
});
```

---

## 3. Verification Sequence

1. **Export OpenAPI Schema**:
   `pnpm tsx scripts/export-openapi.ts`
2. **Generate Frontend Types**:
   `pnpm --filter frontend exec openapi-typescript src/api/openapi.json -o src/api/types.ts`
3. **Typecheck & Build**:
   `pnpm --filter frontend build`
4. **Hardcoded Rules Check**:
   `bash scripts/check-hardcoded.sh`
