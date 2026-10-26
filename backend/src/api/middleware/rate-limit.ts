// Fixed-window rate limit per client IP (req.ip; the app trusts exactly one proxy hop, Caddy). In memory: the
// backend runs as one process. Guards the endpoints that cost money (Bedrock) or a lot of CPU (proof checks).
import type { RequestHandler } from "express";
import { AppError } from "../../core/errors";

export function rateLimit(opts: { name: string; max: number; windowMs: number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  // Drop expired windows so the map never grows with one-off clients.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, opts.windowMs);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip ?? "unknown";
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + opts.windowMs };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > opts.max) {
      const retryAfter = Math.ceil((h.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      next(new AppError("RATE_LIMITED", `Too many ${opts.name} requests; try again in ${retryAfter}s`, { retry_after_seconds: retryAfter }));
      return;
    }
    next();
  };
}
