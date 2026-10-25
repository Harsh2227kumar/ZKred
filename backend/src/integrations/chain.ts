// Chain access (ethers v6). V0-H2: provider + health only; registry reads/writes land in V1-H1.
import { JsonRpcProvider } from "ethers";
import { config } from "../config";

export const provider = new JsonRpcProvider(config.CHAIN_RPC_URL, config.CHAIN_ID, { staticNetwork: true });

/** Resolves when the RPC answers and reports the configured chain id. */
export async function chainHealth(): Promise<void> {
  // Ask the node itself: with staticNetwork, provider.getNetwork() just echoes config.CHAIN_ID back.
  const chainId = BigInt(await provider.send("eth_chainId", []));
  if (chainId !== BigInt(config.CHAIN_ID)) {
    throw new Error(`RPC chain id ${chainId} != CHAIN_ID ${config.CHAIN_ID}`);
  }
}
