// Chain access (ethers v6). V0-H2: provider + health only; registry reads/writes land in V1-H1.
import { JsonRpcProvider } from "ethers";
import { config } from "../config";

export const provider = new JsonRpcProvider(config.CHAIN_RPC_URL, config.CHAIN_ID, { staticNetwork: true });

const REGISTRIES = {
  ISSUER_REGISTRY_ADDRESS: config.ISSUER_REGISTRY_ADDRESS,
  ANCHOR_REGISTRY_ADDRESS: config.ANCHOR_REGISTRY_ADDRESS,
  STATUS_REGISTRY_ADDRESS: config.STATUS_REGISTRY_ADDRESS,
} as const;

/** Resolves when the RPC reports the configured chain id and every registry address holds deployed code. */
export async function chainHealth(): Promise<void> {
  // Ask the node itself: with staticNetwork, provider.getNetwork() just echoes config.CHAIN_ID back.
  const chainId = BigInt(await provider.send("eth_chainId", []));
  if (chainId !== BigInt(config.CHAIN_ID)) {
    throw new Error(`RPC chain id ${chainId} != CHAIN_ID ${config.CHAIN_ID}`);
  }
  // A wrong/stale address in .env would otherwise look healthy until the first registry call fails.
  // Raw send, not provider.getCode(): ethers briefly caches identical requests, a health probe must not.
  await Promise.all(
    Object.entries(REGISTRIES).map(async ([name, address]) => {
      if ((await provider.send("eth_getCode", [address, "latest"])) === "0x") {
        throw new Error(`${name} ${address} has no contract code on chain ${config.CHAIN_ID}`);
      }
    }),
  );
}
