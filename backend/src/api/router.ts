import { Router } from "express";
import { buildOpenApiDocument } from "../schemas/openapi";
import { healthRouter } from "./health.routes";
import { metaRouter } from "./meta.routes";

export const apiRouter = Router();

const openApiDocument = buildOpenApiDocument();
apiRouter.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

apiRouter.use(healthRouter);
apiRouter.use(metaRouter);
