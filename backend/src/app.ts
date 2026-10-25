import cors from "cors";
import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import { apiRouter } from "./api/router";
import { errorHandler, notFoundHandler } from "./api/middleware/errors";
import { API_BASE_PATH, config } from "./config";

export const logger = pino({
  level: config.LOG_LEVEL,
  // Never log auth headers (admin/wallet tokens).
  redact: ["req.headers.authorization", "req.headers.cookie"],
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true); // behind Caddy
  app.use(pinoHttp({ logger, autoLogging: config.NODE_ENV !== "test" }));
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json({ limit: "2mb" }));

  app.use(API_BASE_PATH, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
