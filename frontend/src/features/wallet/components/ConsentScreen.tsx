// frontend/src/features/wallet/components/ConsentScreen.tsx
import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  Lock,
  Sparkles,
  Building2,
  Calendar,
  KeyRound,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Info,
  Check,
  Loader2,
} from 'lucide-react';
import type { PresentationRequest } from '@/api/schemas';
import type { SignedCredential } from '@/lib/wallet-crypto';
import { toast } from 'sonner';

interface ConsentScreenProps {
  request: PresentationRequest;
  localCredentials: SignedCredential[];
  onStartProving?: () => void;
  isProving?: boolean;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  request,
  localCredentials,
  onStartProving,
  isProving = false,
}) => {
  const [showConsentModal, setShowConsentModal] = useState(false);

  const requirements = request.policy?.requirements || [];
  const neverCollectFields = request.policy?.never_collect || ['holder_name', 'dob', 'address'];

  // Check matching status for each requirement (checking credential type and equality constraints)
  const requirementMatches = requirements.map((req) => {
    const matched = localCredentials.find((c) => {
      if (c.type !== req.credential_type) return false;
      if (req.equals && req.equals.length > 0) {
        return req.equals.every((eq) => String(c.values?.[eq.field] ?? '') === eq.value);
      }
      return true;
    });
    return {
      requirement: req,
      matchedCredential: matched || null,
      isSatisfied: Boolean(matched),
    };
  });

  const allSatisfied = requirementMatches.every((m) => m.isSatisfied);

  const handleAuthorizeClick = () => {
    if (!allSatisfied) {
      toast.error('You do not possess all credentials required by this policy.');
      return;
    }
    setShowConsentModal(true);
  };

  const handleConfirmConsent = () => {
    setShowConsentModal(false);
    if (onStartProving) {
      onStartProving();
    }
  };

  return (
    <div className="space-y-6">
      {/* Verifier & Purpose Card */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#231a3d] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#8ea5a8] uppercase tracking-wider block">Evaluating Agency</span>
              <h2 className="text-base font-semibold text-[#f0f7f7]">{request.verifier_name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#8ea5a8]">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#79bab6]" />
              <span>Expires: {new Date(request.expires_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <KeyRound className="w-3 h-3 text-[#8ea5a8]" />
              <span>Nonce: {request.nonce.slice(0, 8)}…</span>
            </div>
          </div>
        </div>

        {/* Disclosed Verification Purpose */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#79bab6]" />
            <h3 className="text-xs font-semibold text-[#f0f7f7] uppercase tracking-wider">
              Verification Purpose
            </h3>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#090614] border border-[#231a3d] text-sm text-[#f0f7f7] font-medium leading-relaxed">
            {request.policy?.purpose || 'Academic & Professional Credential Verification'}
          </div>
        </div>

        {request.consent_summary && (
          <div className="p-3.5 rounded-2xl bg-[#06838d]/10 border border-[#06838d]/30 text-xs text-[#79bab6] space-y-1">
            <span className="font-semibold block uppercase tracking-wider text-[10px]">Consent Statement</span>
            <p className="leading-relaxed">{request.consent_summary}</p>
          </div>
        )}
      </div>

      {/* Local Credential Matching & Wallet Readiness */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
        <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#79bab6]" />
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Required Credentials & Wallet Match</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              allSatisfied
                ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                : 'bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30'
            }`}
          >
            {allSatisfied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{allSatisfied ? 'Ready to Respond' : 'Incomplete Credentials'}</span>
          </span>
        </div>

        <div className="space-y-3">
          {requirementMatches.map(({ requirement, matchedCredential, isSatisfied }, idx) => (
            <div
              key={requirement.id || idx}
              className={`p-4 rounded-2xl border transition-all ${
                isSatisfied
                  ? 'border-[#10b981]/30 bg-[#10b981]/5'
                  : 'border-[#fb7185]/30 bg-[#fb7185]/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#f0f7f7]">
                      {requirement.credential_type}
                    </span>
                    <span className="text-[10px] font-mono text-[#8ea5a8]">
                      ({requirement.id})
                    </span>
                  </div>

                  {requirement.equals && requirement.equals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {requirement.equals.map((eq) => (
                        <span
                          key={eq.field}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#231a3d] text-[#f0f7f7] border border-[#79bab6]/30"
                        >
                          Requires {eq.field} = "{eq.value}"
                        </span>
                      ))}
                    </div>
                  )}

                  {matchedCredential ? (
                    <p className="text-xs text-[#79bab6] mt-1">
                      Matched from wallet:{' '}
                      <span className="font-medium">
                        {matchedCredential.values?.degree_name ||
                          matchedCredential.values?.license_type ||
                          (matchedCredential.values?.nationality ? `National ID (${matchedCredential.values.nationality})` : null) ||
                          matchedCredential.type}
                      </span>
                      {matchedCredential.values?.institution && ` (${matchedCredential.values.institution})`}
                    </p>
                  ) : (
                    <p className="text-xs text-[#fb7185] mt-1">
                      No matching {requirement.credential_type} {requirement.equals?.length ? 'meeting criteria' : ''} found in local IndexedDB.
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {isSatisfied ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#10b981] font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[#fb7185] font-medium">
                      <XCircle className="w-4 h-4" /> Missing
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Tier Privacy & Disclosure Breakdown */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-5">
        <div className="border-b border-[#231a3d] pb-3">
          <h3 className="text-sm font-semibold text-[#f0f7f7]">3-Tier Disclosure Architecture</h3>
          <p className="text-xs text-[#8ea5a8] mt-0.5">
            Cryptographic guarantees ensuring minimal data disclosure.
          </p>
        </div>

        <div className="space-y-4">
          {/* Tier 1: Selectively Disclosed */}
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6] uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                <span>Tier 1: Selectively Disclosed Fields</span>
              </div>
              <span className="text-[10px] font-mono text-[#8ea5a8]">BBS+ Blinded Signature</span>
            </div>
            <p className="text-xs text-[#8ea5a8]">
              These specific attributes will be visible in plaintext to the verifier:
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {requirements.flatMap((r) => r.reveal).length > 0 ? (
                requirements.flatMap((r) =>
                  r.reveal.map((f) => (
                    <span
                      key={`${r.id}-${f}`}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#06838d]/20 text-[#79bab6] border border-[#06838d]/30"
                    >
                      {f}
                    </span>
                  ))
                )
              ) : (
                <span className="text-xs text-[#79bab6] font-medium">
                  None (100% Zero-Knowledge verification).
                </span>
              )}
            </div>
          </div>

          {/* Tier 2: Proven in Zero-Knowledge */}
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6] uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#79bab6]" />
                <span>Tier 2: Proven in Zero-Knowledge (Groth16 zk-SNARK)</span>
              </div>
              <span className="text-[10px] font-mono text-[#8ea5a8]">Circom Range Proofs</span>
            </div>
            <p className="text-xs text-[#8ea5a8]">
              The verifier receives mathematical proof that criteria are satisfied. Your underlying data is never sent:
            </p>

            <div className="space-y-2 pt-1 text-xs">
              {requirements.some((r) => r.predicates?.some((p) => p.type === 'age_gte')) ? (
                requirements.map(
                  (r) =>
                    r.predicates?.find((p) => p.type === 'age_gte') && (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl bg-[#130e24] border border-[#231a3d] flex items-center justify-between"
                      >
                        <span className="text-[#f0f7f7]">
                          Age Verification: Proves age is at least{' '}
                          <strong>{r.predicates.find((p) => p.type === 'age_gte')?.years} years</strong>
                        </span>
                        <span className="text-[10px] text-[#79bab6] font-mono">DOB strictly hidden</span>
                      </div>
                    )
                )
              ) : (
                <div className="p-2.5 rounded-xl bg-[#130e24] border border-[#231a3d] text-[#8ea5a8]">
                  Batch inclusion & on-chain active credential status proven without tracking.
                </div>
              )}
            </div>
          </div>

          {/* Tier 3: Never Collected / Stays on Device */}
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Tier 3: Never Disclosed / Stays on Device</span>
              </div>
              <span className="text-[10px] font-mono text-[#8ea5a8]">Client-Side Only</span>
            </div>
            <p className="text-xs text-[#8ea5a8]">
              These protected PII attributes remain encrypted in your local browser storage and are never sent:
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {neverCollectFields.map((field) => (
                <span
                  key={field}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#130e24] text-[#8ea5a8] border border-[#231a3d]"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action / Share Proof Button */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={!allSatisfied || isProving}
          onClick={handleAuthorizeClick}
          className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-sm transition-all shadow-lg ${
            isProving
              ? 'bg-[#06838d]/50 text-white cursor-wait'
              : allSatisfied
              ? 'bg-linear-to-r from-[#06838d] to-[#046168] hover:opacity-95 text-white shadow-[#06838d]/20 cursor-pointer'
              : 'bg-[#06838d]/30 text-[#8ea5a8] border border-[#231a3d] cursor-not-allowed opacity-60'
          }`}
        >
          {isProving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
              <span>Generating Zero-Knowledge Proof...</span>
            </span>
          ) : allSatisfied ? (
            <span className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5" />
              <span>Authorize & Sign Zero-Knowledge Presentation</span>
            </span>
          ) : (
            <span>Missing Required Credentials in Wallet</span>
          )}
        </button>

        {!allSatisfied && (
          <p className="text-center text-xs text-[#fb7185]">
            Your student wallet must contain all requested credentials before generating a proof.
          </p>
        )}
      </div>

      {/* Interactive Consent Confirmation Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#79bab6]" />
                <h3 className="text-base font-semibold text-[#f0f7f7]">Confirm Proof Disclosure</h3>
              </div>
              <p className="text-xs text-[#8ea5a8]">
                You are authorizing zero-knowledge verification for <strong>{request.verifier_name}</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#090614] border border-[#231a3d] text-xs space-y-2">
              <span className="text-[11px] text-[#8ea5a8] uppercase font-mono block">Verification Summary</span>
              <p className="text-[#f0f7f7]">
                • Disclosed fields:{' '}
                <span className="text-[#79bab6]">
                  {requirements.flatMap((r) => r.reveal).join(', ') || 'None'}
                </span>
              </p>
              <p className="text-[#f0f7f7]">
                • Protected PII:{' '}
                <span className="text-[#8ea5a8]">
                  {neverCollectFields.join(', ')} (Never transmitted)
                </span>
              </p>
              <p className="text-[#f0f7f7]">
                • Proof generation:{' '}
                <span className="text-[#79bab6]">BBS+ Blinded Proof + Groth16 zk-SNARK</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#06838d]/10 border border-[#06838d]/25 text-xs text-[#79bab6] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Zero-knowledge proof calculation executes entirely in your browser. Sensitive PII never leaves this device.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8ea5a8] hover:text-[#f0f7f7] bg-[#1a1430] hover:bg-[#231a3d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConsent}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#06838d] hover:bg-[#046168] transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Sign</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
