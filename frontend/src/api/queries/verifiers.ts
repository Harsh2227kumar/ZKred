// frontend/src/api/queries/verifiers.ts
// TanStack query & mutation hooks for Verifiers, Presentation Requests, Policy Parsing, and Verification Polling.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, unwrap } from '@/api/client';
import { config } from '@/config';
import type {
  Verifier,
  VerifiersListResponse,
  VerifierCreateIn,
  ParseIn,
  ParseOut,
  RequestCreateIn,
  PresentationRequest,
  VerificationsListResponse,
  Presentation,
  Verification,
} from '@/api/schemas';

// --- Queries ---

export function useVerifiers() {
  return useQuery<VerifiersListResponse>({
    queryKey: ['verifiers'],
    queryFn: async () => {
      const res = await fetch(`${config.apiBaseUrl}/verifiers`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<VerifiersListResponse>;
    },
  });
}

export function usePresentationRequest(requestId?: string) {
  return useQuery<PresentationRequest>({
    queryKey: ['presentation-requests', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const res = await fetch(`${config.apiBaseUrl}/presentation-requests/${requestId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<PresentationRequest>;
    },
    enabled: Boolean(requestId),
  });
}

export function useVerifications(requestId?: string) {
  return useQuery<VerificationsListResponse>({
    queryKey: ['presentation-requests', requestId, 'verifications'],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const res = await fetch(`${config.apiBaseUrl}/presentation-requests/${requestId}/verifications`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<VerificationsListResponse>;
    },
    enabled: Boolean(requestId),
    refetchInterval: 2000, // Poll every 2 seconds per CONTRACTS §3.4
  });
}

// --- Mutations ---

export function useCreateVerifier() {
  const queryClient = useQueryClient();
  return useMutation<Verifier, unknown, VerifierCreateIn>({
    mutationFn: async (input: VerifierCreateIn) => {
      const res = await fetch(`${config.apiBaseUrl}/verifiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<Verifier>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifiers'] });
    },
  });
}

export function useParsePolicy() {
  return useMutation<ParseOut, unknown, ParseIn>({
    mutationFn: async (input: ParseIn) => {
      const res = await fetch(`${config.apiBaseUrl}/presentation-requests/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<ParseOut>;
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation<PresentationRequest, unknown, RequestCreateIn>({
    mutationFn: async (input: RequestCreateIn) => {
      const res = await fetch(`${config.apiBaseUrl}/presentation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<PresentationRequest>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['presentation-requests', data.id] });
    },
  });
}

// --- Plain helpers (used by features/wallet/pages/WalletRespondPage, V1.2-H4) ---

export function useRequest(requestId: string | null | undefined) {
  return useQuery<PresentationRequest>({
    queryKey: ['request', requestId],
    queryFn: () => unwrap(apiClient.GET('/presentation-requests/{request_id}', { params: { path: { request_id: requestId! } } })) as Promise<PresentationRequest>,
    enabled: Boolean(requestId),
    retry: false,
  });
}

export function submitPresentation(requestId: string, body: Presentation): Promise<Verification> {
  return unwrap(apiClient.POST('/presentation-requests/{request_id}/presentations', { params: { path: { request_id: requestId } }, body })) as Promise<Verification>;
}
