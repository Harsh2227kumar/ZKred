// frontend/src/features/issuer/components/KeysTab.tsx
// BBS+ key epochs from IssuerRegistry: planned rotation, and "Report compromise" per key (CompromiseDialog), whose
// last report stays on screen so the issuer can read the batch verdicts after closing the dialog.
import React, { useState } from 'react';
import { RefreshCw, ShieldCheck, ShieldAlert, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRotateKey } from '@/api/queries/issuers';
import { ChainName } from '@/components/common/ChainName';
import { TxLink } from '@/components/common/TxLink';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { CompromiseReport, Issuer, IssuerKey } from '@/api/schemas';
import { CompromiseDialog } from './CompromiseDialog';
import { CompromiseReportView } from './CompromiseReportView';

interface KeysTabProps {
  issuer: Issuer;
  onPromptAuth: () => void;
}

const StatusBadge: React.FC<{ status: IssuerKey['status'] }> = ({ status }) =>
  status === 'active' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
      <ShieldCheck className="w-3 h-3" /> Active
    </span>
  ) : status === 'compromised' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff453a] bg-[#ff453a]/10 px-2.5 py-0.5 rounded-full border border-[#ff453a]/20">
      <ShieldAlert className="w-3 h-3" /> Compromised
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8ea5a8] bg-[#1a1430] px-2.5 py-0.5 rounded-full border border-[#231a3d]">
      <Clock className="w-3 h-3" /> Rotated
    </span>
  );

export const KeysTab: React.FC<KeysTabProps> = ({ issuer, onPromptAuth }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState<IssuerKey | null>(null);
  const [lastReport, setLastReport] = useState<CompromiseReport | null>(null);
  const rotateMutation = useRotateKey(issuer.id);

  const handleRotateKey = async () => {
    setErrorMsg(null);
    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }
    try {
      const newKey = await rotateMutation.mutateAsync();
      toast.success(`Key rotated. New epoch: ${newKey.key_id.slice(0, 10)}...`, { description: <TxLink hash={newKey.tx_hash} /> });
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to rotate signing key on-chain.'));
    }
  };

  const openReport = (key: IssuerKey) => {
    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }
    setReporting(key);
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
            BLS12-381 G2 keypairs registered with the on-chain IssuerRegistry on <ChainName />. If a signing key leaks, report it: one
            transaction isolates everything it anchored inside the window.
          </p>
        </div>

        <button
          onClick={handleRotateKey}
          disabled={rotateMutation.isPending || !activeKey}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1a1430] hover:bg-[#231a3d] border border-[#231a3d] text-xs font-medium text-[#f0f7f7] hover:border-[#06838d]/40 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#79bab6] ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
          <span>{rotateMutation.isPending ? 'Rotating on-chain...' : 'Rotate Signing Key'}</span>
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
                <th className="p-4 hidden 2xl:table-cell">Public Key</th>
                <th className="p-4">Active From</th>
                <th className="p-4">Compromised From</th>
                <th className="p-4">On-Chain Tx</th>
                <th className="p-4 text-right">Breach</th>
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
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8] hidden 2xl:table-cell">
                      <Hex value={k.public_key} prefixLen={8} suffixLen={6} />
                    </td>
                    <td className="p-4 text-xs text-[#8ea5a8] whitespace-nowrap">{new Date(k.active_from).toLocaleString()}</td>
                    <td className="p-4 text-xs whitespace-nowrap">
                      {k.compromised_from ? (
                        <span className="text-[#ff453a]">{new Date(k.compromised_from).toLocaleString()}</span>
                      ) : (
                        <span className="text-[#8ea5a8]">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <TxLink hash={k.tx_hash} />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => openReport(k)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap border border-[#ff453a]/30 text-[#ff453a] bg-[#ff453a]/10 hover:bg-[#ff453a]/20 transition-colors cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {k.status === 'compromised' ? 'Widen window' : 'Report compromise'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-[#8ea5a8]">
                    No key epochs registered for this institution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lastReport && (
        <section className="p-5 rounded-3xl border border-[#ff453a]/25 bg-[#130e24] space-y-4" aria-label="Last compromise report">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#f0f7f7]">
              Last compromise report: key <Hex value={lastReport.key_id} />
            </h3>
            <button type="button" onClick={() => setLastReport(null)} className="text-[11px] text-[#8ea5a8] hover:text-[#f0f7f7]">
              Dismiss
            </button>
          </div>
          <CompromiseReportView report={lastReport} />
        </section>
      )}

      {reporting && (
        <CompromiseDialog
          issuerId={issuer.id}
          keyId={reporting.key_id}
          alreadyCompromised={reporting.status === 'compromised'}
          onClose={() => setReporting(null)}
          onReported={setLastReport}
        />
      )}
    </div>
  );
};
