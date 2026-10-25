// frontend/src/features/verifier/components/CreateVerifierModal.tsx
import React, { useState } from 'react';
import { X, Building2, Plus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateVerifier } from '@/api/queries/verifiers';
import { toUserMessage } from '@/api/client';

interface CreateVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (verifierId: string) => void;
}

export const CreateVerifierModal: React.FC<CreateVerifierModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useCreateVerifier();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      setErrorMsg('Verifier name must be between 2 and 120 characters.');
      return;
    }

    try {
      const verifier = await createMutation.mutateAsync({ name: cleanName });
      toast.success(`Verifier identity registered: ${verifier.name}`);
      setName('');
      if (onCreated) onCreated(verifier.id);
      onClose();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to create verifier identity.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#231a3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f7f7]">New Verifier Identity</h2>
              <p className="text-xs text-[#8ea5a8]">Employer, government, or evaluating agency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] hover:bg-[#1a1430] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8ea5a8] uppercase tracking-wider block">
              Organization / Company Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Apex Healthcare Careers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#231a3d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#231a3d] bg-[#1a1430] text-xs font-medium text-[#f0f7f7] hover:bg-[#231a3d] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Verifier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
