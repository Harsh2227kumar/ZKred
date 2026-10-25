import { Router } from "express";
import { config } from "../config";
import { createRequest, createVerifier, getRequest, listVerifications, listVerifiers, parseRequestText, submitPresentation } from "../core/verifiers";
import { rateLimit } from "./middleware/rate-limit";
import { ParseIn, Presentation, RequestCreate, RequestParams, VerifierCreate } from "../schemas/verifiers.schema";

export const verifiersRouter = Router();

const limitWindow = { windowMs: config.RATE_LIMIT_WINDOW_MS };
// Both call Bedrock (policy parse, consent text): they cost money per call.
const aiLimit = rateLimit({ name: "AI", max: config.RATE_LIMIT_AI_MAX, ...limitWindow });
const verifyLimit = rateLimit({ name: "verification", max: config.RATE_LIMIT_VERIFY_MAX, ...limitWindow });

verifiersRouter.post("/verifiers", async (req, res) => {
  res.status(201).json(await createVerifier(VerifierCreate.parse(req.body)));
});

verifiersRouter.get("/verifiers", async (_req, res) => {
  res.json(await listVerifiers());
});

// Registered before /:request_id so "parse" is never read as a request id.
verifiersRouter.post("/presentation-requests/parse", aiLimit, async (req, res) => {
  res.json(await parseRequestText(ParseIn.parse(req.body).text));
});

verifiersRouter.post("/presentation-requests", aiLimit, async (req, res) => {
  res.status(201).json(await createRequest(RequestCreate.parse(req.body)));
});

verifiersRouter.get("/presentation-requests/:request_id", async (req, res) => {
  res.json(await getRequest(RequestParams.parse(req.params).request_id));
});

verifiersRouter.post("/presentation-requests/:request_id/presentations", verifyLimit, async (req, res) => {
  const { request_id } = RequestParams.parse(req.params);
  res.json(await submitPresentation(request_id, Presentation.parse(req.body)));
});

verifiersRouter.get("/presentation-requests/:request_id/verifications", async (req, res) => {
  res.json(await listVerifications(RequestParams.parse(req.params).request_id));
});
