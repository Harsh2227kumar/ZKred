// V1.2-H3: with DEMO_MODE=false the attack console must not exist: every /attack route is a plain 404 NOT_FOUND,
// with or without the admin token (no 401 that would reveal the routes are there). No DB or chain needed.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

// Before the app (and its config) is imported: this file gets its own module graph.
process.env.DEMO_MODE = "false";

const api = "/api/v1";
let app: ReturnType<(typeof import("../../src/app"))["createApp"]>;
let adminAuth: { Authorization: string };

beforeAll(async () => {
  const [{ createApp }, { config }] = await Promise.all([import("../../src/app"), import("../../src/config")]);
  expect(config.DEMO_MODE).toBe(false);
  app = createApp();
  adminAuth = { Authorization: `Bearer ${config.ISSUER_ADMIN_TOKEN}` };
});

const ROUTES: ["get" | "post", string][] = [
  ["post", "/attack/steal-key"],
  ["post", "/attack/forge"],
  ["post", "/attack/verify-forged"],
  ["get", "/attack/state"],
  ["post", "/attack/reset"],
];

describe("attack console with DEMO_MODE=false", () => {
  it.each(ROUTES)("%s %s → 404 NOT_FOUND with the admin token", async (method, path) => {
    const res = await request(app)[method](`${api}${path}`).set(adminAuth).send({ issuer_id: crypto.randomUUID(), mode: "full" }).expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each(ROUTES)("%s %s → 404 (not 401) without a token", async (method, path) => {
    const res = await request(app)[method](`${api}${path}`).send({}).expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /meta/chain tells the UI the console is off", async () => {
    expect((await request(app).get(`${api}/meta/chain`).expect(200)).body.demo_mode).toBe(false);
  });
});
