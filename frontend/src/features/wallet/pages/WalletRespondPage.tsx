// frontend/src/features/wallet/pages/WalletRespondPage.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { usePresentationRequest } from '@/api/queries/verifiers';
import { getStoredCredentials } from '@/lib/wallet-store';
import type { SignedCredential } from '@/lib/wallet-crypto';
import { ConsentScreen } from '../components/ConsentScreen';
import { EmptyState } from '@/components/common/EmptyState';

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');

  const [localCredentials, setLocalCredentials] = useState<SignedCredential[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  const {
    data: request,
    isLoading: isLoadingRequest,
    error: requestError,
  } = usePresentationRequest(requestId || undefined);

  useEffect(() => {
    let mounted = true;
    getStoredCredentials()
      .then((creds) => {
        if (mounted) {
          setLocalCredentials(creds);
          setIsLoadingStorage(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load local wallet credentials:', err);
        if (mounted) setIsLoadingStorage(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!requestId) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          title="Missing Verification Request"
          description="Please scan or open a valid zero-knowledge credential verification request link."
          action={
            <NavLink
              to="/wallet"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#06838d] hover:bg-[#046168] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to My Wallet
            </NavLink>
          }
        />
      </div>
    );
  }

  if (isLoadingRequest || isLoadingStorage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-[#79bab6] animate-spin" />
        <p className="text-sm text-[#8ea5a8]">Retrieving presentation policy specification...</p>
      </div>
    );
  }

  if (requestError || !request) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8">
        <div className="p-6 rounded-3xl border border-[#fb7185]/30 bg-[#fb7185]/10 space-y-3 text-center">
          <AlertCircle className="w-8 h-8 text-[#fb7185] mx-auto" />
          <h2 className="text-base font-semibold text-[#f0f7f7]">Verification Request Not Found</h2>
          <p className="text-xs text-[#8ea5a8]">
            This presentation request link may have expired or the verifier request ID is invalid.
          </p>
          <div className="pt-2">
            <NavLink
              to="/wallet"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#130e24] text-[#f0f7f7] border border-[#231a3d] hover:border-[#79bab6]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Wallet
            </NavLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb */}
      <NavLink
        to="/wallet"
        className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Wallet
      </NavLink>

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#231a3d]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#f0f7f7]">
              Credential Consent & Disclosure
            </h1>
            <p className="text-xs text-[#8ea5a8]">
              Zero-knowledge authorization gateway. You control exactly what leaves your device.
            </p>
          </div>
        </div>
      </div>

      {/* 3-Tier Consent & Disclosure Visualizer */}
      <ConsentScreen request={request} localCredentials={localCredentials} />
    </div>
  );
};
