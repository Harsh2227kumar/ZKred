import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config";
import { logger } from "../logger";
import * as schema from "./schema";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
// An idle client losing its connection (DB restart, network blip) emits 'error' on the pool; unhandled, it kills the process.
pool.on("error", (err) => logger.error({ err }, "postgres pool error"));
export const db = drizzle(pool, { schema });
export type Db = typeof db;
