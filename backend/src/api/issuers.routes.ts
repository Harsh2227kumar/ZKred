import { Router } from "express";
import { createIssuer, getIssuer, listIssuers, rotateIssuerKey } from "../core/issuers";
import { IssuerCreate, IssuerParams } from "../schemas/issuers.schema";
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
