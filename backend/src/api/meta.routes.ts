import { Router } from "express";
import { getChainInfo, getCredentialSchemas, getEnums } from "../core/meta";

export const metaRouter = Router();

metaRouter.get("/meta/enums", (_req, res) => {
  res.json(getEnums());
});

metaRouter.get("/meta/chain", (_req, res) => {
  res.json(getChainInfo());
});

metaRouter.get("/meta/credential-schemas", (_req, res) => {
  res.json(getCredentialSchemas());
});
