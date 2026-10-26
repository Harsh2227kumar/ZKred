// rejectUnstorableText on a bare app (no DB): NUL / unpaired surrogates anywhere in the body or query → 422 with the
// field path; real text (emoji = paired surrogates, Devanagari, …) passes; deep JSON can't overflow the stack.
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../src/api/middleware/errors";
import { rejectUnstorableText } from "../../src/api/middleware/text-safety";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(rejectUnstorableText);
app.all("/echo", (req, res) => {
  res.json({ ok: true, body: req.body ?? null });
});
app.use(errorHandler);

const field = async (body: unknown) => {
  const res = await request(app).post("/echo").send(body as object).expect(422);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  return Object.keys(res.body.error.details)[0];
};

describe("rejectUnstorableText", () => {
  it("names the first bad field: nested values, array items and object keys", async () => {
    expect(await field({ name: "a\u0000b" })).toBe("name");
    expect(await field({ policy: { requirements: [{ reveal: ["ok", "x\uDC00"] }] } })).toBe("policy.requirements.0.reveal.1");
    expect(await field({ claims: { "deg\u0000ree": "MBBS" } })).toBe("claims.deg\u0000ree");
    expect(await field(["fine", "\uD800"])).toBe("1");
  });

  it("checks the query string too", async () => {
    const res = await request(app).get("/echo?display_name=Asha%00").expect(422);
    expect(res.body.error.details).toHaveProperty("display_name");
  });

  it("lets real text through: emoji (paired surrogates), Indic scripts, empty strings, numbers", async () => {
    const body = { name: "आशा शर्मा 🎓", note: "", n: 42, nested: { list: ["✓", "𝔸"] } };
    expect((await request(app).post("/echo").send(body).expect(200)).body.body).toEqual(body);
  });

  it("walks very deep JSON without overflowing the stack", async () => {
    const depth = 20000;
    const deep = `${'{"d":'.repeat(depth)}"bottom\\u0000"${"}".repeat(depth)}`;
    const res = await request(app).post("/echo").set("Content-Type", "application/json").send(deep);
    // express.json may refuse the nesting itself (400); either way it's a client error, never a crash.
    expect([400, 422]).toContain(res.status);
  });
});
