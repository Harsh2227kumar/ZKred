// Chain access (ethers v6): registry reads and writes (CONTRACTS §4.2, §4.3).
// Every failure is a ChainError: CHAIN_UNAVAILABLE (RPC down, timeout) or CHAIN_TX_FAILED (reverted; details.tx_hash).
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isError,
  keccak256,
  toUtf8Bytes,
  type ContractTransactionResponse,
  type TransactionResponse,
} from "ethers";
import type { Hex32 } from "@zkred/zk-core";
import { config } from "../config";
import { AppError } from "../core/errors";
import { withLock } from "../keyed-lock";
import anchorRegistryAbi from "./abi/AnchorRegistry.json" with { type: "json" };
import issuerRegistryAbi from "./abi/IssuerRegistry.json" with { type: "json" };
import statusRegistryAbi from "./abi/StatusRegistry.json" with { type: "json" };

// cacheTimeout -1: ethers otherwise reuses identical RPC answers for 250 ms, so a nonce or a just-written value could be stale.
export const provider = new JsonRpcProvider(config.CHAIN_RPC_URL, config.CHAIN_ID, {
  staticNetwork: true,
  cacheTimeout: -1,
  pollingInterval: config.CHAIN_POLL_INTERVAL_MS,
});

const accreditor = new Wallet(config.ACCREDITOR_PRIVATE_KEY, provider);
const issuerRegistry = new Contract(config.ISSUER_REGISTRY_ADDRESS, issuerRegistryAbi, provider);
const anchorRegistry = new Contract(config.ANCHOR_REGISTRY_ADDRESS, anchorRegistryAbi, provider);
const statusRegistry = new Contract(config.STATUS_REGISTRY_ADDRESS, statusRegistryAbi, provider);

const REGISTRIES = {
  ISSUER_REGISTRY_ADDRESS: config.ISSUER_REGISTRY_ADDRESS,
  ANCHOR_REGISTRY_ADDRESS: config.ANCHOR_REGISTRY_ADDRESS,
  STATUS_REGISTRY_ADDRESS: config.STATUS_REGISTRY_ADDRESS,
} as const;

export class ChainError extends AppError {
  constructor(code: "CHAIN_UNAVAILABLE" | "CHAIN_TX_FAILED", message: string, txHash?: string) {
    super(code, message, txHash ? { tx_hash: txHash } : undefined);
    this.name = "ChainError";
  }
}

/** Mirrors IssuerRegistry.KeyStatus. */
export const ONCHAIN_KEY_STATUS = ["none", "active", "rotated", "compromised"] as const;
export type OnchainKeyStatus = (typeof ONCHAIN_KEY_STATUS)[number];

export interface TxResult {
  txHash: string;
  blockNumber: number;
  /** Block timestamp: the chain's own clock ("chain time, not claimed time"). */
  blockTime: Date;
}

function toChainError(err: unknown, action: string, txHash?: string): ChainError {
  if (err instanceof ChainError) return err;
  if (isError(err, "CALL_EXCEPTION")) {
    const reason = err.revert?.name ?? err.reason ?? err.shortMessage;
    return new ChainError("CHAIN_TX_FAILED", `${action} reverted: ${reason}`, txHash ?? err.receipt?.hash);
  }
  if (isError(err, "INSUFFICIENT_FUNDS")) {
    return new ChainError("CHAIN_TX_FAILED", `${action}: sender has insufficient funds for gas`, txHash);
  }
  return new ChainError("CHAIN_UNAVAILABLE", `${action}: chain RPC unavailable`, txHash);
}

/**
 * Sends one tx from `signer` and waits for it to be mined. Txs from one signer are serialised so each picks up
 * the right pending nonce (no nonce gaps when a tx fails before broadcast).
 */
