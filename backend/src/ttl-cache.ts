// Read-through cache for slow, mostly static reads (on-chain issuer records). A value is reused for `ttlMs`; after
// that it is reloaded, and if the reload fails the last good value is served with `stale: true` instead of failing.
// Concurrent misses for one key share a single load. Never use it where a check must fail closed (verification).

export interface Cached<V> {
  value: V;
  /** When the value was loaded. */
  at: Date;
  /** True when a reload just failed and this is the last good value. */
  stale: boolean;
}

export function ttlCache<K, V>(ttlMs: number, load: (key: K) => Promise<V>, now: () => number = Date.now) {
  const entries = new Map<K, { value: V; at: number }>();
  const inflight = new Map<K, Promise<Cached<V>>>();

  async function get(key: K): Promise<Cached<V>> {
    const hit = entries.get(key);
    if (hit && now() - hit.at < ttlMs) return { value: hit.value, at: new Date(hit.at), stale: false };
    const running = inflight.get(key);
    if (running) return running;

    const p = load(key).then(
      (value) => {
        const at = now();
        entries.set(key, { value, at });
        return { value, at: new Date(at), stale: false };
      },
      (err: unknown) => {
        if (hit) return { value: hit.value, at: new Date(hit.at), stale: true };
        throw err;
      },
    );
    inflight.set(key, p);
    try {
      return await p;
    } finally {
      inflight.delete(key);
    }
  }

  return { get, invalidate: (key: K) => entries.delete(key) };
}
