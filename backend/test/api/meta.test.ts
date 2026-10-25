import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { config } from "../../src/config";

const app = createApp();

describe("meta endpoints", () => {
  it("GET /meta/enums returns every option list from the contract", async () => {
    const res = await request(app).get("/api/v1/meta/enums").expect(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        "batch_statuses",
        "credential_types",
        "issuer_kinds",
        "key_statuses",
        "predicate_types",
        "verification_results",
        "verification_steps",
      ].sort(),
    );
    expect(res.body.credential_types.map((o: { value: string }) => o.value)).toEqual([
      "Degree",
      "GovernmentId",
      "MedicalLicense",
    ]);
    expect(res.body.verification_steps.map((o: { value: string }) => o.value)).toEqual([
      "issuer_signature",
      "zk_claim",
      "revocation_status",
      "key_epoch_anchor",
    ]);
  });

  it("GET /meta/chain reflects config", async () => {
    const res = await request(app).get("/api/v1/meta/chain").expect(200);
    expect(res.body).toMatchObject({
      chain_id: config.CHAIN_ID,
      issuer_registry: config.ISSUER_REGISTRY_ADDRESS,
      anchor_registry: config.ANCHOR_REGISTRY_ADDRESS,
      status_registry: config.STATUS_REGISTRY_ADDRESS,
      breach_window_seconds: config.BREACH_WINDOW_SECONDS,
      demo_mode: true,
    });
  });

  it("GET /meta/credential-schemas returns 3 layouts of 15 indexed fields", async () => {
    const res = await request(app).get("/api/v1/meta/credential-schemas").expect(200);
    expect(res.body.items).toHaveLength(3);
    for (const item of res.body.items) {
      expect(item.fields.map((f: { index: number }) => f.index)).toEqual(Array.from({ length: 15 }, (_, i) => i));
    }
  });

  it("serves the OpenAPI document with the implemented paths", async () => {
    const res = await request(app).get("/api/v1/openapi.json").expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(["/health", "/meta/enums", "/meta/chain", "/meta/credential-schemas"]),
    );
  });
});

describe("errors", () => {
  it("unknown routes return the standard NOT_FOUND shape", async () => {
    const res = await request(app).get("/api/v1/nope").expect(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("malformed JSON returns BAD_REQUEST", async () => {
    const res = await request(app)
      .post("/api/v1/meta/enums")
      .set("content-type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
