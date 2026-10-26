import { pingModel } from "../ai/bedrock";
import { APP_VERSION, config } from "../config";
import { pingDb } from "../db/repositories/health.repo";
import { chainHealth } from "../integrations/chain";
import type { Health } from "../schemas/health.schema";

type Status = "ok" | "down";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function probe(check: () => Promise<void>, timeoutMs: number): Promise<Status> {
  try {
    await withTimeout(check(), timeoutMs);
    return "ok";
  } catch {
    return "down";
  }
}

// A Bedrock call costs money, so the AI probe result is cached (the UI polls /health often). The in-flight probe is
// cached too, so concurrent polls after expiry share one Bedrock call instead of each starting their own.
let aiCache: { status: Promise<Status>; at: number } | undefined;

function aiStatus(): Promise<Status> {
  const now = Date.now();
  if (!aiCache || now - aiCache.at >= config.AI_HEALTH_TTL_MS) {
    aiCache = { status: probe(pingModel, config.AI_TIMEOUT_MS), at: now };
  }
  return aiCache.status;
}

export async function getHealth(): Promise<Health> {
  const [db, chain, ai] = await Promise.all([
    probe(pingDb, config.HEALTH_CHECK_TIMEOUT_MS),
    probe(chainHealth, config.HEALTH_CHECK_TIMEOUT_MS),
    aiStatus(),
  ]);
  const status = db === "ok" && chain === "ok" && ai === "ok" ? "ok" : "degraded";
  return { status, db, chain, ai, version: APP_VERSION };
}
