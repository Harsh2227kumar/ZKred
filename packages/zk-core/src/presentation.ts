// Holder side of a presentation (CONTRACTS §4.1 buildPresentation). For each policy requirement: pick a matching
// credential, derive a BBS selective disclosure bound to the request nonce, prove its commitment is in its anchored
// batch (Merkle), and, for age predicates, prove age ≥ N on the signed dob_commitment with the Groth16 circuit.
import { ageCutoffDays, dateToDays, proveAgeGte } from "./age";
import { deriveDisclosure, verifyCredential } from "./bbs";
import { base64urlToBytes, bytesToBase64url } from "./encoding";
import { ZkCoreError } from "./errors";
import { CREDENTIAL_LAYOUTS } from "./layouts";
import { merkleProof } from "./merkle";
import type { IssuerKind, Presentation, PresentationItem, PresentationPolicy, PresentationRequirement } from "./policy";
import type { Hex32, SignedCredential, ZkArtifacts } from "./types";

/** What the wallet knows about an issuer (from GET /issuers); lets matching honour accredited_only / issuer_kinds. */
export interface IssuerInfo {
  kind: IssuerKind;
  accredited: boolean;
}

/** Largest age_gte in the requirement, or null when it has no age predicate. */
function minAgeYears(r: PresentationRequirement): number | null {
  const years = r.predicates.filter((p) => p.type === "age_gte").map((p) => p.years);
  return years.length ? Math.max(...years) : null;
}

/** Fields the holder discloses for `r`: the policy's reveal list plus dob_commitment when an age proof is needed. */
export function revealFieldsFor(r: PresentationRequirement): string[] {
  const fields = new Set(r.reveal);
  if (minAgeYears(r) !== null) fields.add("dob_commitment");
  return [...fields];
}

function meetsAge(c: SignedCredential, years: number, todayDays: number): boolean {
  try {
    return dateToDays(c.values.dob ?? "") <= ageCutoffDays(todayDays, years);
  } catch {
    return false;
  }
}

/**
 * Credentials that can answer `r`, judged on their own values: type, issuer allow-list, equals constraints and the
 * age predicate. With `issuers` (keyed by DID) it also applies accredited_only and issuer_kinds; an issuer missing
 * from that map never matches. Signatures are not checked here (buildPresentation does that).
 */
export function matchCredentials(
  r: PresentationRequirement,
  credentials: SignedCredential[],
  opts: { todayDays: number; issuers?: Record<string, IssuerInfo> },
): SignedCredential[] {
  const years = minAgeYears(r);
  return credentials.filter((c) => {
    if (c.type !== r.credential_type) return false;
    if (r.issuer_dids && !r.issuer_dids.includes(c.issuer_did)) return false;
    if (opts.issuers) {
      const info = opts.issuers[c.issuer_did];
      if (!info) return false;
      if (r.accredited_only && !info.accredited) return false;
      if (r.issuer_kinds && !r.issuer_kinds.includes(info.kind)) return false;
    }
    if (!r.equals.every((e) => c.values[e.field] === e.value)) return false;
    return years === null || meetsAge(c, years, opts.todayDays);
  });
}

async function buildItem(
  r: PresentationRequirement,
  c: SignedCredential,
  publicKey: Uint8Array,
  leaves: Hex32[],
  nonce: Uint8Array,
  todayDays: number,
  artifacts: ZkArtifacts,
): Promise<PresentationItem> {
  const { disclosed, bbsProof } = await deriveDisclosure(c, publicKey, revealFieldsFor(r), nonce);
  const merkle = merkleProof(leaves, c.values.commitment as Hex32);

  let ageProof: PresentationItem["age_proof"] = null;
  const years = minAgeYears(r);
  if (years !== null) {
    const { proof, publicSignals } = await proveAgeGte({
      dobDays: BigInt(dateToDays(c.values.dob ?? "")),
      salt: BigInt(c.values.dob_salt ?? ""),
      todayDays,
      minAgeYears: years,
      artifacts,
    });
    ageProof = { proof: proof as Record<string, unknown>, public_signals: publicSignals };
  }

  return {
    requirement_id: r.id,
    credential_type: c.type,
    issuer_did: c.issuer_did,
    key_id: c.key_id,
    disclosed,
    bbs_proof: bytesToBase64url(bbsProof),
    merkle_proof: merkle,
    age_proof: ageProof,
  };
}

/**
 * Builds the whole presentation for a request. A credential is used only if its signature verifies under the
 * provided issuer key and its batch leaves (from GET /batches/{id}/leaves) contain its commitment.
 * Throws ZkCoreError("MISSING_CREDENTIAL") naming the first requirement nothing can answer.
 */
export async function buildPresentation(i: {
  request: { id: string; nonce: string; policy: PresentationPolicy };
  credentials: SignedCredential[];
  issuerPublicKeys: Record<Hex32, Uint8Array>;
  batchLeaves: Record<Hex32, Hex32[]>;
  todayDays: number;
  artifacts: ZkArtifacts;
  issuers?: Record<string, IssuerInfo>;
}): Promise<Presentation> {
  let nonceBytes: Uint8Array;
  try {
    nonceBytes = base64urlToBytes(i.request.nonce);
  } catch {
    throw new ZkCoreError("INVALID_REQUEST", "request nonce is not base64url");
  }
  if (nonceBytes.length === 0) throw new ZkCoreError("INVALID_REQUEST", "request nonce is empty");

  const items: PresentationItem[] = [];
  for (const r of i.request.policy.requirements) {
    const candidates = matchCredentials(r, i.credentials, { todayDays: i.todayDays, issuers: i.issuers });
    let chosen: { c: SignedCredential; key: Uint8Array; leaves: Hex32[] } | null = null;
    for (const c of candidates) {
      const key = i.issuerPublicKeys[c.key_id];
      const leaves = i.batchLeaves[c.values.batch_id as Hex32];
      if (!key || !leaves?.some((l) => l.toLowerCase() === c.values.commitment?.toLowerCase())) continue;
      if (!(await verifyCredential(c, key))) continue;
      chosen = { c, key, leaves };
      break;
    }
    if (!chosen) {
      const label = CREDENTIAL_LAYOUTS[r.credential_type].type;
      throw new ZkCoreError("MISSING_CREDENTIAL", `no usable ${label} credential for requirement ${r.id}`);
    }
    items.push(await buildItem(r, chosen.c, chosen.key, chosen.leaves, nonceBytes, i.todayDays, i.artifacts));
  }
  return { request_id: i.request.id, nonce: i.request.nonce, items };
}