function transact(
  signer: Wallet,
  action: string,
  send: () => Promise<ContractTransactionResponse | TransactionResponse>,
): Promise<TxResult> {
  return withLock(`signer:${signer.address}`, async () => {
    let txHash: string | undefined;
    try {
      const tx = await send();
      txHash = tx.hash;
      const receipt = await tx.wait(1, config.CHAIN_TX_TIMEOUT_MS);
      if (!receipt || receipt.status !== 1) throw new ChainError("CHAIN_TX_FAILED", `${action} reverted`, txHash);
      const block = await provider.getBlock(receipt.blockNumber);
      if (!block) throw new ChainError("CHAIN_UNAVAILABLE", `${action}: block ${receipt.blockNumber} not found`, txHash);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockTime: new Date(block.timestamp * 1000) };
    } catch (err) {
      throw toChainError(err, action, txHash);
    }
  });
}

/** Runs a view call; a revert with one of `notFoundErrors` (e.g. UnknownIssuer) resolves to null. */
async function read<T>(action: string, call: () => Promise<T>, notFoundErrors: readonly string[]): Promise<T | null> {
  try {
    return await call();
  } catch (err) {
    if (isError(err, "CALL_EXCEPTION") && err.revert && notFoundErrors.includes(err.revert.name)) return null;
    throw new ChainError("CHAIN_UNAVAILABLE", `${action}: chain read failed`);
  }
}

const governanceSigner = (privateKey: string) => new Wallet(privateKey, provider);

// ---------------------------------------------------------------- identifiers

/** issuer_chain_id = keccak256(did) (CONTRACTS §3.6). */
export const issuerChainIdForDid = (did: string): Hex32 => keccak256(toUtf8Bytes(did)) as Hex32;

/** A fresh EVM account for one issuer's governance. Its key is encrypted at rest by the caller. */
export function createGovernanceAccount(): { address: string; privateKey: string } {
  const w = Wallet.createRandom();
  return { address: w.address, privateKey: w.privateKey };
}

// ---------------------------------------------------------------- accreditor writes

export function registerIssuer(issuerChainId: Hex32, did: string, governance: string): Promise<TxResult> {
  return transact(accreditor, "IssuerRegistry.registerIssuer", () =>
    (issuerRegistry.connect(accreditor) as Contract).getFunction("registerIssuer")(issuerChainId, did, governance),
  );
}

/** Sends ISSUER_GAS_FUNDING_WEI from the accreditor so a new governance wallet can pay for its own txs. */
export function fundGovernance(address: string): Promise<TxResult> {
  return transact(accreditor, "fund governance wallet", () =>
    accreditor.sendTransaction({ to: address, value: BigInt(config.ISSUER_GAS_FUNDING_WEI) }),
  );
}

// ---------------------------------------------------------------- issuer-governance writes

export function addKey(governanceKey: string, issuerChainId: Hex32, keyId: Hex32, pubKeyHash: Hex32): Promise<TxResult> {
  const signer = governanceSigner(governanceKey);
  return transact(signer, "IssuerRegistry.addKey", () =>
    (issuerRegistry.connect(signer) as Contract).getFunction("addKey")(issuerChainId, keyId, pubKeyHash),
  );
}

export function rotateKey(
  governanceKey: string,
  issuerChainId: Hex32,
  oldKeyId: Hex32,
  newKeyId: Hex32,
  newPubKeyHash: Hex32,
): Promise<TxResult> {
  const signer = governanceSigner(governanceKey);
  return transact(signer, "IssuerRegistry.rotateKey", () =>
    (issuerRegistry.connect(signer) as Contract).getFunction("rotateKey")(issuerChainId, oldKeyId, newKeyId, newPubKeyHash),
  );
}

/** Anchors a batch root; the block time becomes the batch's trusted issuance time. Reverts unless `keyId` is active. */
export function anchor(governanceKey: string, batchId: Hex32, issuerChainId: Hex32, keyId: Hex32, root: Hex32): Promise<TxResult> {
  const signer = governanceSigner(governanceKey);
  return transact(signer, "AnchorRegistry.anchor", () =>
    (anchorRegistry.connect(signer) as Contract).getFunction("anchor")(batchId, issuerChainId, keyId, root),
  );
}

