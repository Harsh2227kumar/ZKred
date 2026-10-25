// frontend/src/api/queries/issuers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminToken, apiClient, bearer, unwrap } from '@/api/client';
import type { CompromiseReport, Issuer, IssuerCreate, IssuerKey, IssuersListResponse } from '@/api/schemas';

export const issuerKeys = {
  all: ['issuers'] as const,
  one: (id: string) => ['issuers', id] as const,
};

export function useIssuers() {
  return useQuery<IssuersListResponse>({
    queryKey: issuerKeys.all,
    queryFn: () => unwrap(apiClient.GET('/issuers')),
  });
}

export function useIssuer(issuerId: string | undefined) {
  return useQuery<Issuer>({
    queryKey: issuerKeys.one(issuerId ?? ''),
    queryFn: () => unwrap(apiClient.GET('/issuers/{issuer_id}', { params: { path: { issuer_id: issuerId! } } })),
    enabled: Boolean(issuerId),
  });
}

export function useCreateIssuer() {
  const qc = useQueryClient();
  return useMutation<Issuer, unknown, IssuerCreate>({
    mutationFn: (body) => unwrap(apiClient.POST('/issuers', { body, headers: bearer(adminToken.get()) })),
    onSuccess: () => qc.invalidateQueries({ queryKey: issuerKeys.all }),
  });
}

export function useRotateKey(issuerId: string) {
  const qc = useQueryClient();
  return useMutation<IssuerKey, unknown, void>({
    mutationFn: () =>
      unwrap(apiClient.POST('/issuers/{issuer_id}/keys/rotate', { params: { path: { issuer_id: issuerId } }, headers: bearer(adminToken.get()) })),
    onSuccess: () => qc.invalidateQueries({ queryKey: issuerKeys.all }),
  });
}

export function useReportCompromise(issuerId: string) {
  const qc = useQueryClient();
  return useMutation<CompromiseReport, unknown, { keyId: string; windowSeconds: number }>({
    mutationFn: ({ keyId, windowSeconds }) =>
      unwrap(
        apiClient.POST('/issuers/{issuer_id}/keys/{key_id}/compromise', {
          params: { path: { issuer_id: issuerId, key_id: keyId } },
          body: { window_seconds: windowSeconds },
          headers: bearer(adminToken.get()),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issuerKeys.all });
      void qc.invalidateQueries({ queryKey: ['batches', issuerId] });
    },
  });
}
