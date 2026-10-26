// Red-team console (CONTRACTS §3.5, DEMO_MODE only). Simulates a breached issuance pipeline: the attacker copies the
// issuer's BBS signing key (NOT the governance wallet), signs forged degrees, injects their commitments into the
// issuer's open batch and gets that batch anchored. The forgeries live only in attack_forgeries: the registrar's own
// records (issued_credentials) stay honest, which is what lets re-issue tell real holders from forgers.
// verifyForged runs every forgery through the real engine: "full" (4-step chain) or "naive" (signature only).
import { randomBytes, randomUUID } from "node:crypto";
import {
  CREDENTIAL_LAYOUTS,
  deriveDisclosure,
  merkleProof,
  revealFieldsFor,
  signCredential,
  type Presentation,
  type Hex32,
  type PresentationPolicy,
  type SignedCredential,
} from "@zkred/zk-core";
import * as repo from "../db/repositories/attack.repo";
import * as issuanceRepo from "../db/repositories/issuance.repo";
import * as issuersRepo from "../db/repositories/issuers.repo";
import type { AttackRunOut, AttackState, ForgeIn, ForgeOut, StolenKey } from "../schemas/attack.schema";
import { validateClaims } from "./claims";
import { AppError } from "./errors";
import { anchorBatch, createStatusList } from "./issuance";
import { openBbsSecretKey, withIssuerLock } from "./issuers";
import { createSources, verifyPresentation, type VerificationMode, type VerifierSources } from "./verifier";

const FORGED_TYPE = "Degree" as const;
/** "No size limit" for the batch lookup: the attacker stuffs the open batch whatever its size. */
const PG_INT_MAX = 2 ** 31 - 1;
const randomHex32 = (): Hex32 => `0x${randomBytes(32).toString("hex")}`;

/** What a careful degree verifier asks for: accredited issuer, not revoked, the non-PII degree claims. */
function degreeCheckPolicy(): PresentationPolicy {
  const fields = CREDENTIAL_LAYOUTS[FORGED_TYPE].fields;
  return {
    purpose: "Attack console: check forged degrees",
    never_collect: fields.filter((f) => f.pii).map((f) => f.name),
    requirements: [
      {
        id: "degree",
        credential_type: FORGED_TYPE,
        accredited_only: true,
        issuer_kinds: null,
        issuer_dids: null,
        reveal: fields.filter((f) => f.source === "claim" && !f.pii).map((f) => f.name),
        equals: [],
        predicates: [],
        require_not_revoked: true,
      },
    ],
  };
}

const toStolen = (r: repo.StolenKeyRow): StolenKey => ({ issuer_id: r.issuerId, key_id: r.keyId as Hex32, stolen_at: r.stolenAt.toISOString() });

const toRun = (r: repo.RunRow): AttackRunOut => ({
  mode: r.mode as AttackRunOut["mode"],
  total: r.total,
  accepted: r.accepted,
  rejected: r.rejected,
  by_code: r.byCode as Record<string, number>,
  ran_at: r.ranAt.toISOString(),
});

export async function stealKey(issuerId: string): Promise<StolenKey> {
  const key = await issuersRepo.findActiveKeyWithSecret(issuerId);
  if (!key) {
    if (!(await issuersRepo.findIssuer(issuerId))) throw new AppError("NOT_FOUND", "Issuer not found");
    throw new AppError("CONFLICT", "Issuer has no active key to steal");
  }
  // The sealed secret is bound to its key id, so the copy opens with the same KEY_ENCRYPTION_SECRET.
  return toStolen(await repo.insertStolenKey({ issuerId, keyId: key.keyId, secretKeyEnc: key.secretKeyEnc }));
}

export async function forge(input: ForgeIn): Promise<ForgeOut> {
  const claims = validateClaims(FORGED_TYPE, input.claims);
  const stolen = await repo.latestStolenKey(input.issuer_id);
  if (!stolen) {
    if (!(await issuersRepo.findIssuer(input.issuer_id))) throw new AppError("NOT_FOUND", "Issuer not found");
    throw new AppError("CONFLICT", "Steal this issuer's key first");
  }
  const forgedSetId = randomUUID();

  const batchId = await withIssuerLock(input.issuer_id, async () => {
    const issuer = await issuersRepo.findIssuerWithSecrets(input.issuer_id);
    const key = await issuersRepo.findKey(stolen.keyId);
    if (!issuer || !key) throw new AppError("NOT_FOUND", "Issuer or stolen key not found");
    const batch =
      (await issuanceRepo.findOpenBatch(issuer.id, stolen.keyId, PG_INT_MAX)) ??
      (await issuanceRepo.insertBatch({ batchId: randomHex32(), issuerId: issuer.id, keyId: stolen.keyId }));
    const list = (await issuanceRepo.findStatusListWithRoom(issuer.id)) ?? (await createStatusList(issuer));

    const secretKey = openBbsSecretKey(stolen.keyId, stolen.secretKeyEnc);
    const publicKey = new Uint8Array(Buffer.from(key.publicKey, "base64url"));
    const forged: SignedCredential[] = [];
    for (let n = 0; n < input.count; n++) {
      forged.push(
        await signCredential({
          secretKey,
          publicKey,
          type: FORGED_TYPE,
          values: {
            cred_type: FORGED_TYPE,
            issuer_did: issuer.did,
            key_id: stolen.keyId,
            batch_id: batch.batchId,
            status_list_id: list.listId,
            // Unused slots read as "not revoked": the attacker picks any of them.
            status_index: String(list.nextIndex + Math.floor(Math.random() * (list.size - list.nextIndex))),
            commitment: randomHex32(),
            issued_at: new Date().toISOString(),
            holder_binding: "",
            ...claims,
          },
        }),
      );
    }
    if (!(await issuanceRepo.appendLeaves(batch.batchId, forged.map((c) => c.values.commitment!)))) {
      throw new AppError("CONFLICT", "The batch was anchored meanwhile; forge again");
    }
    await repo.insertForgeries(forged.map((credential) => ({ forgedSetId, issuerId: issuer.id, credential })));
    return batch.batchId as Hex32;
  });

  // The breached pipeline then anchors as usual. The chain refuses once the stolen key is no longer active.
  let anchorTxHash: string | null = null;
  try {
    anchorTxHash = (await anchorBatch(input.issuer_id, batchId)).tx_hash;
  } catch (err) {
    if (!(err instanceof AppError) || !["CONFLICT", "CHAIN_TX_FAILED"].includes(err.code)) throw err;
  }
  return { forged_set_id: forgedSetId, forged_count: input.count, batch_id: batchId, anchor_tx_hash: anchorTxHash };
}

