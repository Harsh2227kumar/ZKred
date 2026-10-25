import type { Request, RequestHandler } from "express";
import { isAdminToken } from "../../core/auth";
import { AppError } from "../../core/errors";
import { walletIdForToken } from "../../core/wallets";

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

/**
 * 👛 wallet endpoints on /wallets/:wallet_id/...: 401 for a missing/unknown token,
 * 403 when the token is valid but opens a different wallet.
 */
export const requireWalletOwner: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  const walletId = token ? await walletIdForToken(token) : null;
  if (!walletId) {
    next(new AppError("UNAUTHORIZED", "Missing or invalid wallet token"));
    return;
  }
  if (walletId !== req.params.wallet_id) {
    next(new AppError("FORBIDDEN", "This wallet token does not open that wallet"));
    return;
  }
  next();
};

/** 👛 endpoints whose wallet is named in the JSON body (`wallet_id`), e.g. POST /issuers/{id}/reissue. */
export const requireWalletOwnerOfBody: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  const walletId = token ? await walletIdForToken(token) : null;
  if (!walletId) {
    next(new AppError("UNAUTHORIZED", "Missing or invalid wallet token"));
    return;
  }
  const claimed: unknown = req.body?.wallet_id;
  if (typeof claimed === "string" && claimed !== walletId) {
    next(new AppError("FORBIDDEN", "This wallet token does not open that wallet"));
    return;
  }
  next();
};
