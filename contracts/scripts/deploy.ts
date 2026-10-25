// Deploys IssuerRegistry → AnchorRegistry → StatusRegistry, writes deployments/<network>.json and
// copies the ABIs the backend needs into backend/src/integrations/abi/.
//   pnpm --filter contracts deploy:local          (needs `pnpm --filter contracts node` running)
//   pnpm --filter contracts deploy:base-sepolia   (needs BASE_SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { network } from "hardhat";

const CONTRACTS = ["IssuerRegistry", "AnchorRegistry", "StatusRegistry"] as const;

const { ethers, networkName } = await network.create();
const [deployer] = await ethers.getSigners();
if (!deployer) throw new Error("No deployer account configured for this network");
const chainId = Number((await ethers.provider.getNetwork()).chainId);

console.log(`Deploying to ${networkName} (chain ${chainId}) from ${deployer.address}`);

const issuerRegistry = await ethers.deployContract("IssuerRegistry");
await issuerRegistry.waitForDeployment();
const issuerAddr = await issuerRegistry.getAddress();

const anchorRegistry = await ethers.deployContract("AnchorRegistry", [issuerAddr]);
await anchorRegistry.waitForDeployment();
const statusRegistry = await ethers.deployContract("StatusRegistry", [issuerAddr]);
await statusRegistry.waitForDeployment();

const deployed = { IssuerRegistry: issuerRegistry, AnchorRegistry: anchorRegistry, StatusRegistry: statusRegistry };
const entries: Record<string, { address: string; tx_hash: string | undefined }> = {};
for (const name of CONTRACTS) {
  const c = deployed[name];
  entries[name] = { address: await c.getAddress(), tx_hash: c.deploymentTransaction()?.hash };
}

const record = {
  network: networkName,
  chain_id: chainId,
  accreditor: deployer.address,
  deployed_at: new Date().toISOString(),
  contracts: entries,
};

const root = new URL("../", import.meta.url);
await mkdir(new URL("deployments/", root), { recursive: true });
await writeFile(new URL(`deployments/${networkName}.json`, root), JSON.stringify(record, null, 2) + "\n");

const abiDir = new URL("../backend/src/integrations/abi/", root);
await mkdir(abiDir, { recursive: true });
for (const name of CONTRACTS) {
  const artifact = JSON.parse(await readFile(new URL(`artifacts/src/${name}.sol/${name}.json`, root), "utf8"));
  await writeFile(new URL(`${name}.json`, abiDir), JSON.stringify(artifact.abi, null, 2) + "\n");
}

console.log(JSON.stringify(record, null, 2));
console.log("\nPut these in the backend .env:");
console.log(`CHAIN_ID=${chainId}`);
console.log(`ISSUER_REGISTRY_ADDRESS=${entries.IssuerRegistry?.address}`);
console.log(`ANCHOR_REGISTRY_ADDRESS=${entries.AnchorRegistry?.address}`);
console.log(`STATUS_REGISTRY_ADDRESS=${entries.StatusRegistry?.address}`);
