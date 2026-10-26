import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../src/api/middleware/errors";
import { rateLimit } from "../../src/api/middleware/rate-limit";

function appWith(max: number, windowMs: number) {
  const app = express();
  app.get("/x", rateLimit({ name: "test", max, windowMs }), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("rateLimit", () => {
  it("answers 429 RATE_LIMITED with Retry-After once a client exceeds the limit, then resets with the window", async () => {
    const app = appWith(2, 300);
    await request(app).get("/x").expect(200);
    await request(app).get("/x").expect(200);
    const res = await request(app).get("/x").expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 350));
    await request(app).get("/x").expect(200);
  });
});
