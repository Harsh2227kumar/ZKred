// frontend/src/features/wallet/pages/WalletRespondPage.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePresentationRequest, useSubmitPresentation } from '@/api/queries/verifiers';
import { useIssuers, fetchBatchLeaves } from '@/api/queries/issuers';
import { getStoredCredentials } from '@/lib/wallet-store';
import { createPresentation, type IssuerInfo } from '@/lib/zk';
import type { SignedCredential } from '@/lib/wallet-crypto';
import type { Verification } from '@/api/schemas';
import { ConsentScreen } from '../components/ConsentScreen';
import { ProvingProgressModal, type ProvingStage } from '../components/ProvingProgressModal';
import { PresentationResultCard } from '../components/PresentationResultCard';
import { EmptyState } from '@/components/common/EmptyState';

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');

  const [localCredentials, setLocalCredentials] = useState<SignedCredential[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

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
      for (const cred of localCredentials) {
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
        credentials: localCredentials,
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
          localCredentials={localCredentials}
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
