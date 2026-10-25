import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../core/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError("NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) details[issue.path.join(".") || "(body)"] = issue.message;
    res.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details } });
    return;
  }
  if (err instanceof AppError) {
    if (err.status >= 500) req.log?.warn({ code: err.code, err }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // express.json() parse failures carry a 4xx status
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 400 && status < 500) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Malformed request" } });
    return;
  }
  req.log?.error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
