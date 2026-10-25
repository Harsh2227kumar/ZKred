// frontend/src/api/queries/issuers.ts
// TanStack query & mutation hooks for Institutional Issuers, Keys, Batches, and Issuance.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { config } from '@/config';
import { getAdminAuthHeaders } from '@/lib/storage/session-token';
import type {
  Issuer,
  IssuerKey,
  IssuerCreate,
  IssuersListResponse,
  Batch,
  BatchesListResponse,
  IssuedCredentialsListResponse,
  IssueCredentialIn,
  IssueCredentialOut,
  WalletLookupResponse,
} from '@/api/schemas';

// --- Queries ---

export function useIssuers() {
  return useQuery<IssuersListResponse>({
    queryKey: ['issuers'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/issuers', {});
      if (error) throw error;
      return data as IssuersListResponse;
    },
  });
}

export function useIssuer(issuerId?: string) {
  return useQuery<Issuer>({
    queryKey: ['issuer', issuerId],
    queryFn: async () => {
      if (!issuerId) throw new Error('Issuer ID is required');
      const { data, error } = await apiClient.GET('/issuers/{issuer_id}', {
        params: { path: { issuer_id: issuerId } },
      });
      if (error) throw error;
      return data as Issuer;
    },
    enabled: Boolean(issuerId),
  });
}

export function useBatches(issuerId?: string) {
  return useQuery<BatchesListResponse>({
    queryKey: ['issuer', issuerId, 'batches'],
    queryFn: async () => {
      if (!issuerId) throw new Error('Issuer ID is required');
      const res = await fetch(`${config.apiBaseUrl}/issuers/${issuerId}/batches`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<BatchesListResponse>;
    },
    enabled: Boolean(issuerId),
  });
}

export function useIssuedCredentials(issuerId?: string) {
  return useQuery<IssuedCredentialsListResponse>({
    queryKey: ['issuer', issuerId, 'credentials'],
    queryFn: async () => {
      if (!issuerId) throw new Error('Issuer ID is required');
      const res = await fetch(`${config.apiBaseUrl}/issuers/${issuerId}/credentials`, {
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<IssuedCredentialsListResponse>;
    },
    enabled: Boolean(issuerId),
  });
}

export function useLookupWallet(displayName: string) {
  return useQuery<WalletLookupResponse>({
    queryKey: ['wallets', 'lookup', displayName],
    queryFn: async () => {
      const trimmed = displayName.trim();
      if (!trimmed) throw new Error('Display name is required');
      const res = await fetch(`${config.apiBaseUrl}/wallets/lookup?display_name=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<WalletLookupResponse>;
    },
    enabled: displayName.trim().length >= 2,
    retry: false,
  });
}

// --- Mutations ---

export function useCreateIssuer() {
  const queryClient = useQueryClient();
  return useMutation<Issuer, unknown, IssuerCreate>({
    mutationFn: async (input: IssuerCreate) => {
      const { data, error } = await apiClient.POST('/issuers', {
        headers: getAdminAuthHeaders(),
        body: input,
      });
      if (error) throw error;
      return data as Issuer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuers'] });
    },
  });
}

export function useRotateKey(issuerId: string) {
  const queryClient = useQueryClient();
  return useMutation<IssuerKey, unknown, void>({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST('/issuers/{issuer_id}/keys/rotate', {
        params: { path: { issuer_id: issuerId } },
        headers: getAdminAuthHeaders(),
      });
      if (error) throw error;
      return data as IssuerKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuer', issuerId] });
      queryClient.invalidateQueries({ queryKey: ['issuers'] });
    },
  });
}

export function useIssueCredential(issuerId: string) {
  const queryClient = useQueryClient();
  return useMutation<IssueCredentialOut, unknown, IssueCredentialIn>({
    mutationFn: async (input: IssueCredentialIn) => {
      const res = await fetch(`${config.apiBaseUrl}/issuers/${issuerId}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<IssueCredentialOut>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuer', issuerId, 'credentials'] });
      queryClient.invalidateQueries({ queryKey: ['issuer', issuerId, 'batches'] });
    },
  });
}

export function useAnchorBatch(issuerId: string) {
  const queryClient = useQueryClient();
  return useMutation<Batch, unknown, string>({
    mutationFn: async (batchId: string) => {
      const res = await fetch(`${config.apiBaseUrl}/issuers/${issuerId}/batches/${batchId}/anchor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<Batch>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuer', issuerId, 'batches'] });
    },
  });
}
