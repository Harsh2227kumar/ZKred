import { Router } from "express";
import { buildOpenApiDocument } from "../schemas/openapi";
import { attackRouter } from "./attack.routes";
import { healthRouter } from "./health.routes";
import { issuanceRouter } from "./issuance.routes";
import { issuersRouter } from "./issuers.routes";
import { metaRouter } from "./meta.routes";
import { verifiersRouter } from "./verifiers.routes";
import { walletsRouter } from "./wallets.routes";

export const apiRouter = Router();

const openApiDocument = buildOpenApiDocument();
apiRouter.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

apiRouter.use(healthRouter);
apiRouter.use(metaRouter);
apiRouter.use(issuersRouter);
apiRouter.use(issuanceRouter);
apiRouter.use(walletsRouter);
apiRouter.use(verifiersRouter);
apiRouter.use(attackRouter);
