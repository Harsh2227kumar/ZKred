import { Router } from "express";
import { notImplemented } from "../core/errors";
import { createRequest, createVerifier, getRequest, listVerifications, listVerifiers } from "../core/verifiers";
import { ParseIn, RequestCreate, RequestParams, VerifierCreate } from "../schemas/verifiers.schema";

export const verifiersRouter = Router();

verifiersRouter.post("/verifiers", async (req, res) => {
  res.status(201).json(await createVerifier(VerifierCreate.parse(req.body)));
});

verifiersRouter.get("/verifiers", async (_req, res) => {
  res.json(await listVerifiers());
});

// Registered before /:request_id so "parse" is never read as a request id.
verifiersRouter.post("/presentation-requests/parse", (req) => {
  ParseIn.parse(req.body);
  throw notImplemented("Natural-language policy parsing (V1.1-H3)");
});

verifiersRouter.post("/presentation-requests", async (req, res) => {
  res.status(201).json(await createRequest(RequestCreate.parse(req.body)));
});

verifiersRouter.get("/presentation-requests/:request_id", async (req, res) => {
  res.json(await getRequest(RequestParams.parse(req.params).request_id));
});

verifiersRouter.post("/presentation-requests/:request_id/presentations", (req) => {
  RequestParams.parse(req.params);
  throw notImplemented("Presentation verification (V1.1-H2)");
});

verifiersRouter.get("/presentation-requests/:request_id/verifications", async (req, res) => {
  res.json(await listVerifications(RequestParams.parse(req.params).request_id));
});
