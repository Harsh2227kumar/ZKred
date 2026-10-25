import React from 'react';
import { Flame, ShieldAlert, AlertTriangle, ShieldCheck, Play } from 'lucide-react';

export const AttackConsolePage: React.FC = () => {

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Red-Team Attack Console</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate a catastrophic signing key breach and witness real-time on-chain defense.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4" />
          <span>Demo Red-Team Environment</span>
        </div>
      </div>

      {/* The "Wow" Comparison Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full ZK Verifier (Our System) */}
        <div className="p-6 rounded-2xl border-2 border-emerald-500/40 bg-card space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-foreground">ZKred Full ZK Verifier</h3>
            </div>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
              Chain-Time Defense
            </span>
          </div>

          <div className="py-4 text-center">
            <span className="text-5xl font-black text-emerald-500 font-mono tracking-tight">0</span>
            <span className="text-sm font-semibold text-muted-foreground block mt-1">
              Forged Credentials Accepted (200 Isolated)
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Credentials anchored after the on-chain compromise cutoff are rejected automatically. Legacy honest degrees remain valid!
          </p>
        </div>

        {/* Naive Verifier (Traditional Systems) */}
        <div className="p-6 rounded-2xl border-2 border-rose-500/30 bg-card space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-foreground">Naive (Signature-Only) Verifier</h3>
            </div>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-semibold">
              Vulnerable
            </span>
          </div>

          <div className="py-4 text-center">
            <span className="text-5xl font-black text-rose-500 font-mono tracking-tight">200</span>
            <span className="text-sm font-semibold text-muted-foreground block mt-1">
              Forged Credentials Accepted (Breached)
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Only checks cryptographic signatures without checking on-chain batch anchor epochs. Completely compromised!
          </p>
        </div>
      </div>

      {/* 3-Step Attack Stepper */}
      <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-6">
        <h3 className="text-base font-bold text-foreground">Attack Simulation Stepper</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="text-[11px] font-mono text-muted-foreground">STEP 1</span>
            <h4 className="text-sm font-semibold text-foreground">1. Steal Issuer Key</h4>
            <p className="text-xs text-muted-foreground">Extracts the active BBS+ signing private key from the issuer pipeline.</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="text-[11px] font-mono text-muted-foreground">STEP 2</span>
            <h4 className="text-sm font-semibold text-foreground">2. Forge 200 Credentials</h4>
            <p className="text-xs text-muted-foreground">Signs 200 fake MBBS certificates and anchors them into an open batch on Base Sepolia.</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="text-[11px] font-mono text-muted-foreground">STEP 3</span>
            <h4 className="text-sm font-semibold text-foreground">3. Report & Isolate</h4>
            <p className="text-xs text-muted-foreground">Issuer triggers <code>markCompromised</code> on-chain. Watch the forgeries fail instantly.</p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600/50 text-white cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>Launch Attack Simulation (Available in V1.2)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
