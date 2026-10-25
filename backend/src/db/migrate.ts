// Applies drizzle/ migrations. Run: pnpm --filter backend db:migrate (the container runs it on start).
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  console.log("migrations applied");
} finally {
  await pool.end();
}
