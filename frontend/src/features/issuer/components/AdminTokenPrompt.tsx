// frontend/src/features/issuer/components/AdminTokenPrompt.tsx
import React, { useState } from 'react';
import { Key, X, Lock, CheckCircle2, Trash2 } from 'lucide-react';
import { getAdminToken, setAdminToken, clearAdminToken } from '@/lib/storage/session-token';

interface AdminTokenPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AdminTokenPrompt: React.FC<AdminTokenPromptProps> = ({ isOpen, onClose, onSaved }) => {
  const [tokenInput, setTokenInput] = useState(() => getAdminToken());
  const [hasToken, setHasToken] = useState(() => Boolean(getAdminToken()));

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminToken(tokenInput);
    setHasToken(Boolean(tokenInput.trim()));
    if (onSaved) onSaved();
    onClose();
  };

  const handleClear = () => {
    clearAdminToken();
    setTokenInput('');
    setHasToken(false);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#231a3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f7f7]">Issuer Admin Authentication</h2>
              <p className="text-xs text-[#8ea5a8]">Stored only in sessionStorage for this tab.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] hover:bg-[#1a1430] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">
              Admin Token (Bearer Auth)
            </label>
            <div className="relative">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter ISSUER_ADMIN_TOKEN"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:outline-hidden focus:border-[#06838d] transition-colors"
                autoFocus
              />
              <Lock className="w-4 h-4 absolute right-3 top-3 text-[#8ea5a8] pointer-events-none" />
            </div>
            <p className="text-[11px] text-[#8ea5a8]/80 leading-relaxed">
              Required for registering issuers, rotating keys, issuing credentials, and anchoring batches. Never written to disk or transmitted outside the <code className="text-[#79bab6]">Authorization</code> header.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {hasToken ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#ff453a] hover:bg-[#ff453a]/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Token
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#231a3d] bg-[#1a1430] text-xs font-medium text-[#f0f7f7] hover:bg-[#231a3d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 transition-opacity shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save Session
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
