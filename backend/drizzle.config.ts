// Used only by `drizzle-kit generate` (no DB connection needed). Migrations are applied by src/db/migrate.ts.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
