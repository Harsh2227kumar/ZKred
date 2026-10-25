import { createApp, logger } from "./app";
import { API_BASE_PATH, config } from "./config";
import { pool } from "./db/client";

const server = createApp().listen(config.PORT, () => {
  logger.info(`ZKred API listening on :${config.PORT}${API_BASE_PATH}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
