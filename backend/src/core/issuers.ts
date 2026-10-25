// Issuers and their BBS signing keys (CONTRACTS §3.2). The chain is the source of truth for accreditation and key
// epochs; the DB mirrors it and holds the encrypted secrets.
import { generateIssuerKeyPair, pubKeyHash, type Hex32 } from "@zkred/zk-core";
import * as repo from "../db/repositories/issuers.repo";
import { isUniqueViolation } from "../db/errors";
import * as chain from "../integrations/chain";
import { withLock } from "../keyed-lock";
import { logger } from "../logger";
import type { Issuer, IssuerCreate, IssuerKey } from "../schemas/issuers.schema";
import { AppError } from "./errors";
import { openSecret, sealSecret } from "./secrets-at-rest";

const DID_PREFIX = "did:zkred:";

/** Serialises every write that reads then changes an issuer's key/batch state (rotate, issue, anchor). */
export const withIssuerLock = <T>(issuerId: string, fn: () => Promise<T>): Promise<T> => withLock(`issuer:${issuerId}`, fn);

export const sealGovernanceKey = (did: string, privateKey: string): string =>
  sealSecret("governance_key", did, Buffer.from(privateKey, "utf8"));
export const openGovernanceKey = (did: string, sealed: string): string =>
  Buffer.from(openSecret("governance_key", did, sealed)).toString("utf8");

export const sealBbsSecretKey = (keyId: string, secretKey: Uint8Array): string => sealSecret("bbs_secret_key", keyId, secretKey);
export const openBbsSecretKey = (keyId: string, sealed: string): Uint8Array => openSecret("bbs_secret_key", keyId, sealed);

export interface SigningKey {
  keyId: Hex32;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  pubKeyHash: Hex32;
}

export async function newSigningKey(): Promise<SigningKey> {
  const { keyId, publicKey, secretKey } = await generateIssuerKeyPair();
  return { keyId, publicKey, secretKey, pubKeyHash: pubKeyHash(publicKey) };
}

/** The DB row for a key whose on-chain registration was mined in `tx` (active_from = that block's time). */
export function keyRow(key: SigningKey, tx: chain.TxResult): repo.NewIssuerKeyRow {
  return {
    keyId: key.keyId,
    publicKey: Buffer.from(key.publicKey).toString("base64url"),
    secretKeyEnc: sealBbsSecretKey(key.keyId, key.secretKey),
    status: "active",
    activeFrom: tx.blockTime,
    txHash: tx.txHash,
  };
}

export function toIssuerKey(k: repo.IssuerKeyRecord): IssuerKey {
  return {
    key_id: k.keyId as Hex32,
    public_key: k.publicKey,
    status: k.status,
    active_from: k.activeFrom.toISOString(),
    compromised_from: k.compromisedFrom?.toISOString() ?? null,
    tx_hash: k.txHash,
  };
}

async function toIssuer(r: repo.IssuerRecord): Promise<Issuer> {
  // An issuer missing on-chain (e.g. the registry was redeployed) is reported as not accredited.
  const onchain = await chain.getIssuer(r.issuerChainId as Hex32);
  return {
    id: r.id,
    did: r.did,
    name: r.name,
    kind: r.kind,
    issuer_chain_id: r.issuerChainId as Hex32,
    governance_address: r.governanceAddress,
    accredited: onchain?.accredited ?? false,
    keys: r.keys.map(toIssuerKey),
    created_at: r.createdAt.toISOString(),
  };
}

export async function listIssuers(): Promise<{ items: Issuer[] }> {
  const records = await repo.listIssuers();
  return { items: await Promise.all(records.map(toIssuer)) };
}

export async function getIssuer(issuerId: string): Promise<Issuer> {
  const record = await repo.findIssuer(issuerId);
  if (!record) throw new AppError("NOT_FOUND", "Issuer not found");
  return toIssuer(record);
}

/**
 * Registers a new issuer: BBS key pair + a fresh governance wallet, then on-chain registerIssuer (accreditor),
 * gas funding, addKey (governance). The DB row is written only after the chain accepted all three.
 */
export async function createIssuer(input: IssuerCreate): Promise<Issuer> {
  const did = `${DID_PREFIX}${input.did_suffix}`;
  return withLock(`issuer-did:${did}`, async () => {
    const conflict = () => new AppError("CONFLICT", `Issuer ${did} already exists`, { did_suffix: "already taken" });
    if (await repo.didExists(did)) throw conflict();
    const issuerChainId = chain.issuerChainIdForDid(did);
    if (await chain.getIssuer(issuerChainId)) throw conflict();

    const governance = chain.createGovernanceAccount();
    const key = await newSigningKey();
    await chain.registerIssuer(issuerChainId, did, governance.address);
    await chain.fundGovernance(governance.address);
    const added = await chain.addKey(governance.privateKey, issuerChainId, key.keyId, key.pubKeyHash);

    let id: string;
    try {
      id = await repo.insertIssuerWithKey(
        {
          did,
          name: input.name,
          kind: input.kind,
          issuerChainId,
          governanceAddress: governance.address,
          governanceKeyEnc: sealGovernanceKey(did, governance.privateKey),
        },
        keyRow(key, added),
      );
    } catch (err) {
      // The chain already holds this issuer; without the DB row its governance key is lost. Make that loud.
      logger.error({ err, did, issuer_chain_id: issuerChainId }, "issuer registered on-chain but DB insert failed");
      if (isUniqueViolation(err)) throw conflict();
      throw err;
    }
    return getIssuer(id);
  });
}

/** Retires the active key on-chain and in the DB; the new key signs every credential from now on. */
export async function rotateIssuerKey(issuerId: string): Promise<IssuerKey> {
  return withIssuerLock(issuerId, async () => {
    const issuer = await repo.findIssuerWithSecrets(issuerId);
    if (!issuer) throw new AppError("NOT_FOUND", "Issuer not found");
    const current = await repo.findActiveKeyWithSecret(issuerId);
    if (!current) throw new AppError("CONFLICT", "Issuer has no active key to rotate");

    const key = await newSigningKey();
    const tx = await chain.rotateKey(
      openGovernanceKey(issuer.did, issuer.governanceKeyEnc),
      issuer.issuerChainId as Hex32,
      current.keyId as Hex32,
      key.keyId,
      key.pubKeyHash,
    );
    const row = keyRow(key, tx);
    await repo.recordKeyRotation(issuerId, current.keyId, row);
    return {
      key_id: key.keyId,
      public_key: row.publicKey,
      status: "active",
      active_from: tx.blockTime.toISOString(),
      compromised_from: null,
      tx_hash: tx.txHash,
    };
  });
}
