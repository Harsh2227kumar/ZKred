import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { apiRouter } from "./api/router";
import { errorHandler, notFoundHandler } from "./api/middleware/errors";
import { rejectUnstorableText } from "./api/middleware/text-safety";
import { API_BASE_PATH, config } from "./config";
import { logger } from "./logger";

export { logger };

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Exactly one proxy hop (Caddy). `true` would trust any client-supplied X-Forwarded-For and let callers spoof req.ip.
  app.set("trust proxy", 1);
  app.use(pinoHttp({ logger, autoLogging: config.NODE_ENV !== "test" }));
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json({ limit: "2mb" }));
  app.use(rejectUnstorableText);

  app.use(API_BASE_PATH, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
