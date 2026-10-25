// frontend/src/api/queries/wallets.ts
// Wallet endpoints are driven by the wallet session (IndexedDB), so these are plain functions, not hooks.
import { apiClient, bearer, unwrap } from '@/api/client';
import type { Backup, BackupIn, CredentialOffer, ReissueIn, WalletCreated } from '@/api/schemas';

export function createWallet(displayName: string, encPublicKey: string): Promise<WalletCreated> {
  return unwrap(apiClient.POST('/wallets', { body: { display_name: displayName, enc_public_key: encPublicKey } }));
}

export async function listOffers(walletId: string, token: string): Promise<CredentialOffer[]> {
  const out = await unwrap(apiClient.GET('/wallets/{wallet_id}/offers', { params: { path: { wallet_id: walletId } }, headers: bearer(token) }));
  return out.items;
}

export function claimOffer(walletId: string, offerId: string, token: string): Promise<CredentialOffer> {
  return unwrap(
    apiClient.POST('/wallets/{wallet_id}/offers/{offer_id}/claim', {
      params: { path: { wallet_id: walletId, offer_id: offerId } },
      headers: bearer(token),
    }),
  );
}

export function putBackup(walletId: string, token: string, body: BackupIn): Promise<Backup> {
  return unwrap(apiClient.PUT('/wallets/{wallet_id}/backup', { params: { path: { wallet_id: walletId } }, body, headers: bearer(token) }));
}

export function getBackup(walletId: string, token: string): Promise<Backup> {
  return unwrap(apiClient.GET('/wallets/{wallet_id}/backup', { params: { path: { wallet_id: walletId } }, headers: bearer(token) }));
}

export function requestReissue(issuerId: string, token: string, body: ReissueIn): Promise<{ offer_id: string }> {
  return unwrap(apiClient.POST('/issuers/{issuer_id}/reissue', { params: { path: { issuer_id: issuerId } }, body, headers: bearer(token) }));
}
