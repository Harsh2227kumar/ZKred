// frontend/src/api/queries/meta.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { HealthResponse, ChainInfoResponse, EnumsResponse, CredentialSchemasResponse } from '@/api/schemas';

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/health', {});
      if (error) throw error;
      return data as HealthResponse;
    },
    refetchInterval: 15000, // poll every 15s per VERSION-PLAN.md
    retry: 1,
  });
}

export function useChainInfo() {
  return useQuery<ChainInfoResponse>({
    queryKey: ['meta', 'chain'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/meta/chain', {});
      if (error) throw error;
      return data as ChainInfoResponse;
    },
    staleTime: 60000,
  });
}

export function useEnums() {
  return useQuery<EnumsResponse>({
    queryKey: ['meta', 'enums'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/meta/enums', {});
      if (error) throw error;
      return data as EnumsResponse;
    },
    staleTime: 300000,
  });
}

export function useCredentialSchemas() {
  return useQuery<CredentialSchemasResponse>({
    queryKey: ['meta', 'credential-schemas'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/meta/credential-schemas', {});
      if (error) throw error;
      return data as CredentialSchemasResponse;
    },
    staleTime: 300000,
  });
}
