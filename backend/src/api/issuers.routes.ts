import { Router } from "express";
import { reportCompromise } from "../core/breach";
import { createIssuer, getIssuer, listIssuers } from "../core/issuers";
import { rotateIssuerKey } from "../core/key-rotation";
import { CompromiseCreate, IssuerCreate, IssuerKeyParams, IssuerParams } from "../schemas/issuers.schema";
import { requireAdmin } from "./middleware/auth";

export const issuersRouter = Router();

issuersRouter.post("/issuers", requireAdmin, async (req, res) => {
  res.status(201).json(await createIssuer(IssuerCreate.parse(req.body)));
});

issuersRouter.get("/issuers", async (_req, res) => {
  res.json(await listIssuers());
});

issuersRouter.get("/issuers/:issuer_id", async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.json(await getIssuer(issuer_id));
});

issuersRouter.post("/issuers/:issuer_id/keys/rotate", requireAdmin, async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.json(await rotateIssuerKey(issuer_id));
});

issuersRouter.post("/issuers/:issuer_id/keys/:key_id/compromise", requireAdmin, async (req, res) => {
  const { issuer_id, key_id } = IssuerKeyParams.parse(req.params);
  const { window_seconds } = CompromiseCreate.parse(req.body ?? {});
  res.json(await reportCompromise(issuer_id, key_id as `0x${string}`, window_seconds));
});
