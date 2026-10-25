// Admin-token gate on 🔐 endpoints. Runs without a DB/chain: the gate rejects before any I/O.
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { config } from "../../src/config";

const app = createApp();
const wrongToken = () => randomBytes(24).toString("hex");

describe("admin auth", () => {
  const protectedCalls = [
    ["POST /issuers", () => request(app).post("/api/v1/issuers")],
    ["POST /issuers/{id}/keys/rotate", () => request(app).post(`/api/v1/issuers/${randomUUID()}/keys/rotate`)],
  ] as const;

  for (const [name, call] of protectedCalls) {
    it(`${name} without a token → 401`, async () => {
      const res = await call().send({}).expect(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it(`${name} with a wrong token → 401`, async () => {
      const res = await call().set("Authorization", `Bearer ${wrongToken()}`).send({}).expect(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it(`${name} with the token in the wrong scheme → 401`, async () => {
      await call().set("Authorization", `Basic ${config.ISSUER_ADMIN_TOKEN}`).send({}).expect(401);
    });
  }

  it("a valid token reaches validation (422, not 401)", async () => {
    const res = await request(app)
      .post("/api/v1/issuers")
      .set("Authorization", `Bearer ${config.ISSUER_ADMIN_TOKEN}`)
      .send({ name: "x", kind: "bakery", did_suffix: "Bad Suffix!" })
      .expect(422);
    expect(Object.keys(res.body.error.details).sort()).toEqual(["did_suffix", "kind", "name"]);
  });
});
