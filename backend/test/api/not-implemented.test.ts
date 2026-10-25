// Endpoints whose logic lands in V1.1 answer 501 NOT_IMPLEMENTED (never fake data). No DB or chain needed.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp();

describe("V1.1 endpoints are 501 until implemented", () => {
  it("POST /presentation-requests/parse → 501 for a valid body, 422 for an invalid one", async () => {
    const res = await request(app)
      .post("/api/v1/presentation-requests/parse")
      .send({ text: "Need a medical degree and age over 21, no DOB please" })
      .expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
    await request(app).post("/api/v1/presentation-requests/parse").send({ text: "short" }).expect(422);
  });

  it("POST /presentation-requests/{id}/presentations → 501", async () => {
    const res = await request(app).post(`/api/v1/presentation-requests/${randomUUID()}/presentations`).send({}).expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("the OpenAPI document lists every V1.0 path", async () => {
    const paths = Object.keys((await request(app).get("/api/v1/openapi.json").expect(200)).body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/issuers",
        "/issuers/{issuer_id}",
        "/issuers/{issuer_id}/keys/rotate",
        "/issuers/{issuer_id}/credentials",
        "/issuers/{issuer_id}/batches",
        "/issuers/{issuer_id}/batches/{batch_id}/anchor",
        "/batches/{batch_id}/leaves",
        "/status-lists/{list_id}",
        "/wallets",
        "/wallets/lookup",
        "/wallets/{wallet_id}/offers",
        "/wallets/{wallet_id}/offers/{offer_id}/claim",
        "/wallets/{wallet_id}/backup",
        "/verifiers",
        "/presentation-requests",
        "/presentation-requests/parse",
        "/presentation-requests/{request_id}",
        "/presentation-requests/{request_id}/presentations",
        "/presentation-requests/{request_id}/verifications",
      ]),
    );
  });
});
