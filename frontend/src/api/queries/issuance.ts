// frontend/src/api/queries/issuance.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminToken, apiClient, bearer, unwrap } from '@/api/client';
import type {
  Batch,
  BatchLeaves,
  IssueCredentialIn,
  IssueCredentialOut,
  IssuedCredentialList,
  RevokeOut,
  StatusListOut,
  WalletPublic,
} from '@/api/schemas';

export function useIssuedCredentials(issuerId: string, enabled: boolean) {
  return useInfiniteQuery<IssuedCredentialList>({
    queryKey: ['issued', issuerId],
    enabled,
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        apiClient.GET('/issuers/{issuer_id}/credentials', {
          params: { path: { issuer_id: issuerId }, query: pageParam ? { cursor: pageParam as string } : {} },
          headers: bearer(adminToken.get()),
        }),
      ),
  });
}

export function useBatches(issuerId: string) {
  return useQuery<{ items: Batch[] }>({
    queryKey: ['batches', issuerId],
    queryFn: () => unwrap(apiClient.GET('/issuers/{issuer_id}/batches', { params: { path: { issuer_id: issuerId } } })),
  });
}

export function lookupWallet(displayName: string): Promise<WalletPublic> {
  return unwrap(apiClient.GET('/wallets/lookup', { params: { query: { display_name: displayName } } }));
}

export function useIssueCredential(issuerId: string) {
  const qc = useQueryClient();
  return useMutation<IssueCredentialOut, unknown, IssueCredentialIn>({
    mutationFn: (body) =>
      unwrap(apiClient.POST('/issuers/{issuer_id}/credentials', { params: { path: { issuer_id: issuerId } }, body, headers: bearer(adminToken.get()) })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['issued', issuerId] });
      void qc.invalidateQueries({ queryKey: ['batches', issuerId] });
    },
  });
}

export function useAnchorBatch(issuerId: string) {
  const qc = useQueryClient();
  return useMutation<Batch, unknown, string>({
    mutationFn: (batchId) =>
      unwrap(
        apiClient.POST('/issuers/{issuer_id}/batches/{batch_id}/anchor', {
          params: { path: { issuer_id: issuerId, batch_id: batchId } },
          headers: bearer(adminToken.get()),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches', issuerId] }),
  });
}

export function useRevokeCredential(issuerId: string) {
  const qc = useQueryClient();
  return useMutation<RevokeOut, unknown, string>({
    mutationFn: (credentialId) =>
      unwrap(
        apiClient.POST('/issuers/{issuer_id}/credentials/{credential_id}/revoke', {
          params: { path: { issuer_id: issuerId, credential_id: credentialId } },
          headers: bearer(adminToken.get()),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issued', issuerId] }),
  });
}

export function fetchBatchLeaves(batchId: string): Promise<BatchLeaves> {
  return unwrap(apiClient.GET('/batches/{batch_id}/leaves', { params: { path: { batch_id: batchId } } }));
}

export function fetchStatusList(listId: string): Promise<StatusListOut> {
  return unwrap(apiClient.GET('/status-lists/{list_id}', { params: { path: { list_id: listId } } }));
}
