// frontend/src/features/issuer/components/IssueForm.tsx
import React, { useState } from 'react';
import {
  PlusCircle,
  Search,
  CheckCircle2,
  Lock,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCredentialSchemas } from '@/api/queries/meta';
import { useIssueCredential, useLookupWallet } from '@/api/queries/issuers';
import { toUserMessage } from '@/api/client';
import { Hex } from '@/components/common/Hex';
import { ErrorState } from '@/components/common/ErrorState';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { IssueCredentialIn, IssueCredentialOut } from '@/api/schemas';

interface IssueFormProps {
  issuerId: string;
  onPromptAuth: () => void;
  onIssuedSuccess?: () => void;
}

export const IssueForm: React.FC<IssueFormProps> = ({
  issuerId,
  onPromptAuth,
  onIssuedSuccess,
}) => {
  const { data: schemasData, isLoading: schemasLoading, error: schemasError, refetch: refetchSchemas } = useCredentialSchemas();
  const issueMutation = useIssueCredential(issuerId);

  // Form State
  const [selectedType, setSelectedType] = useState<string>('Degree');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [issuedResult, setIssuedResult] = useState<IssueCredentialOut | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recipient Lookup Query
  const { data: recipient, isLoading: isLookingUp } = useLookupWallet(recipientQuery);

  const schemas = schemasData?.items || [];
  const currentSchema = schemas.find((s) => s.type === selectedType) || schemas[0];

  const handleClaimChange = (fieldName: string, value: string) => {
    setClaims((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIssuedResult(null);

    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }

    if (!recipient?.id) {
      setErrorMsg('Please specify a valid registered recipient wallet.');
      return;
    }

    // Build typed claims payload
    const parsedClaims: Record<string, string | number> = {};
    if (currentSchema?.fields) {
      for (const field of currentSchema.fields) {
        if (field.source === 'claim') {
          const val = claims[field.name];
          if (val !== undefined && val !== '') {
            parsedClaims[field.name] = field.kind === 'int' ? parseInt(val, 10) : val;
          }
        }
      }
    }

    try {
      const result = await issueMutation.mutateAsync({
        credential_type: (currentSchema?.type || selectedType) as IssueCredentialIn['credential_type'],
        wallet_id: recipient.id,
        claims: parsedClaims,
      });

      setIssuedResult(result);
      toast.success(`Credential issued! Added to batch: ${result.batch_id.slice(0, 10)}...`);
      setClaims({});
      if (onIssuedSuccess) onIssuedSuccess();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to sign and issue credential.'));
    }
  };

  if (schemasLoading) {
    return (
      <div className="p-8 text-center text-xs text-[#8ea5a8]">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#79bab6] mb-2" />
        <span>Loading credential schemas...</span>
      </div>
    );
  }

  if (schemasError) return <ErrorState error={schemasError} onRetry={() => refetchSchemas()} />;

  // Filter claim fields for dynamic rendering
  const claimFields = currentSchema?.fields?.filter((f) => f.source === 'claim') || [];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-1">
        <h3 className="text-sm font-semibold text-[#f0f7f7]">BBS+ Signature Issuance</h3>
        <p className="text-xs text-[#8ea5a8]">
          Signs credentials with the active BLS12-381 G2 key. The issued credential commitment is appended to the open batch Merkle tree, and an end-to-end encrypted offer is queued for the student's wallet.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {issuedResult && (
        <div className="p-5 rounded-3xl border border-[#06838d]/40 bg-[#06838d]/10 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6]">
            <Sparkles className="w-4 h-4" />
            <span>Credential Successfully Signed & Queued!</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#8ea5a8]">
            <div className="p-3 rounded-2xl bg-[#130e24]/70 border border-[#231a3d]">
              <span className="block text-[10px] uppercase text-[#8ea5a8]">Credential ID</span>
              <Hex value={issuedResult.credential_id} prefixLen={8} suffixLen={6} />
            </div>
            <div className="p-3 rounded-2xl bg-[#130e24]/70 border border-[#231a3d]">
              <span className="block text-[10px] uppercase text-[#8ea5a8]">Open Batch ID</span>
              <Hex value={issuedResult.batch_id} prefixLen={8} suffixLen={6} />
            </div>
            <div className="p-3 rounded-2xl bg-[#130e24]/70 border border-[#231a3d]">
              <span className="block text-[10px] uppercase text-[#8ea5a8]">Status List Index</span>
              <span className="font-mono text-[#f0f7f7]">#{issuedResult.status_index}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#231a3d]">
          {/* Credential Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              Credential Layout Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setClaims({});
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
            >
              {schemas.map((schema) => (
                <option key={schema.type} value={schema.type} className="bg-[#130e24] text-[#f0f7f7]">
                  {schema.type} (v{schema.version})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#8ea5a8]">
              Schema determines BBS message indices and ZK commitment layout.
            </p>
          </div>

          {/* Recipient Lookup */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              Recipient Wallet (Student Display Name)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder="e.g. asha_sharma"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:outline-hidden focus:border-[#06838d]"
              />
              <div className="absolute right-3 top-3 text-[#8ea5a8] pointer-events-none">
                {isLookingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#79bab6]" />
                ) : recipient?.id ? (
                  <CheckCircle2 className="w-4 h-4 text-[#79bab6]" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </div>
            </div>
            {recipient?.id ? (
              <div className="flex items-center gap-2 text-xs text-[#79bab6]">
                <span>Resolved:</span>
                <span className="font-mono text-[11px]">{recipient.id.slice(0, 8)}...</span>
                <span className="text-[11px] text-[#8ea5a8]">(ECDH key active)</span>
              </div>
            ) : recipientQuery.trim().length >= 2 && !isLookingUp ? (
              <span className="text-xs text-[#ff9f0a]">No holder found with this display name.</span>
            ) : (
              <p className="text-[11px] text-[#8ea5a8]">
                Holder must have registered their wallet key via the Wallet portal.
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Fields Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">
              {currentSchema?.type} Claim Attributes
            </h4>
            <span className="text-[11px] text-[#8ea5a8]">
              Fields marked with <Lock className="w-3 h-3 inline text-[#79bab6]" /> are PII encrypted to holder
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {claimFields.map((field) => {
              const isDate = field.kind === 'date';
              const isInt = field.kind === 'int';

              return (
                <div key={field.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#f0f7f7]">
                      {field.label}
                    </label>
                    {field.pii && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#79bab6] bg-[#06838d]/15 px-2 py-0.5 rounded-full border border-[#06838d]/30">
                        <Lock className="w-2.5 h-2.5" /> PII
                      </span>
                    )}
                  </div>

                  {isDate ? (
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={claims[field.name] || ''}
                        onChange={(e) => handleClaimChange(field.name, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
                      />
                    </div>
                  ) : isInt ? (
                    <input
                      type="number"
                      required
                      value={claims[field.name] || ''}
                      onChange={(e) => handleClaimChange(field.name, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
                    />
                  ) : (
                    <input
                      type="text"
                      required
                      value={claims[field.name] || ''}
                      onChange={(e) => handleClaimChange(field.name, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#231a3d]">
          <button
            type="submit"
            disabled={issueMutation.isPending || !recipient?.id}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-semibold text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            {issueMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>BBS Signing & Queuing Offer...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Sign & Issue Credential</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
