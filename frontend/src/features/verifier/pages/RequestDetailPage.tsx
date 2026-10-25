import { useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Clock, ShieldCheck, Lock } from 'lucide-react';
import { Hex } from '@/components/common/Hex';

export const RequestDetailPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();

  // 4 Nodes of the Evaluation Chain
  const evalChainNodes = [
    { id: 1, title: '1. Issuer Signature', desc: 'BBS+ BLS12-381 key epoch validity', status: 'pending' },
    { id: 2, title: '2. ZK Range Claim', desc: 'Circom Groth16 proof (Age ≥ 21)', status: 'pending' },
    { id: 3, title: '3. Revocation Status', desc: 'Bitstring herd-privacy status list', status: 'pending' },
    { id: 4, title: '4. Key-Epoch / Anchor', desc: 'Base Sepolia batch Merkle root check', status: 'pending' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <NavLink to="/verifier" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Verifier Portal
      </NavLink>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Verification Evaluation</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>Request Nonce / ID:</span>
            <Hex value={requestId || ''} />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>Awaiting Holder Submission</span>
        </div>
      </div>

      {/* Evaluation Chain Visualizer */}
      <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-foreground">The 4-Node Zero-Knowledge Evaluation Chain</h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Deterministic Pipeline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {evalChainNodes.map((node) => (
            <div
              key={node.id}
              className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2 flex flex-col justify-between"
            >
              <div>
                <span className="text-[11px] font-mono text-muted-foreground block mb-1">STAGE {node.id}</span>
                <h4 className="text-sm font-semibold text-foreground">{node.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{node.desc}</p>
              </div>
              <div className="pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span>Pending proof</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prominent Data Minimization Security Card */}
      <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3.5">
        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">Privacy Guarantee: Data Never Received</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This verification engine will <strong>never receive or process</strong> the holder's full legal name, date of birth, or residential address.
            Verification succeeds strictly through cryptographic BBS+ blinding and Circom zero-knowledge range proofs.
          </p>
        </div>
      </div>
    </div>
  );
};
