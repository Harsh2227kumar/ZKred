// frontend/src/features/verifier/components/ManualPolicyBuilder.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useCredentialSchemas } from '@/api/queries/meta';
import { useCreateRequest } from '@/api/queries/verifiers';
import type { PresentationPolicy, PresentationRequirement, PresentationRequest } from '@/api/schemas';
import { toast } from 'sonner';

interface ManualPolicyBuilderProps {
  verifierId: string;
  initialPolicy?: PresentationPolicy | null;
  nlPrompt?: string;
  onSuccess: (request: PresentationRequest) => void;
}

export const ManualPolicyBuilder: React.FC<ManualPolicyBuilderProps> = ({
  verifierId,
  initialPolicy,
  nlPrompt,
  onSuccess,
}) => {
  const { data: schemasData, isLoading: isLoadingSchemas } = useCredentialSchemas();
  const createRequestMutation = useCreateRequest();

  const [purpose, setPurpose] = useState(
    initialPolicy?.purpose || 'Candidate Verification & Zero-Knowledge Credential Validation'
  );

  const [neverCollect, setNeverCollect] = useState<string[]>(
    initialPolicy?.never_collect && initialPolicy.never_collect.length > 0
      ? initialPolicy.never_collect
      : ['holder_name', 'dob', 'address']
  );

  const [requirements, setRequirements] = useState<PresentationRequirement[]>(
    initialPolicy?.requirements && initialPolicy.requirements.length > 0
      ? initialPolicy.requirements
      : [
          {
            id: 'r1',
            credential_type: 'Degree',
            accredited_only: true,
            issuer_kinds: null,
            issuer_dids: null,
            reveal: [],
            equals: [],
            predicates: [],
            require_not_revoked: true,
          },
        ]
  );

  // When initialPolicy changes (e.g. from compiler), sync state
  useEffect(() => {
    if (initialPolicy) {
      if (initialPolicy.purpose) setPurpose(initialPolicy.purpose);
      if (initialPolicy.never_collect) setNeverCollect(initialPolicy.never_collect);
      if (initialPolicy.requirements) setRequirements(initialPolicy.requirements);
    }
  }, [initialPolicy]);

  const schemas = schemasData?.items || [];

  const handleAddRequirement = () => {
    const nextId = `r${requirements.length + 1}`;
    const defaultType = schemas[0]?.type || 'Degree';
    setRequirements((prev) => [
      ...prev,
      {
        id: nextId,
        credential_type: defaultType,
        accredited_only: true,
        issuer_kinds: null,
        issuer_dids: null,
        reveal: [],
        equals: [],
        predicates: [],
        require_not_revoked: true,
      },
    ]);
  };

  const handleRemoveRequirement = (index: number) => {
    if (requirements.length <= 1) {
      toast.error('Policy must have at least one credential requirement');
      return;
    }
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, patch: Partial<PresentationRequirement>) => {
    setRequirements((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const toggleRevealField = (reqIndex: number, fieldName: string) => {
    if (neverCollect.includes(fieldName)) {
      toast.error(`Cannot reveal "${fieldName}" because it is flagged under Never-Collect privacy policy`);
      return;
    }

    const currentReveal = requirements[reqIndex].reveal;
    const nextReveal = currentReveal.includes(fieldName)
      ? currentReveal.filter((f) => f !== fieldName)
      : [...currentReveal, fieldName];

    updateRequirement(reqIndex, { reveal: nextReveal });
  };

  const toggleAgePredicate = (reqIndex: number, enabled: boolean) => {
    if (enabled) {
      updateRequirement(reqIndex, {
        predicates: [{ type: 'age_gte', years: 21 }],
      });
    } else {
      updateRequirement(reqIndex, { predicates: [] });
    }
  };

  const updateAgeYears = (reqIndex: number, years: number) => {
    updateRequirement(reqIndex, {
      predicates: [{ type: 'age_gte', years: Math.max(1, Math.min(120, years)) }],
    });
  };

  const toggleNeverCollect = (field: string) => {
    setNeverCollect((prev) => {
      if (prev.includes(field)) {
        return prev.filter((f) => f !== field);
      } else {
        // Remove from any reveal list to preserve reveal ∩ never_collect = ∅
        setRequirements((reqs) =>
          reqs.map((r) => ({
            ...r,
            reveal: r.reveal.filter((f) => f !== field),
          }))
        );
        return [...prev, field];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifierId) {
      toast.error('Please select an active Verifier department first');
      return;
    }

    if (!purpose.trim()) {
      toast.error('Please enter a verification purpose for student consent disclosure');
      return;
    }

    // Verify disjoint sets: reveal ∩ never_collect == ∅
    for (const req of requirements) {
      const conflict = req.reveal.filter((f) => neverCollect.includes(f));
      if (conflict.length > 0) {
        toast.error(`Conflict: Field "${conflict[0]}" cannot be in both Reveal and Never-Collect`);
        return;
      }
    }

    const policy: PresentationPolicy = {
      purpose: purpose.trim(),
      requirements: requirements as PresentationPolicy['requirements'],
      never_collect: neverCollect,
    };

    try {
      const result = await createRequestMutation.mutateAsync({
        verifier_id: verifierId,
        policy,
        nl_text: nlPrompt?.trim() || null,
      });

      toast.success('Zero-knowledge presentation request published');
      onSuccess(result);
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error: { message: string } }).error.message
          : 'Failed to create presentation request';
      toast.error(errorMsg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Purpose */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#f0f7f7] uppercase tracking-wider flex items-center justify-between">
          <span>Verification Purpose (Presented to Student)</span>
          <span className="text-[11px] text-[#8ea5a8] normal-case">Enforces explicit consent</span>
        </label>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          required
          placeholder="e.g. Graduate Admissions Academic Qualification Assessment"
          className="w-full px-4 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
        />
      </div>

      {/* Never-Collect Guardrails (Privacy-by-Design) */}
      <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#79bab6]" />
            <span className="text-xs font-semibold text-[#f0f7f7]">Zero-Knowledge Privacy Guardrails (Never-Collect)</span>
          </div>
          <span className="text-[11px] text-[#8ea5a8]">Cryptographically shielded</span>
        </div>
        <p className="text-xs text-[#8ea5a8]">
          Selected fields are mathematically protected and will never be revealed or transferred:
        </p>
        <div className="flex flex-wrap gap-2">
          {['holder_name', 'dob', 'address', 'id_number', 'phone'].map((field) => {
            const isProtected = neverCollect.includes(field);
            return (
              <button
                type="button"
                key={field}
                onClick={() => toggleNeverCollect(field)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                  isProtected
                    ? 'bg-[#06838d]/20 text-[#79bab6] border border-[#06838d]/40'
                    : 'bg-[#130e24] text-[#8ea5a8] border border-[#231a3d] hover:border-[#8ea5a8]/40'
                }`}
              >
                {isProtected && <Check className="w-3 h-3" />}
                <span>{field}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#f0f7f7] uppercase tracking-wider">
            Credential Requirements ({requirements.length})
          </h4>
          <button
            type="button"
            onClick={handleAddRequirement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#79bab6] bg-[#06838d]/10 hover:bg-[#06838d]/20 border border-[#06838d]/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Requirement</span>
          </button>
        </div>

        {requirements.map((req, rIdx) => {
          const currentSchema = schemas.find((s) => s.type === req.credential_type);
          const hasAgePredicate = req.predicates.some((p) => p.type === 'age_gte');
          const agePredicate = req.predicates.find((p) => p.type === 'age_gte');

          return (
            <div
              key={req.id || rIdx}
              className="p-5 rounded-2xl border border-[#231a3d] bg-[#1a1430]/40 space-y-4 relative group"
            >
              <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
                <span className="text-xs font-mono font-bold text-[#79bab6]">Requirement #{rIdx + 1} ({req.id})</span>
                {requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRequirement(rIdx)}
                    className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#fb7185] hover:bg-[#fb7185]/10 transition-colors"
                    title="Remove requirement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Credential Type */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8ea5a8]">Credential Type</label>
                  <select
                    value={req.credential_type}
                    onChange={(e) => {
                      updateRequirement(rIdx, {
                        credential_type: e.target.value,
                        reveal: [], // reset reveals when type changes
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#231a3d] bg-[#090614] text-xs text-[#f0f7f7] focus:border-[#79bab6] focus:outline-hidden"
                  >
                    {schemas.map((s) => (
                      <option key={s.type} value={s.type}>
                        {s.type} (v{s.version})
                      </option>
                    ))}
                    {schemas.length === 0 && (
                      <>
                        <option value="Degree">Degree</option>
                        <option value="MedicalLicense">MedicalLicense</option>
                        <option value="GovernmentId">GovernmentId</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Verification Toggles */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs text-[#8ea5a8] block">Security Rules</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#f0f7f7]">
                      <input
                        type="checkbox"
                        checked={req.accredited_only}
                        onChange={(e) => updateRequirement(rIdx, { accredited_only: e.target.checked })}
                        className="rounded border-[#231a3d] bg-[#090614] text-[#06838d] focus:ring-[#79bab6]"
                      />
                      <span>Require On-Chain Accredited Issuer</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#f0f7f7]">
                      <input
                        type="checkbox"
                        checked={req.require_not_revoked}
                        onChange={(e) => updateRequirement(rIdx, { require_not_revoked: e.target.checked })}
                        className="rounded border-[#231a3d] bg-[#090614] text-[#06838d] focus:ring-[#79bab6]"
                      />
                      <span>Enforce Real-Time Revocation Bitstring Check</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Revealable Fields */}
              <div className="space-y-2 pt-2 border-t border-[#231a3d]">
                <label className="text-xs font-medium text-[#f0f7f7] flex items-center justify-between">
                  <span>Selectively Disclosed Fields</span>
                  <span className="text-[11px] text-[#8ea5a8]">Unchecked fields remain Zero-Knowledge</span>
                </label>

                {currentSchema && currentSchema.fields.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {currentSchema.fields.map((f) => {
                      const isNeverCollect = neverCollect.includes(f.name);
                      const isRevealed = req.reveal.includes(f.name);

                      return (
                        <button
                          key={f.name}
                          type="button"
                          disabled={isNeverCollect}
                          onClick={() => toggleRevealField(rIdx, f.name)}
                          className={`flex items-center justify-between p-2 rounded-xl text-left border text-xs transition-colors ${
                            isNeverCollect
                              ? 'opacity-40 bg-[#090614] border-[#231a3d] text-[#8ea5a8] cursor-not-allowed'
                              : isRevealed
                              ? 'bg-[#06838d]/20 border-[#06838d]/50 text-[#79bab6]'
                              : 'bg-[#090614] border-[#231a3d] text-[#8ea5a8] hover:border-[#8ea5a8]/40'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono">{f.name}</span>
                            <span className="block text-[10px] text-[#8ea5a8]">{f.label}</span>
                          </div>
                          {isRevealed && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-[#79bab6]" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#8ea5a8]">
                    {isLoadingSchemas ? 'Loading credential schema fields...' : 'No schema fields available'}
                  </p>
                )}
              </div>

              {/* Zero-Knowledge Age Predicate */}
              <div className="p-3 rounded-xl border border-[#231a3d] bg-[#090614] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#f0f7f7]">
                    <input
                      type="checkbox"
                      checked={hasAgePredicate}
                      onChange={(e) => toggleAgePredicate(rIdx, e.target.checked)}
                      className="rounded border-[#231a3d] bg-[#090614] text-[#06838d] focus:ring-[#79bab6]"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-[#79bab6]" />
                    <span>Zero-Knowledge Range Proof (Age Verification)</span>
                  </label>
                  <span className="text-[11px] text-[#8ea5a8]">Proves age without revealing DOB</span>
                </div>

                {hasAgePredicate && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-[#8ea5a8]">Require minimum age:</span>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={agePredicate?.years || 21}
                      onChange={(e) => updateAgeYears(rIdx, parseInt(e.target.value, 10) || 21)}
                      className="w-20 px-2 py-1 rounded-lg border border-[#231a3d] bg-[#130e24] text-xs text-[#f0f7f7] text-center focus:border-[#79bab6] focus:outline-hidden"
                    />
                    <span className="text-xs text-[#8ea5a8]">years old</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={createRequestMutation.isPending || !verifierId}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-linear-to-r from-[#06838d] to-[#046168] hover:opacity-95 shadow-lg shadow-[#06838d]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createRequestMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Publishing Presentation Request...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Create Presentation Request</span>
            </>
          )}
        </button>

        {!verifierId && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-[#fb7185] mt-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Select or create a Verifier department before creating a request.</span>
          </p>
        )}
      </div>
    </form>
  );
};
