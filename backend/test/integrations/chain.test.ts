import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config";
import { ChainError, chainHealth, getIssuer, issuerChainIdForDid, provider } from "../../src/integrations/chain";

afterEach(() => {
  vi.restoreAllMocks();
});

const DEPLOYED_CODE = "0x6080";

/** Fakes the RPC: answers eth_chainId with `chainId` and eth_getCode with `codeAt(address)`. */
function fakeRpc(chainId: number, codeAt: (address: string) => string) {
  vi.spyOn(provider, "send").mockImplementation(async (method: string, params: unknown[] | Record<string, unknown>) => {
    if (method === "eth_chainId") return `0x${chainId.toString(16)}`;
    if (method === "eth_getCode") return codeAt(String((params as unknown[])[0]));
    throw new Error(`unexpected RPC method ${method}`);
  });
}

describe("chainHealth", () => {
  it("passes when the RPC reports the configured chain id and every registry has code", async () => {
    fakeRpc(config.CHAIN_ID, () => DEPLOYED_CODE);
    await expect(chainHealth()).resolves.toBeUndefined();
  });

  it("fails when the RPC is on another chain (getNetwork() alone would not notice)", async () => {
    fakeRpc(config.CHAIN_ID + 1, () => DEPLOYED_CODE);
    await expect(chainHealth()).rejects.toThrow(/chain id/);
  });

  it("fails when a registry address has no contract (wrong or stale address in .env)", async () => {
    const missing = config.ANCHOR_REGISTRY_ADDRESS.toLowerCase();
    fakeRpc(config.CHAIN_ID, (address) => (address.toLowerCase() === missing ? "0x" : DEPLOYED_CODE));
    await expect(chainHealth()).rejects.toThrow(/ANCHOR_REGISTRY_ADDRESS/);
  });
});

describe("registry reads fail closed", () => {
  it("an unreachable RPC → ChainError CHAIN_UNAVAILABLE (502), never a default value", async () => {
    vi.spyOn(provider, "send").mockRejectedValue(new Error("connect ECONNREFUSED"));
    const err = await getIssuer(issuerChainIdForDid("did:zkred:any")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChainError);
    expect(err).toMatchObject({ code: "CHAIN_UNAVAILABLE", status: 502 });
  });
});
