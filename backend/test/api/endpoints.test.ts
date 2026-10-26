// V1.1/V1.2 endpoints: input validation (4xx, never 500), auth gates, and the OpenAPI listing. No DB or chain needed.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp();
const api = "/api/v1";
const hex32 = `0x${"ab".repeat(32)}`;

describe("V1.1 / V1.2 endpoints", () => {
  it("POST /presentation-requests/parse → 422 for a short text, 502 AI_UNAVAILABLE when Bedrock can't be reached", async () => {
    await request(app).post(`${api}/presentation-requests/parse`).send({ text: "short" }).expect(422);
    const res = await request(app).post(`${api}/presentation-requests/parse`).send({ text: "Need an accredited degree in medicine" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("AI_UNAVAILABLE");
  });

  it("POST .../presentations validates the body (422) before touching the DB", async () => {
    const res = await request(app).post(`${api}/presentation-requests/${randomUUID()}/presentations`).send({}).expect(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    await request(app).post(`${api}/presentation-requests/not-a-uuid/presentations`).send({}).expect(422);
  });

  it("revoke, compromise and attack need the admin token; reissue needs a wallet token", async () => {
    await request(app).post(`${api}/issuers/${randomUUID()}/credentials/${randomUUID()}/revoke`).expect(401);
    await request(app).post(`${api}/issuers/${randomUUID()}/keys/${hex32}/compromise`).send({}).expect(401);
    await request(app).post(`${api}/issuers/${randomUUID()}/reissue`).send({}).expect(401);
    for (const path of ["steal-key", "forge", "verify-forged", "reset"]) await request(app).post(`${api}/attack/${path}`).send({}).expect(401);
    await request(app).get(`${api}/attack/state`).expect(401);
  });

  it("the OpenAPI document lists every path", async () => {
    const paths = Object.keys((await request(app).get(`${api}/openapi.json`).expect(200)).body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/issuers",
        "/issuers/{issuer_id}",
        "/issuers/{issuer_id}/keys/rotate",
        "/issuers/{issuer_id}/keys/{key_id}/compromise",
        "/issuers/{issuer_id}/credentials",
        "/issuers/{issuer_id}/credentials/{credential_id}/revoke",
        "/issuers/{issuer_id}/reissue",
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
        "/attack/steal-key",
        "/attack/forge",
        "/attack/verify-forged",
        "/attack/state",
        "/attack/reset",
      ]),
    );
  });
});
