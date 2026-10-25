// In-process mutex keyed by string. Serialises work that must not interleave inside this API process
// (txs from one EVM signer, read-modify-write on one issuer). The backend runs as a single process (one EC2 container).

const tails = new Map<string, Promise<unknown>>();

/** Runs `fn` after every earlier call with the same `key` has settled. A failure never blocks later callers. */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(fn);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
