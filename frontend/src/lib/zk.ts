// frontend/src/lib/zk.ts
// The only frontend module that imports @zkred/zk-core (AGENTS.md §8.3). Features call these wrappers, never raw
// crypto. The Groth16 artifacts are fetched once from VITE_ZK_ARTIFACTS_BASE_URL.

import {
  BACKUP_KDF_ITERATIONS,
  CREDENTIAL_LAYOUTS,
  ZkCoreError,
  buildPresentation,
  dateToDays,
  matchCredentials,
  revealFieldsFor,
  statusList,
  verifyCredential,
  walletCrypto,
  type CredentialType,
  type Hex32,
  type IssuerInfo,
  type Presentation,
  type PresentationPolicy,
  type PresentationRequirement,
  type SignedCredential,
  type ZkArtifacts,
} from '@zkred/zk-core';
import { config } from '@/config';

export { BACKUP_KDF_ITERATIONS, CREDENTIAL_LAYOUTS, ZkCoreError, matchCredentials, revealFieldsFor, walletCrypto };
export type { CredentialType, Hex32, IssuerInfo, Presentation, PresentationPolicy, PresentationRequirement, SignedCredential };

/** Today as whole days since 1900-01-01 UTC (the age circuit's date unit). */
export const todayDays = (): number => dateToDays(new Date().toISOString().slice(0, 10));

let artifacts: Promise<ZkArtifacts> | undefined;

/** age_gte.wasm + age_gte.zkey, downloaded once per page load. */
function loadArtifacts(): Promise<ZkArtifacts> {
  const base = config.zkArtifactsBaseUrl.replace(/\/$/, '');
  const fetchBytes = async (file: string) => {
    const res = await fetch(`${base}/${file}`);
    if (!res.ok) throw new Error(`Could not download ${file} (HTTP ${res.status})`);
    return res.arrayBuffer();
  };
  artifacts ??= Promise.all([fetchBytes('age_gte.wasm'), fetchBytes('age_gte.zkey')]).then(
    ([wasm, zkey]) => ({ wasm, zkey }),
    (err: unknown) => {
      artifacts = undefined;
      throw err;
    },
  );
  return artifacts;
}

const keyBytes = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Checks a credential's BBS signature against an issuer public key (base64url, as in GET /issuers). */
export function credentialSignatureValid(cred: SignedCredential, publicKeyB64url: string): Promise<boolean> {
  return verifyCredential(cred, keyBytes(publicKeyB64url));
}

/** Builds the presentation in the browser. Age proofs need the circuit artifacts; they are fetched only then. */
export async function createPresentation(i: {
  request: { id: string; nonce: string; policy: PresentationPolicy };
  credentials: SignedCredential[];
  issuerKeys: { key_id: string; public_key: string }[];
  batchLeaves: Record<string, string[]>;
  issuers: Record<string, IssuerInfo>;
}): Promise<Presentation> {
  const needsAge = i.request.policy.requirements.some((r) => r.predicates.length > 0);
  return buildPresentation({
    request: i.request,
    credentials: i.credentials,
    issuerPublicKeys: Object.fromEntries(i.issuerKeys.map((k) => [k.key_id, keyBytes(k.public_key)])) as Record<Hex32, Uint8Array>,
    batchLeaves: i.batchLeaves as Record<Hex32, Hex32[]>,
    todayDays: todayDays(),
    artifacts: needsAge ? await loadArtifacts() : { wasm: new ArrayBuffer(0), zkey: new ArrayBuffer(0) },
    issuers: i.issuers,
  });
}

/** True if bit `index` of a status list (GET /status-lists/{id}.encoded) is set, i.e. the credential is revoked. */
export function isRevokedIn(encodedList: string, index: number): boolean {
  return statusList.getBit(statusList.decode(encodedList), index);
}

/** Field label from the frozen layouts (falls back to the field name). */
export function fieldLabel(type: CredentialType, name: string): string {
  return CREDENTIAL_LAYOUTS[type].fields.find((f) => f.name === name)?.label ?? name;
}

/** Claim fields worth showing on a credential card, PII flagged so the UI can hide them by default. */
export function displayFields(cred: SignedCredential): { name: string; label: string; value: string; pii: boolean }[] {
  return CREDENTIAL_LAYOUTS[cred.type].fields
    .filter((f) => f.source === 'claim')
    .map((f) => ({ name: f.name, label: f.label, value: cred.values[f.name] ?? '', pii: f.pii }));
}
