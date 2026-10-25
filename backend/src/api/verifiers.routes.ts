import { Router } from "express";
import { createRequest, createVerifier, getRequest, listVerifications, listVerifiers, parseRequestText, submitPresentation } from "../core/verifiers";
import { ParseIn, Presentation, RequestCreate, RequestParams, VerifierCreate } from "../schemas/verifiers.schema";

export const verifiersRouter = Router();

verifiersRouter.post("/verifiers", async (req, res) => {
  res.status(201).json(await createVerifier(VerifierCreate.parse(req.body)));
});

verifiersRouter.get("/verifiers", async (_req, res) => {
  res.json(await listVerifiers());
});

// Registered before /:request_id so "parse" is never read as a request id.
verifiersRouter.post("/presentation-requests/parse", async (req, res) => {
  res.json(await parseRequestText(ParseIn.parse(req.body).text));
});

verifiersRouter.post("/presentation-requests", async (req, res) => {
  res.status(201).json(await createRequest(RequestCreate.parse(req.body)));
});

verifiersRouter.get("/presentation-requests/:request_id", async (req, res) => {
  res.json(await getRequest(RequestParams.parse(req.params).request_id));
});

verifiersRouter.post("/presentation-requests/:request_id/presentations", async (req, res) => {
  const { request_id } = RequestParams.parse(req.params);
  res.json(await submitPresentation(request_id, Presentation.parse(req.body)));
});

verifiersRouter.get("/presentation-requests/:request_id/verifications", async (req, res) => {
  res.json(await listVerifications(RequestParams.parse(req.params).request_id));
});
