import { useSearchParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');

  if (!requestId) {
    return (
      <EmptyState
        title="Missing Presentation Request ID"
        description="Please open a valid presentation request link from a verifier."
        action={
          <NavLink to="/wallet" className="text-xs text-primary font-semibold hover:underline">
            Go to My Wallet
          </NavLink>
        }
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <NavLink to="/wallet" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Wallet
      </NavLink>

      <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Proof Consent & Disclosure</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Review exactly what will be revealed to the verifier versus what remains private or proven in Zero-Knowledge.
          </p>
        </div>

        {/* 3 Columns of Transparency */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>Selectively Revealed Fields</span>
            </div>
            <p className="text-xs text-muted-foreground">
              These exact values will be visible to the verifier (BBS+ selective disclosure):
            </p>
            <p className="text-xs font-mono text-muted-foreground">Filled from the request policy (V1-S5).</p>
          </div>

          <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-500 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Proven in Zero-Knowledge (Circom Groth16)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The verifier only receives a mathematical proof that the condition is met. The underlying data is never sent:
            </p>
            <p className="text-xs font-mono text-muted-foreground">Filled from the request policy (V1-S5).</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>Never Disclosed / Stays on Device</span>
            </div>
            <p className="text-xs text-muted-foreground">
              These fields never leave your browser:
            </p>
            <p className="text-xs font-mono text-muted-foreground">Filled from the request policy (V1-S5).</p>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl font-semibold text-sm bg-primary/40 text-primary-foreground cursor-not-allowed text-center transition-colors shadow-xs"
        >
          Share Proofs (Requires V1.1 Presentation Engine)
        </button>
      </div>
    </div>
  );
};
