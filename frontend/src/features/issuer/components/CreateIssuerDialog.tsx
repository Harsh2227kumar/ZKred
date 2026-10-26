// frontend/src/features/issuer/components/CreateIssuerDialog.tsx
import React, { useState } from 'react';
import { X, GraduationCap, Loader2, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateIssuer } from '@/api/queries/issuers';
import { useEnums } from '@/api/queries/meta';
import { ChainName } from '@/components/common/ChainName';
import { toUserMessage } from '@/api/client';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { IssuerKind } from '@/api/schemas';

interface CreateIssuerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptAuth: () => void;
}

export const CreateIssuerDialog: React.FC<CreateIssuerDialogProps> = ({
  isOpen,
  onClose,
  onPromptAuth,
}) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<IssuerKind>('university');
  const [didSuffix, setDidSuffix] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: enums } = useEnums();
  const createMutation = useCreateIssuer();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }

    const cleanSuffix = didSuffix.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSuffix)) {
      setErrorMsg('DID suffix must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    try {
      const issuer = await createMutation.mutateAsync({
        name: name.trim(),
        kind,
        did_suffix: cleanSuffix,
      });

      toast.success(`Institution registered on-chain: ${issuer.name}`);
      setName('');
      setDidSuffix('');
      onClose();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to register institution.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#231a3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f7f7]">Register New Institution</h2>
              <p className="text-xs text-[#8ea5a8]">Generates governance wallet & BBS keys on <ChainName /></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] hover:bg-[#1a1430] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              Institution Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Indian Institute of Information Technology, Nagpur"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:outline-hidden focus:border-[#06838d]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              Authority Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as IssuerKind)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
            >
              {enums?.issuer_kinds?.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#130e24] text-[#f0f7f7]">
                  {opt.label}
                </option>
              )) || (
                <>
                  <option value="university">University / Higher Education</option>
                  <option value="medical_council">Medical Council</option>
                  <option value="government">Government Body</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              DID Suffix
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 rounded-l-xl border border-r-0 border-[#231a3d] bg-[#1a1430] text-xs text-[#8ea5a8] select-none">
                did:zkred:
              </span>
              <input
                type="text"
                required
                minLength={3}
                maxLength={60}
                value={didSuffix}
                onChange={(e) => setDidSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="iiit-nagpur"
                className="w-full px-3.5 py-2.5 rounded-r-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:outline-hidden focus:border-[#06838d]"
              />
            </div>
            <p className="text-[11px] text-[#8ea5a8]">
              Decentralized Identifier used across the ZK selective disclosure proofs.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#231a3d]">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-xl border border-[#231a3d] bg-[#1a1430] text-xs font-medium text-[#f0f7f7] hover:bg-[#231a3d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering On-Chain...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Institution</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
