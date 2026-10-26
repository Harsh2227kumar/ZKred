// frontend/src/features/issuer/components/KeysTab.tsx
import React, { useState } from 'react';
import { RefreshCw, ShieldCheck, ShieldAlert, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRotateKey } from '@/api/queries/issuers';
import { TxLink } from '@/components/common/TxLink';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { Issuer } from '@/api/schemas';

interface KeysTabProps {
  issuer: Issuer;
  onPromptAuth: () => void;
}

export const KeysTab: React.FC<KeysTabProps> = ({ issuer, onPromptAuth }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rotateMutation = useRotateKey(issuer.id);

  const handleRotateKey = async () => {
    setErrorMsg(null);
    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }

    try {
      const newKey = await rotateMutation.mutateAsync();
      toast.success(`Key rotated on Base Sepolia. New epoch: ${newKey.key_id.slice(0, 10)}...`);
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to rotate signing key on-chain.'));
    }
  };

  const activeKey = issuer.keys?.find((k) => k.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-[#231a3d] bg-[#130e24]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#f0f7f7]">BBS+ Signing Key Epochs</h3>
            {activeKey && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                <ShieldCheck className="w-3 h-3" /> Active Epoch
              </span>
            )}
          </div>
          <p className="text-xs text-[#8ea5a8]">
            BLS12-381 G2 keypairs registered with the on-chain IssuerRegistry on Base Sepolia.
          </p>
        </div>

        <button
          onClick={handleRotateKey}
          disabled={rotateMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1a1430] hover:bg-[#231a3d] border border-[#231a3d] text-xs font-medium text-[#f0f7f7] hover:border-[#06838d]/40 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#79bab6] ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
          <span>{rotateMutation.isPending ? 'Rotating on Base Sepolia...' : 'Rotate Signing Key'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Keys Table */}
      <div className="rounded-3xl border border-[#231a3d] bg-[#130e24] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-[#8ea5a8] border-b border-[#231a3d]">
              <tr>
                <th className="p-4">Key ID</th>
                <th className="p-4">Status</th>
                <th className="p-4">Public Key Hash</th>
                <th className="p-4">Active From</th>
                <th className="p-4">On-Chain Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#231a3d]">
              {issuer.keys && issuer.keys.length > 0 ? (
                issuer.keys.map((k) => (
                  <tr key={k.key_id} className="hover:bg-[#1a1430]/60 transition-colors">
                    <td className="p-4 font-mono text-xs text-[#f0f7f7]">
                      <Hex value={k.key_id} prefixLen={8} suffixLen={6} />
                    </td>
                    <td className="p-4">
                      {k.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      ) : k.status === 'compromised' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff453a] bg-[#ff453a]/10 px-2.5 py-0.5 rounded-full border border-[#ff453a]/20">
                          <ShieldAlert className="w-3 h-3" /> Compromised
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8ea5a8] bg-[#1a1430] px-2.5 py-0.5 rounded-full border border-[#231a3d]">
                          <Clock className="w-3 h-3" /> Rotated
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                      <Hex value={k.public_key} prefixLen={8} suffixLen={6} />
                    </td>
                    <td className="p-4 text-xs text-[#8ea5a8]">
                      {new Date(k.active_from).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <TxLink hash={k.tx_hash} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xs text-[#8ea5a8]">
                    No key epochs registered for this institution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
