import { describe, expect, it } from "vitest";
import { ttlCache } from "../src/ttl-cache";

describe("ttlCache", () => {
  it("reuses a value within the TTL, reloads after it", async () => {
    let t = 0;
    let loads = 0;
    const c = ttlCache(1000, async (k: string) => `${k}:${++loads}`, () => t);
    expect((await c.get("a")).value).toBe("a:1");
    t = 999;
    expect((await c.get("a")).value).toBe("a:1");
    t = 1000;
    expect(await c.get("a")).toMatchObject({ value: "a:2", stale: false });
  });

  it("serves the last good value (stale) when a reload fails, and throws when there is none", async () => {
    let t = 0;
    let fail = false;
    const c = ttlCache(10, async () => {
      if (fail) throw new Error("rpc down");
      return 42;
    }, () => t);
    await c.get("k");
    fail = true;
    t = 50;
    const stale = await c.get("k");
    expect(stale).toMatchObject({ value: 42, stale: true });
    expect(stale.at.getTime()).toBe(0);
    await expect(c.get("other")).rejects.toThrow("rpc down");
  });

  it("shares one load between concurrent misses, and invalidate forces a reload", async () => {
    let loads = 0;
    const c = ttlCache(60_000, async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 10));
      return loads;
    });
    await Promise.all([c.get("k"), c.get("k"), c.get("k")]);
    expect(loads).toBe(1);
    c.invalidate("k");
    await c.get("k");
    expect(loads).toBe(2);
  });
});
