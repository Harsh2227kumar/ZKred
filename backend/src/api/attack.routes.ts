import { Router, type RequestHandler } from "express";
import { config } from "../config";
import { attackState, forge, resetAttack, stealKey, verifyForged } from "../core/attack";
import { AppError } from "../core/errors";
import { ForgeIn, StealKeyIn, VerifyForgedIn } from "../schemas/attack.schema";
import { requireAdmin } from "./middleware/auth";

export const attackRouter = Router();

/** ☠ The attack console exists only with DEMO_MODE=true; otherwise it is indistinguishable from a missing route. */
const requireDemoMode: RequestHandler = (req, _res, next) => {
  next(config.DEMO_MODE ? undefined : new AppError("NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

attackRouter.use("/attack", requireDemoMode, requireAdmin);

attackRouter.post("/attack/steal-key", async (req, res) => {
  res.json(await stealKey(StealKeyIn.parse(req.body).issuer_id));
});

attackRouter.post("/attack/forge", async (req, res) => {
  res.json(await forge(ForgeIn.parse(req.body)));
});

attackRouter.post("/attack/verify-forged", async (req, res) => {
  res.json(await verifyForged(VerifyForgedIn.parse(req.body).mode));
});

attackRouter.get("/attack/state", async (_req, res) => {
  res.json(await attackState());
});

attackRouter.post("/attack/reset", async (_req, res) => {
  res.json(await resetAttack());
});
