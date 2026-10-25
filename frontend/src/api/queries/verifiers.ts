// frontend/src/api/queries/verifiers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, unwrap } from '@/api/client';
import type { ParseOut, Presentation, PresentationPolicy, PresentationRequest, Verification, Verifier } from '@/api/schemas';

/** How often the verifier result page polls for a holder's answer (CONTRACTS §3.4: poll 2 s). */
const VERIFICATION_POLL_MS = 2000;

export function useVerifiers() {
  return useQuery<{ items: Verifier[] }>({
    queryKey: ['verifiers'],
    queryFn: () => unwrap(apiClient.GET('/verifiers')),
  });
}

export function useCreateVerifier() {
  const qc = useQueryClient();
  return useMutation<Verifier, unknown, string>({
    mutationFn: (name) => unwrap(apiClient.POST('/verifiers', { body: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verifiers'] }),
  });
}

export function useParsePolicy() {
  return useMutation<ParseOut, unknown, string>({
    mutationFn: (text) => unwrap(apiClient.POST('/presentation-requests/parse', { body: { text } })),
  });
}

export function useCreateRequest() {
  return useMutation<PresentationRequest, unknown, { verifierId: string; policy: PresentationPolicy; nlText: string | null }>({
    mutationFn: ({ verifierId, policy, nlText }) =>
      unwrap(apiClient.POST('/presentation-requests', { body: { verifier_id: verifierId, policy, nl_text: nlText } })),
  });
}

export function useRequest(requestId: string | null | undefined) {
  return useQuery<PresentationRequest>({
    queryKey: ['request', requestId],
    queryFn: () => unwrap(apiClient.GET('/presentation-requests/{request_id}', { params: { path: { request_id: requestId! } } })),
    enabled: Boolean(requestId),
    retry: false,
  });
}

export function useVerifications(requestId: string | undefined, poll: boolean) {
  return useQuery<{ items: Verification[] }>({
    queryKey: ['verifications', requestId],
    queryFn: () =>
      unwrap(apiClient.GET('/presentation-requests/{request_id}/verifications', { params: { path: { request_id: requestId! } } })),
    enabled: Boolean(requestId),
    refetchInterval: poll ? VERIFICATION_POLL_MS : false,
  });
}

export function submitPresentation(requestId: string, body: Presentation): Promise<Verification> {
  return unwrap(apiClient.POST('/presentation-requests/{request_id}/presentations', { params: { path: { request_id: requestId } }, body }));
}
