// frontend/src/features/wallet/pages/WalletRespondPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePresentationRequest, useSubmitPresentation } from '@/api/queries/verifiers';
import { useIssuers, fetchBatchLeaves } from '@/api/queries/issuers';
import { getReplacedCommitments, getStoredCredentials, isWalletLocked } from '@/lib/wallet-store';
import { createPresentation, type IssuerInfo } from '@/lib/zk';
import type { SignedCredential } from '@/lib/wallet-crypto';
import type { Verification } from '@/api/schemas';
import { ConsentScreen } from '../components/ConsentScreen';
import { DeviceUnlock } from '../components/DeviceUnlock';
import { ProvingProgressModal, type ProvingStage } from '../components/ProvingProgressModal';
import { PresentationResultCard } from '../components/PresentationResultCard';
import { EmptyState } from '@/components/common/EmptyState';
import { toUserMessage } from '@/api/client';
import { credentialKey, isPresentable, newestFirst, useCredentialStatuses } from '../hooks/useCredentialStatus';

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');

  const [localCredentials, setLocalCredentials] = useState<SignedCredential[]>([]);
  const [replaced, setReplaced] = useState<string[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlockCount, setUnlockCount] = useState(0);

  // Prover & Verification Lifecycle State
  const [provingStage, setProvingStage] = useState<ProvingStage>('IDLE');
  const [provingError, setProvingError] = useState<string | null>(null);
  const [showProvingModal, setShowProvingModal] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);

  const {
    data: request,
    isLoading: isLoadingRequest,
    error: requestError,
  } = usePresentationRequest(requestId || undefined);

  const { data: issuersData } = useIssuers();
  const submitMutation = useSubmitPresentation(requestId || '');

  useEffect(() => {
    let mounted = true;
    isWalletLocked()
      .then(async (isLocked) => {
        if (mounted) setLocked(isLocked);
        return isLocked ? ([[], []] as [SignedCredential[], string[]]) : Promise.all([getStoredCredentials(), getReplacedCommitments()]);
      })
      .then(([creds, replacedCommitments]) => {
        if (mounted) {
          setLocalCredentials(creds);
          setReplaced(replacedCommitments);
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
  }, [unlockCount]);

  // Only credentials a verifier would accept right now (not revoked, not in a compromise window, not replaced by a
  // refreshed copy), newest first so a refreshed copy wins. If the status can't be read, the verifier still decides.
  const statuses = useCredentialStatuses(localCredentials, replaced);
  const presentable = useMemo(() => {
    const notReplaced = localCredentials.filter((c) => !replaced.includes(credentialKey(c)));
    const usable = statuses.data ? notReplaced.filter((c) => isPresentable(statuses.data[credentialKey(c)])) : statuses.error ? notReplaced : [];
    return [...usable].sort(newestFirst);
  }, [localCredentials, replaced, statuses.data, statuses.error]);
  const heldBack = localCredentials.length - presentable.length;
  const isCheckingStatus = localCredentials.length > 0 && statuses.isLoading;

  const hasAgePredicate =
    request?.policy?.requirements.some((r) =>
      r.predicates?.some((p) => p.type === 'age_gte')
    ) ?? false;

  const handleExecuteProver = async () => {
    if (!request || !requestId) return;

    setShowProvingModal(true);
    setProvingError(null);
    setProvingStage('RESOLVING_DEPENDENCIES');

    try {
      // 1. Gather all issuer keys and accreditation status
      const issuers = issuersData?.items || [];
      const issuerKeys: { key_id: string; public_key: string }[] = [];
      const issuersMap: Record<string, IssuerInfo> = {};

      for (const iss of issuers) {
        issuersMap[iss.did] = {
          kind: iss.kind,
          accredited: iss.accredited,
        };
        for (const k of iss.keys || []) {
          if (k.public_key) {
            issuerKeys.push({ key_id: k.key_id, public_key: k.public_key });
          }
        }
      }

      // 2. Fetch on-chain batch leaves for each candidate credential
      const batchLeaves: Record<string, string[]> = {};
      for (const cred of presentable) {
        const batchId = cred.values?.batch_id;
        if (batchId && !batchLeaves[batchId]) {
          const leaves = await fetchBatchLeaves(batchId);
          batchLeaves[batchId] = leaves;
        }
      }

      // 3. Update stage to BBS derivation / ZK SNARK proving
      setProvingStage(hasAgePredicate ? 'PROVING_AGE' : 'DERIVING_BBS');

      // 4. Execute in-browser BBS+ selective disclosure and Groth16 age zk-SNARK
      const presentation = await createPresentation({
        request: {
          id: request.id,
          nonce: request.nonce,
          policy: request.policy,
        },
        credentials: presentable,
        issuerKeys,
        batchLeaves,
        issuers: issuersMap,
      });

      // 5. Submit cryptographic presentation to verifier gateway
      setProvingStage('SUBMITTING');
      const result = await submitMutation.mutateAsync(presentation);

      setVerification(result);
      setProvingStage('COMPLETED');
      toast.success(
        result.result === 'accepted'
          ? 'Zero-Knowledge Presentation verified and accepted!'
          : 'Presentation rejected by verifier evaluation.'
      );
    } catch (err: any) {
      console.error('Presentation proving failed:', err);
      setProvingStage('FAILED');
      const msg = err.message || 'Zero-Knowledge presentation generation failed.';
      setProvingError(msg);
      toast.error(msg);
    }
  };

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

  if (locked) {
    return (
      <div className="py-12">
        <DeviceUnlock
          onUnlocked={() => {
            setIsLoadingStorage(true);
            setUnlockCount((n) => n + 1);
          }}
        />
      </div>
    );
  }

  if (isLoadingRequest || isLoadingStorage || isCheckingStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-[#79bab6] animate-spin" />
        <p className="text-sm text-[#8ea5a8]">Retrieving presentation policy specification...</p>
      </div>
    );
  }

  if (requestError || !request) {
    // Only a 404 means the link is wrong; anything else (API down, expired) is shown as it is.
    const requestNotFound = !requestError || (requestError as { error?: { code?: string } }).error?.code === 'NOT_FOUND';
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8">
        <div className="p-6 rounded-3xl border border-[#fb7185]/30 bg-[#fb7185]/10 space-y-3 text-center">
          <AlertCircle className="w-8 h-8 text-[#fb7185] mx-auto" />
          <h2 className="text-base font-semibold text-[#f0f7f7]">{requestNotFound ? 'Verification Request Not Found' : 'Could Not Open This Request'}</h2>
          <p className="text-xs text-[#8ea5a8]">
            {requestNotFound
              ? 'This presentation request link may have expired or the verifier request ID is invalid.'
              : toUserMessage(requestError)}
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

  const isProvingActive =
    provingStage !== 'IDLE' && provingStage !== 'COMPLETED' && provingStage !== 'FAILED';

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
              {verification ? 'Verification Evaluation Result' : 'Credential Consent & Disclosure'}
            </h1>
            <p className="text-xs text-[#8ea5a8]">
              {verification
                ? 'Deterministic 4-stage evaluation completed. Zero-knowledge guarantees preserved.'
                : 'Zero-knowledge authorization gateway. You control exactly what leaves your device.'}
            </p>
          </div>
        </div>
      </div>

      {!verification && statuses.error && (
        <div className="p-3 rounded-2xl bg-[#ff9f0a]/10 border border-[#ff9f0a]/25 text-[#ff9f0a] text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Could not check your credentials' revocation and key status ({toUserMessage(statuses.error)}). The verifier will check them.</span>
        </div>
      )}
      {!verification && !statuses.error && heldBack > 0 && (
        <div className="p-3 rounded-2xl bg-[#1a1430] border border-[#231a3d] text-[#8ea5a8] text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            {heldBack} credential{heldBack === 1 ? ' is' : 's are'} not offered here: revoked, waiting for an anchor, replaced, or issued during a key
            compromise.
          </span>
          <NavLink to="/wallet" className="font-semibold text-[#79bab6] hover:underline">
            Review in your wallet
          </NavLink>
        </div>
      )}

      {/* Render Result Card or Consent Screen */}
      {verification ? (
        <PresentationResultCard
          request={request}
          verification={verification}
          onRetry={() => {
            setVerification(null);
            setProvingStage('IDLE');
          }}
        />
      ) : (
        <ConsentScreen
          request={request}
          localCredentials={presentable}
          onStartProving={handleExecuteProver}
          isProving={isProvingActive}
        />
      )}

      {/* Proving Progress Modal */}
      {showProvingModal && (
        <ProvingProgressModal
          stage={provingStage}
          hasAgePredicate={hasAgePredicate}
          errorMessage={provingError}
          onClose={() => {
            setShowProvingModal(false);
          }}
        />
      )}
    </div>
  );
};
