// Live status of each wallet credential, from public data only: issuer key epochs (GET /issuers), batch anchors
// (GET /issuers/{id}/batches) and the revocation list (GET /status-lists/{id}). Nothing about the holder is sent.
import { useQuery } from '@tanstack/react-query';
import { apiClient, unwrap } from '@/api/client';
import { fetchStatusList } from '@/api/queries/issuance';
import type { Batch, Issuer } from '@/api/schemas';
import type { StoredCredential } from '@/lib/wallet-store';
import { isRevokedIn } from '@/lib/zk';

export type CredentialStatus =
  | { kind: 'active'; issuer?: Issuer }
  | { kind: 'pending_anchor'; issuer?: Issuer }
  | { kind: 'revoked'; issuer?: Issuer }
  | { kind: 'needs_refresh'; issuer?: Issuer }
  | { kind: 'invalid'; issuer?: Issuer; reason: string };

async function loadStatuses(creds: StoredCredential[]): Promise<Record<string, CredentialStatus>> {
  const issuers = (await unwrap(apiClient.GET('/issuers'))).items;
  const issuerIds = [...new Set(creds.map((c) => c.issuer_id))];
  const batchLists = await Promise.all(
    issuerIds.map((id) => unwrap(apiClient.GET('/issuers/{issuer_id}/batches', { params: { path: { issuer_id: id } } })).then((r) => r.items)),
  );
  const batches = new Map<string, Batch>(batchLists.flat().map((b) => [b.batch_id, b]));
  const listIds = [...new Set(creds.map((c) => c.credential.values.status_list_id).filter(Boolean))] as string[];
  const lists = new Map(await Promise.all(listIds.map(async (id) => [id, await fetchStatusList(id)] as const)));

  const out: Record<string, CredentialStatus> = {};
  for (const c of creds) {
    const v = c.credential.values;
    const issuer = issuers.find((i) => i.did === c.credential.issuer_did);
    const key = issuer?.keys.find((k) => k.key_id === c.credential.key_id);
    const batch = batches.get(v.batch_id ?? '');
    const list = lists.get(v.status_list_id ?? '');
    if (!issuer || !key) out[c.offer_id] = { kind: 'invalid', issuer, reason: 'Issuer or signing key is no longer registered' };
    else if (list && list.hash.toLowerCase() !== list.onchain_hash.toLowerCase())
      out[c.offer_id] = { kind: 'invalid', issuer, reason: 'Revocation list does not match the chain' };
    else if (list && isRevokedIn(list.encoded, Number(v.status_index))) out[c.offer_id] = { kind: 'revoked', issuer };
    // Never anchored: fine while its key is active; once the key is retired or compromised it never will be.
    else if (!batch?.anchored_at) out[c.offer_id] = { kind: key.status === 'active' ? 'pending_anchor' : 'needs_refresh', issuer };
    else if (key.status === 'compromised' && key.compromised_from && new Date(batch.anchored_at) >= new Date(key.compromised_from))
      out[c.offer_id] = { kind: 'needs_refresh', issuer };
    else out[c.offer_id] = { kind: 'active', issuer };
  }
  return out;
}

export function useCredentialStatuses(creds: StoredCredential[]) {
  return useQuery({
    queryKey: ['wallet-status', creds.map((c) => c.offer_id).join(',')],
    queryFn: () => loadStatuses(creds),
    enabled: creds.length > 0,
  });
}
