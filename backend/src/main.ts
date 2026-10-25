import { createApp, logger } from "./app";
import { API_BASE_PATH, config } from "./config";
import { pool } from "./db/client";

/** Grace period for in-flight requests before keep-alive sockets are cut (docker stop sends SIGKILL after 10 s). */
const SHUTDOWN_GRACE_MS = 5000;

const server = createApp().listen(config.PORT, () => {
  logger.info(`ZKred API listening on :${config.PORT}${API_BASE_PATH}`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  server.closeIdleConnections();
  // server.close() waits for every keep-alive socket; don't let an idle browser tab block the shutdown.
  setTimeout(() => server.closeAllConnections(), SHUTDOWN_GRACE_MS).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
