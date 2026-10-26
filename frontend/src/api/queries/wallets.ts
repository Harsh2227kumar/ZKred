// frontend/src/api/queries/wallets.ts
// TanStack query & mutation hooks for Holder Wallets, Offers Inbox, and Backups,
// plus the plain async functions used by the wallet session hook (V1.2-H4).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, bearer, unwrap } from '@/api/client';
import { config } from '@/config';
import type {
  WalletCreateIn,
  WalletCreated,
  OffersListResponse,
  CredentialOffer,
  BackupIn,
  Backup,
  ReissueIn,
} from '@/api/schemas';

function walletAuthHeaders(walletToken?: string): Record<string, string> {
  if (!walletToken) return {};
  return { Authorization: `Bearer ${walletToken}` };
}

// --- Plain functions (wallet-session driven, used by features/wallet/hooks/useWalletSession) ---

export function createWallet(displayName: string, encPublicKey: string): Promise<WalletCreated> {
  return unwrap(apiClient.POST('/wallets', { body: { display_name: displayName, enc_public_key: encPublicKey } })) as Promise<WalletCreated>;
}

export async function listOffers(walletId: string, token: string): Promise<CredentialOffer[]> {
  const out = await unwrap(apiClient.GET('/wallets/{wallet_id}/offers', { params: { path: { wallet_id: walletId } }, headers: bearer(token) }));
  return (out as OffersListResponse).items;
}

export function claimOffer(walletId: string, offerId: string, token: string): Promise<CredentialOffer> {
  return unwrap(
    apiClient.POST('/wallets/{wallet_id}/offers/{offer_id}/claim', {
      params: { path: { wallet_id: walletId, offer_id: offerId } },
      headers: bearer(token),
    }),
  ) as Promise<CredentialOffer>;
}

export function putBackup(walletId: string, token: string, body: BackupIn): Promise<Backup> {
  return unwrap(apiClient.PUT('/wallets/{wallet_id}/backup', { params: { path: { wallet_id: walletId } }, body, headers: bearer(token) })) as Promise<Backup>;
}

export function getBackup(walletId: string, token: string): Promise<Backup> {
  return unwrap(apiClient.GET('/wallets/{wallet_id}/backup', { params: { path: { wallet_id: walletId } }, headers: bearer(token) })) as Promise<Backup>;
}

export function requestReissue(issuerId: string, token: string, body: ReissueIn): Promise<{ offer_id: string }> {
  return unwrap(apiClient.POST('/issuers/{issuer_id}/reissue', { params: { path: { issuer_id: issuerId } }, body, headers: bearer(token) })) as Promise<{ offer_id: string }>;
}

// --- Queries ---

export function useOffers(walletId?: string, walletToken?: string) {
  return useQuery<OffersListResponse>({
    queryKey: ['wallets', walletId, 'offers'],
    queryFn: async () => {
      if (!walletId || !walletToken) throw new Error('Wallet auth required');
      const res = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/offers`, {
        headers: walletAuthHeaders(walletToken),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<OffersListResponse>;
    },
    enabled: Boolean(walletId && walletToken),
    refetchInterval: 10000, // check for new offers every 10s
  });
}

export function useBackup(walletId?: string, walletToken?: string) {
  return useQuery<Backup>({
    queryKey: ['wallets', walletId, 'backup'],
    queryFn: async () => {
      if (!walletId || !walletToken) throw new Error('Wallet auth required');
      const res = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/backup`, {
        headers: walletAuthHeaders(walletToken),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<Backup>;
    },
    enabled: Boolean(walletId && walletToken),
  });
}

// --- Mutations ---

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation<WalletCreated, unknown, WalletCreateIn>({
    mutationFn: async (input: WalletCreateIn) => {
      const res = await fetch(`${config.apiBaseUrl}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<WalletCreated>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallets', data.id] });
    },
  });
}

export function useClaimOffer(walletId?: string, walletToken?: string) {
  const queryClient = useQueryClient();
  return useMutation<CredentialOffer, unknown, string>({
    mutationFn: async (offerId: string) => {
      if (!walletId || !walletToken) throw new Error('Wallet auth required');
      const res = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/offers/${offerId}/claim`, {
        method: 'POST',
        headers: walletAuthHeaders(walletToken),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<CredentialOffer>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', walletId, 'offers'] });
    },
  });
}

export function useSaveBackup(walletId?: string, walletToken?: string) {
  const queryClient = useQueryClient();
  return useMutation<Backup, unknown, BackupIn>({
    mutationFn: async (backupData: BackupIn) => {
      if (!walletId || !walletToken) throw new Error('Wallet auth required');
      const res = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/backup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...walletAuthHeaders(walletToken),
        },
        body: JSON.stringify(backupData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }
      return res.json() as Promise<Backup>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', walletId, 'backup'] });
    },
  });
}
