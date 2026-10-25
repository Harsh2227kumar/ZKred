import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config";
import { chainHealth, provider } from "../../src/integrations/chain";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chainHealth", () => {
  it("passes when the RPC reports the configured chain id", async () => {
    vi.spyOn(provider, "send").mockResolvedValue(`0x${config.CHAIN_ID.toString(16)}`);
    await expect(chainHealth()).resolves.toBeUndefined();
  });

  it("fails when the RPC is on another chain (getNetwork() alone would not notice)", async () => {
    vi.spyOn(provider, "send").mockResolvedValue(`0x${(config.CHAIN_ID + 1).toString(16)}`);
    await expect(chainHealth()).rejects.toThrow(/chain id/);
  });
});
