import { pino } from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.LOG_LEVEL,
  // Never log auth headers (admin/wallet tokens).
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
