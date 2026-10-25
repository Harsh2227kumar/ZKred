// frontend/src/features/verifier/pages/RequestDetailPage.tsx
import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Building2,
  Calendar,
  KeyRound,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { usePresentationRequest, useVerifications } from '@/api/queries/verifiers';
import { VerificationStages } from '../components/VerificationStages';

export const RequestDetailPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();

  const {
    data: request,
    isLoading: isLoadingRequest,
    error: requestError,
  } = usePresentationRequest(requestId);

  const {
    data: verificationsData,
    isLoading: isLoadingVerifications,
  } = useVerifications(requestId);

  if (isLoadingRequest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-[#79bab6] animate-spin" />
        <p className="text-sm text-[#8ea5a8]">Loading presentation request details...</p>
      </div>
    );
  }

  if (requestError || !request) {
    return (
      <div className="max-w-2xl mx-auto p-6 rounded-3xl border border-[#fb7185]/30 bg-[#fb7185]/10 space-y-3 text-center">
        <AlertCircle className="w-8 h-8 text-[#fb7185] mx-auto" />
        <h3 className="text-base font-semibold text-[#f0f7f7]">Presentation Request Not Found</h3>
        <p className="text-xs text-[#8ea5a8]">
          The requested presentation policy ID could not be retrieved from the verifier registry.
        </p>
        <div className="pt-2">
          <NavLink
            to="/verifier"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#130e24] text-[#f0f7f7] border border-[#231a3d] hover:border-[#79bab6]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Verification Portal
          </NavLink>
        </div>
      </div>
    );
  }

  const verifications = verificationsData?.items || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <NavLink
        to="/verifier"
        className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Verification Portal
      </NavLink>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Verification Evaluation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#06838d]/20 text-[#79bab6] border border-[#06838d]/30">
              Active Request
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#8ea5a8]">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#79bab6]" />
              <span className="text-[#f0f7f7] font-medium">{request.verifier_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Request ID:</span>
              <Hex value={request.id} />
            </div>
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#8ea5a8]" />
              <span>Nonce:</span>
              <span className="font-mono text-[#f0f7f7]">{request.nonce.slice(0, 12)}…</span>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose & Consent Specification Card */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
        <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#79bab6]" />
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Presentation Policy Specification</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#8ea5a8]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Expires: {new Date(request.expires_at).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-[#8ea5a8] uppercase tracking-wider block">Disclosed Purpose</span>
          <p className="text-sm font-medium text-[#f0f7f7] bg-[#090614] p-3 rounded-xl border border-[#231a3d]">
            {request.policy?.purpose || 'Candidate Verification & Credential Evaluation'}
          </p>
        </div>

        {request.consent_summary && (
          <div className="p-3.5 rounded-xl bg-[#06838d]/10 border border-[#06838d]/25 text-xs text-[#79bab6] space-y-1">
            <span className="font-semibold block uppercase tracking-wider text-[10px]">Student Consent Summary</span>
            <p className="leading-relaxed">{request.consent_summary}</p>
          </div>
        )}

        {/* Requirements Breakdown */}
        <div className="space-y-2 pt-2">
          <span className="text-xs text-[#8ea5a8] uppercase tracking-wider block">
            Required Credentials ({request.policy?.requirements?.length || 0})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(request.policy?.requirements || []).map((req) => (
              <div key={req.id} className="p-3.5 rounded-2xl bg-[#090614] border border-[#231a3d] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f0f7f7]">{req.credential_type}</span>
                  <span className="font-mono text-[10px] text-[#79bab6]">{req.id}</span>
                </div>
                <div className="text-[#8ea5a8] space-y-1 text-[11px]">
                  <p>• Accreditation required: {req.accredited_only ? 'Yes' : 'No'}</p>
                  <p>• Revocation checked: {req.require_not_revoked ? 'Yes' : 'No'}</p>
                  <p>
                    • Revealed attributes:{' '}
                    {req.reveal?.length > 0 ? (
                      <span className="font-mono text-[#f0f7f7]">{req.reveal.join(', ')}</span>
                    ) : (
                      <span className="text-[#79bab6]">None (Zero-Knowledge)</span>
                    )}
                  </p>
                  {req.predicates?.some((p) => p.type === 'age_gte') && (
                    <p className="text-[#79bab6]">
                      • ZK Range: Age ≥ {req.predicates.find((p) => p.type === 'age_gte')?.years} years
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Stage Verification Evaluation Chain + Live 2s Polling */}
      <VerificationStages
        request={request}
        verifications={verifications}
        isPolling={!isLoadingVerifications}
      />

      {/* Prominent Privacy-by-Design Card */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] flex items-start gap-4">
        <div className="p-2.5 rounded-2xl bg-[#06838d]/15 text-[#79bab6] shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[#f0f7f7]">Zero-Knowledge Privacy Guarantee</h4>
            <ShieldCheck className="w-4 h-4 text-[#79bab6]" />
          </div>
          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            This verification portal strictly enforces mathematical privacy. Student PII ({' '}
            <span className="font-mono text-[#79bab6]">
              {(request.policy?.never_collect || ['holder_name', 'dob', 'address']).join(', ')}
            </span>{' '}
            ) is never transmitted over the network or stored in databases. Verification is mathematically performed via
            BBS+ blinded signatures, Poseidon Merkle tree inclusion, and Groth16 zk-SNARK range proofs.
          </p>
        </div>
      </div>
    </div>
  );
};
