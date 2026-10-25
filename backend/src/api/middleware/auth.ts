import type { Request, RequestHandler } from "express";
import { isAdminToken } from "../../core/auth";
import { AppError } from "../../core/errors";

/** The token from `Authorization: Bearer <token>`, or null. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.get("authorization") ?? "");
  return match?.[1] ?? null;
}

/** 🔐 issuer/admin endpoints. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req);
  if (!token || !isAdminToken(token)) {
    next(new AppError("UNAUTHORIZED", "Missing or invalid admin token"));
    return;
  }
  next();
};