/** What one verify-forged run shares across forgeries: the policy, the mode and memoised engine reads. */
interface RunCtx {
  policy: PresentationPolicy;
  mode: VerificationMode;
  sources: VerifierSources;
}

/**
 * "OK" or the code of the first failing step for one forgery, from the real engine. The presentation is what a holder's
 * wallet would send (buildPresentation minus its own signature pre-check, which the engine repeats anyway): a
 * nonce-bound disclosure plus the commitment's Merkle path. Unexpected errors propagate: a run never counts a
 * forgery as rejected because something broke.
 */
async function forgeryVerdict(run: RunCtx, cred: SignedCredential, publicKey: Uint8Array | null, batchLeaves: Hex32[]): Promise<string> {
  // No published key: no proof can be derived, and the engine's first step fails the same way.
  if (!publicKey) return "KEY_UNKNOWN";
  const requirement = run.policy.requirements[0]!;
  const nonce = randomBytes(32);
  const { disclosed, bbsProof } = await deriveDisclosure(cred, publicKey, revealFieldsFor(requirement), nonce);
  const commitment = (cred.values.commitment ?? "").toLowerCase() as Hex32;
  // Not in any batch we hold: an empty path, and the engine says why (never anchored / not in the anchored root).
  const inBatch = batchLeaves.some((l) => l.toLowerCase() === commitment);
  const presentation: Presentation = {
    request_id: randomUUID(),
    nonce: nonce.toString("base64url"),
    items: [
      {
        requirement_id: requirement.id,
        credential_type: cred.type,
        issuer_did: cred.issuer_did,
        key_id: cred.key_id,
        disclosed,
        bbs_proof: Buffer.from(bbsProof).toString("base64url"),
        merkle_proof: inBatch ? merkleProof(batchLeaves, commitment) : [],
        age_proof: null,
      },
    ],
  };
  const outcome = await verifyPresentation({ nonce: presentation.nonce, policy: run.policy }, presentation, run.mode, run.sources);
  return outcome.result === "accepted" ? "OK" : (outcome.steps.find((s) => !s.ok)?.code ?? "REJECTED");
}

export async function verifyForged(mode: VerificationMode): Promise<AttackRunOut> {
  const forgeries = await repo.listForgeries();
  const run: RunCtx = { policy: degreeCheckPolicy(), mode, sources: createSources() };
  const keys = new Map<string, Uint8Array | null>();
  const leaves = new Map<string, Hex32[]>();
  const byCode: Record<string, number> = {};
  let accepted = 0;

  for (const row of forgeries) {
    const cred = row.credential as SignedCredential;
    const batchId = cred.values.batch_id ?? "";
    if (!keys.has(cred.key_id)) {
      const key = await run.sources.key(cred.key_id);
      keys.set(cred.key_id, key ? new Uint8Array(Buffer.from(key.publicKey, "base64url")) : null);
    }
    if (!leaves.has(batchId)) leaves.set(batchId, ((await issuanceRepo.findBatch(batchId))?.leaves ?? []) as Hex32[]);

    const code = await forgeryVerdict(run, cred, keys.get(cred.key_id) ?? null, leaves.get(batchId) ?? []);
    if (code === "OK") accepted++;
    else byCode[code] = (byCode[code] ?? 0) + 1;
  }

  return toRun(
    await repo.insertRun({ mode, total: forgeries.length, accepted, rejected: forgeries.length - accepted, byCode, ranAt: new Date() }),
  );
}

export async function attackState(): Promise<AttackState> {
  const [stolen, forgedCount, runs] = await Promise.all([repo.listStolenKeys(), repo.countForgeries(), repo.listRuns()]);
  return { stolen_keys: stolen.map(toStolen), forged_count: forgedCount, runs: runs.map(toRun) };
}

export async function resetAttack(): Promise<{ ok: true }> {
  await repo.resetAttack();
  return { ok: true };
}
