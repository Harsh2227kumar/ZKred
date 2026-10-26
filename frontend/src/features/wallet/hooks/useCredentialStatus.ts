// Live status of each wallet credential, from public data only: issuer key epochs (GET /issuers), batch anchors
// (GET /issuers/{id}/batches) and the whole revocation list (GET /status-lists/{id}, herd privacy). Nothing about
// the holder is sent. Mirrors the verifier's rules (CONTRACTS §4.2 / FLOWS §4), so "active" means a verifier accepts it.
import { useQuery } from '@tanstack/react-query';
import { apiClient, unwrap } from '@/api/client';
import type { Batch, Issuer, StatusListOut } from '@/api/schemas';
import type { SignedCredential } from '@/lib/wallet-crypto';
import { isRevokedIn } from '@/lib/zk';

export type CredentialStatus =
  | { kind: 'active'; issuer: Issuer; note?: string }
  | { kind: 'pending_anchor'; issuer: Issuer }
  | { kind: 'revoked'; issuer: Issuer }
  | { kind: 'needs_refresh'; issuer: Issuer; reason: string }
  | { kind: 'replaced'; issuer?: Issuer }
  | { kind: 'invalid'; issuer?: Issuer; reason: string };

/** How often statuses are re-read, so a compromise report or a revocation shows up without a reload. */
const STATUS_REFRESH_MS = 30_000;

/** Stable local id of a credential: its random commitment (the Merkle leaf). */
export const credentialKey = (c: SignedCredential): string => c.values?.commitment ?? c.signature;

/** Only these may be offered to a verifier. */
export const isPresentable = (s: CredentialStatus | undefined): boolean => s?.kind === 'active';

/** Newest first by the issuer's (informational) issued_at, so a refreshed copy wins over the one it replaced. */
export const newestFirst = (a: SignedCredential, b: SignedCredential): number =>
  Date.parse(b.values?.issued_at ?? '') - Date.parse(a.values?.issued_at ?? '');

async function loadStatuses(creds: SignedCredential[], replaced: Set<string>): Promise<Record<string, CredentialStatus>> {
  const issuers = (await unwrap(apiClient.GET('/issuers'))).items;
  const issuerOf = (c: SignedCredential) => issuers.find((i) => i.did === c.issuer_did);
  const issuerIds = [...new Set(creds.map((c) => issuerOf(c)?.id).filter((id): id is string => Boolean(id)))];
  const batchLists = await Promise.all(
    issuerIds.map((id) => unwrap(apiClient.GET('/issuers/{issuer_id}/batches', { params: { path: { issuer_id: id } } })).then((r) => r.items)),
  );
  const batches = new Map<string, Batch>(batchLists.flat().map((b) => [b.batch_id, b]));
  const listIds = [...new Set(creds.map((c) => c.values?.status_list_id).filter((id): id is string => Boolean(id)))];
  // One unpublished list must not hide the status of every other credential.
  const lists = new Map<string, StatusListOut | null>(
    await Promise.all(
      listIds.map(async (id) => [id, await unwrap(apiClient.GET('/status-lists/{list_id}', { params: { path: { list_id: id } } })).catch(() => null)] as const),
    ),
  );

  const out: Record<string, CredentialStatus> = {};
  for (const c of creds) {
    const id = credentialKey(c);
    const v = c.values ?? {};
    const issuer = issuerOf(c);
    const key = issuer?.keys.find((k) => k.key_id === c.key_id);
    const batch = batches.get(v.batch_id ?? '');
    const list = lists.get(v.status_list_id ?? '');
    const anchoredAt = batch?.anchored_at ? Date.parse(batch.anchored_at) : null;
    const cutoff = key?.compromised_from ? Date.parse(key.compromised_from) : null;

    if (replaced.has(id)) out[id] = { kind: 'replaced', issuer };
    else if (!issuer || !key) out[id] = { kind: 'invalid', issuer, reason: 'The issuer or its signing key is not registered' };
    else if (!list) out[id] = { kind: 'invalid', issuer, reason: 'Its revocation list is not published' };
    else if (list.hash.toLowerCase() !== list.onchain_hash.toLowerCase()) out[id] = { kind: 'invalid', issuer, reason: 'Its revocation list does not match the chain' };
    else if (isRevokedIn(list.encoded, Number(v.status_index))) out[id] = { kind: 'revoked', issuer };
    // Never anchored: fine while its key is active; once the key is retired or compromised it never will be.
    else if (anchoredAt === null)
      out[id] =
        key.status === 'active'
          ? { kind: 'pending_anchor', issuer }
          : { kind: 'needs_refresh', issuer, reason: 'It was never anchored and its signing key has been retired' };
    else if (key.status === 'compromised' && cutoff !== null && anchoredAt >= cutoff)
      out[id] = { kind: 'needs_refresh', issuer, reason: "It was issued during the signing key's compromise window" };
    else out[id] = { kind: 'active', issuer, note: key.status === 'compromised' ? 'Anchored before the compromise cutoff: still valid' : undefined };
  }
  return out;
}

export function useCredentialStatuses(creds: SignedCredential[], replaced: string[]) {
  return useQuery({
    queryKey: ['wallet-status', creds.map(credentialKey).join(','), [...replaced].sort().join(',')],
    queryFn: () => loadStatuses(creds, new Set(replaced)),
    enabled: creds.length > 0,
    refetchInterval: STATUS_REFRESH_MS,
  });
}
