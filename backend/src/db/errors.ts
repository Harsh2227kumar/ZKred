// Postgres error classification. Drizzle wraps driver errors, so the SQLSTATE may sit on `cause`.
const UNIQUE_VIOLATION = "23505";

function sqlState(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export const isUniqueViolation = (err: unknown): boolean => sqlState(err) === UNIQUE_VIOLATION;
