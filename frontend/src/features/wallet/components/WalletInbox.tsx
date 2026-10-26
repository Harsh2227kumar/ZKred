// frontend/src/features/wallet/components/WalletInbox.tsx
import React, { useState } from 'react';
import { Inbox, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useOffers, useClaimOffer } from '@/api/queries/wallets';
import { useIssuers } from '@/api/queries/issuers';
import {
  decryptOffer,
  verifyCredentialSignature,
  type SignedCredential,
} from '@/lib/wallet-crypto';
import {
  getWalletKeypair,
  addStoredCredential,
  getSessionPassphrase,
  getFullWalletState,
} from '@/lib/wallet-store';
import { encryptWalletBackup } from '@/lib/wallet-crypto';
import { toUserMessage } from '@/api/client';
import { config } from '@/config';
import type { CredentialOffer } from '@/api/schemas';

interface WalletInboxProps {
  walletId: string;
  walletToken: string;
  onClaimSuccess: () => void;
  onRequirePassphrase?: () => void;
}

export const WalletInbox: React.FC<WalletInboxProps> = ({
  walletId,
  walletToken,
  onClaimSuccess,
  onRequirePassphrase,
}) => {
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: offersData, isLoading: offersLoading, refetch } = useOffers(walletId, walletToken);
  const { data: issuersData, refetch: refetchIssuers } = useIssuers();
  const claimMutation = useClaimOffer(walletId, walletToken);

  const offers = offersData?.items || [];
  const issuers = issuersData?.items || [];

  const handleClaim = async (offer: CredentialOffer) => {
    setErrorMsg(null);
    setClaimingOfferId(offer.id);

    try {
      // 1. Get browser private key
      const keypair = await getWalletKeypair();
      if (!keypair?.privateKeyJwk) {
        throw new Error('Local wallet private key not found in IndexedDB.');
      }

      // 2. Decrypt offer payload
      const credential: SignedCredential = await decryptOffer(keypair.privateKeyJwk, {
        ephemeral_public_key: offer.ephemeral_public_key,
        iv: offer.iv,
        ciphertext: offer.ciphertext,
      });

      // 3. Find issuer and public key. A key we haven't seen yet (a new issuer, or the key rotated in after a
      //    compromise, which signs every refreshed credential) means the cached list is stale: re-read it once.
      const keyIn = (list: typeof issuers) =>
        list.find((i) => i.id === offer.issuer_id || i.did === credential.issuer_did)?.keys?.find((k) => k.key_id === credential.key_id);
      const issuerKey = keyIn(issuers) ?? keyIn((await refetchIssuers()).data?.items ?? []);

      if (!issuerKey?.public_key) {
        throw new Error('Issuer public key not found or not published on-chain. Cannot verify cryptographic signature.');
      }

      // 4. Client-side BBS+ signature verification
      const isValid = await verifyCredentialSignature(credential, issuerKey.public_key);
      if (!isValid) {
        throw new Error('Issuer cryptographic signature verification failed! Credential rejected.');
      }

      // 5. Save verified credential to local storage
      await addStoredCredential(credential);

      // 6. Mark offer claimed on server
      await claimMutation.mutateAsync(offer.id);

      // 7. Auto-sync encrypted backup if passphrase is in memory
      const passphrase = getSessionPassphrase();
      if (passphrase) {
        const fullState = await getFullWalletState();
        if (fullState) {
          const encrypted = await encryptWalletBackup(passphrase, fullState);
          await fetch(`${config.apiBaseUrl}/wallets/${walletId}/backup`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${walletToken}`,
            },
            body: JSON.stringify({ ...encrypted, version: 1 }),
          });
        }
      } else if (onRequirePassphrase) {
        onRequirePassphrase();
      }

      toast.success(`Claimed & verified: ${offer.credential_type}`);
      onClaimSuccess();
      refetch();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to claim credential offer.'));
    } finally {
      setClaimingOfferId(null);
    }
  };

  const unclaimedOffers = offers.filter((o) => !o.claimed_at);

  return (
    <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Credential Offers Inbox</h3>
            <p className="text-[11px] text-[#8ea5a8]">End-to-end encrypted to your wallet</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1a1430] text-[#79bab6] font-medium border border-[#231a3d]">
          {unclaimedOffers.length} pending
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {offersLoading ? (
        <div className="p-4 text-center text-xs text-[#8ea5a8]">
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#79bab6] mb-1" />
          Checking for offers...
        </div>
      ) : offers.length === 0 ? (
        <div className="p-6 text-center text-xs text-[#8ea5a8] border border-dashed border-[#231a3d] rounded-2xl">
          No offers found in inbox. When universities or issuers sign credentials for your display name, they will appear here.
        </div>
      ) : (
        <div className="space-y-2.5">
          {offers.map((offer) => {
            const isClaimed = Boolean(offer.claimed_at);
            const isClaiming = claimingOfferId === offer.id;
            const issuer = issuers.find((i) => i.id === offer.issuer_id);

            return (
              <div
                key={offer.id}
                className="p-3.5 rounded-2xl border border-[#231a3d] bg-[#090614] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#06838d]/30 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#f0f7f7]">
                      {offer.credential_type}
                    </span>
                    <span className="text-[10px] text-[#79bab6] bg-[#06838d]/15 px-2 py-0.5 rounded-full border border-[#06838d]/25">
                      {issuer?.name || 'Accredited Issuer'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8ea5a8]">
                    Issued {new Date(offer.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#8ea5a8] bg-[#1a1430] px-3 py-1.5 rounded-xl border border-[#231a3d]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#79bab6]" /> Claimed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleClaim(offer)}
                      disabled={isClaiming}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Decrypting & Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Claim & Verify</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
