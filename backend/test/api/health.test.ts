import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp();
const dbConfigured = Boolean(process.env.TEST_DATABASE_URL);
const chainConfigured = Boolean(process.env.TEST_CHAIN_RPC_URL && process.env.TEST_ISSUER_REGISTRY_ADDRESS);

describe("GET /health", () => {
  it("reports each dependency and degrades when one is down (AI unreachable in tests)", async () => {
    const res = await request(app).get("/api/v1/health").expect(200);
    expect(res.body).toMatchObject({ status: "degraded", ai: "down", version: expect.any(String) });
    expect(res.body.db).toBe(dbConfigured ? "ok" : "down");
    expect(res.body.chain).toBe(chainConfigured ? "ok" : "down");
  });
});
