// Rejects request strings Postgres cannot store faithfully: U+0000 (text and jsonb refuse it: a 500) and unpaired
// UTF-16 surrogates (jsonb refuses them; text silently stores U+FFFD instead). Checked once for the whole JSON body and
// the query string, so no endpoint reaches the DB with them: 422 VALIDATION_ERROR, never a 500 or an altered value.
import type { RequestHandler } from "express";
import { AppError } from "../../core/errors";

const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Dotted path of the first key or string value in `root` that can't be stored, or null. Iterative, so deep JSON can't blow the stack. */
function firstUnstorable(root: unknown): string | null {
  const stack: [unknown, string][] = [[root, ""]];
  const join = (path: string, key: string | number) => (path ? `${path}.${key}` : String(key));
  while (stack.length) {
    const [value, path] = stack.pop()!;
    if (typeof value === "string") {
      if (UNSTORABLE.test(value)) return path || "(body)";
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => stack.push([item, join(path, i)]));
    } else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (UNSTORABLE.test(key)) return join(path, key);
        stack.push([item, join(path, key)]);
      }
    }
  }
  return null;
}

export const rejectUnstorableText: RequestHandler = (req, _res, next) => {
  const field = firstUnstorable(req.body) ?? firstUnstorable(req.query);
  if (field) {
    next(
      new AppError("VALIDATION_ERROR", "Request validation failed", {
        [field]: "must not contain NUL characters or unpaired UTF-16 surrogates",
      }),
    );
    return;
  }
  next();
};