export function setListHash(governanceKey: string, issuerChainId: Hex32, listId: Hex32, listHash: Hex32): Promise<TxResult> {
  const signer = governanceSigner(governanceKey);
  return transact(signer, "StatusRegistry.setListHash", () =>
    (statusRegistry.connect(signer) as Contract).getFunction("setListHash")(issuerChainId, listId, listHash),
  );
}

// ---------------------------------------------------------------- reads

export interface OnchainIssuer {
  did: string;
  governance: string;
  accredited: boolean;
}

export async function getIssuer(issuerChainId: Hex32): Promise<OnchainIssuer | null> {
  const r = await read("IssuerRegistry.getIssuer", () => issuerRegistry.getFunction("getIssuer")(issuerChainId), [
    "UnknownIssuer",
  ]);
  return r ? { did: r[0], governance: r[1], accredited: r[2] } : null;
}

export interface OnchainKey {
  issuerChainId: Hex32;
  pubKeyHash: Hex32;
  activeFrom: Date;
  status: OnchainKeyStatus;
  compromisedFrom: Date | null;
}

export async function getKey(keyId: Hex32): Promise<OnchainKey | null> {
  const r = await read("IssuerRegistry.getKey", () => issuerRegistry.getFunction("getKey")(keyId), ["UnknownKey"]);
  if (!r) return null;
  const compromisedFrom = Number(r[4]);
  return {
    issuerChainId: r[0],
    pubKeyHash: r[1],
    activeFrom: new Date(Number(r[2]) * 1000),
    status: ONCHAIN_KEY_STATUS[Number(r[3])] ?? "none",
    compromisedFrom: compromisedFrom > 0 ? new Date(compromisedFrom * 1000) : null,
  };
}

export interface OnchainAnchor {
  root: Hex32;
  issuerChainId: Hex32;
  keyId: Hex32;
  anchoredAt: Date;
}

export async function getAnchor(batchId: Hex32): Promise<OnchainAnchor | null> {
  const r = await read("AnchorRegistry.getAnchor", () => anchorRegistry.getFunction("getAnchor")(batchId), ["UnknownBatch"]);
  return r ? { root: r[0], issuerChainId: r[1], keyId: r[2], anchoredAt: new Date(Number(r[3]) * 1000) } : null;
}

export interface OnchainListHash {
  issuerChainId: Hex32;
  listHash: Hex32;
  updatedAt: Date;
}

export async function getListHash(listId: Hex32): Promise<OnchainListHash | null> {
  const r = await read("StatusRegistry.getListHash", () => statusRegistry.getFunction("getListHash")(listId), ["UnknownList"]);
  return r ? { issuerChainId: r[0], listHash: r[1], updatedAt: new Date(Number(r[2]) * 1000) } : null;
}

// ---------------------------------------------------------------- health

/** Resolves when the RPC reports the configured chain id and every registry address holds deployed code. */
export async function chainHealth(): Promise<void> {
  // Ask the node itself: with staticNetwork, provider.getNetwork() just echoes config.CHAIN_ID back.
  const chainId = BigInt(await provider.send("eth_chainId", []));
  if (chainId !== BigInt(config.CHAIN_ID)) {
    throw new Error(`RPC chain id ${chainId} != CHAIN_ID ${config.CHAIN_ID}`);
  }
  // A wrong/stale address in .env would otherwise look healthy until the first registry call fails.
  // Raw send, not provider.getCode(): a health probe must always ask the node.
  await Promise.all(
    Object.entries(REGISTRIES).map(async ([name, address]) => {
      if ((await provider.send("eth_getCode", [address, "latest"])) === "0x") {
        throw new Error(`${name} ${address} has no contract code on chain ${config.CHAIN_ID}`);
      }
    }),
  );
}
