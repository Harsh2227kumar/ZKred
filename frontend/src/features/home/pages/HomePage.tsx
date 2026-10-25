import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, GraduationCap, Wallet, CheckCircle2, KeyRound, ArrowRight, Lock, EyeOff, Layers } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 py-6 max-w-6xl mx-auto">
      {/* Minimal Hero */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-mint" />
          <span>Breaking the identity monopoly</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Verifiable Credentials.<br />
          Zero Data Exposure.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          User-controlled, portable credentials for universities, medical councils and government registries.
          Issue degrees, medical licenses and government IDs, and let holders prove exactly what a verifier needs, with zero-knowledge cryptography on <ChainName />.
        </p>
      </section>

      {/* 4 Inset Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NavLink
          to="/issuer"
          className="group p-6 rounded-3xl border border-border bg-card hover:border-primary/50 hover:bg-muted transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-mint flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Institution</span>
              <h3 className="text-lg font-semibold text-foreground mt-0.5">Registrar Console</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Issue degrees, medical licenses and government IDs, BBS+-signed and anchored on-chain in batches.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-mint">
            <span>Manage Issuance</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/wallet"
          className="group p-6 rounded-3xl border border-border bg-card hover:border-secondary/60 hover:bg-muted transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-secondary/25 text-mint flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Holder</span>
              <h3 className="text-lg font-semibold text-foreground mt-0.5">Holder Wallet</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Keep credentials encrypted on your own device. Prove a qualification or that you are over 21 without sharing your name or date of birth.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-mint">
            <span>Open Wallet</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/verifier"
          className="group p-6 rounded-3xl border border-border bg-card hover:border-accent/60 hover:bg-muted transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-accent/40 text-mint flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employers & Hospitals</span>
              <h3 className="text-lg font-semibold text-foreground mt-0.5">Verification Portal</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Describe what you need in plain English; verify degrees, licenses and age with zero-knowledge proofs, without collecting personal data.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-mint">
            <span>Verify Proofs</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/attack"
          className="group p-6 rounded-3xl border border-border bg-card hover:border-primary/50 hover:bg-muted transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-mint flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Red Team</span>
              <h3 className="text-lg font-semibold text-foreground mt-0.5">Attack Console</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Steal an issuer's signing key, forge credentials, and watch chain-time anchoring reject the forgeries while honest holders stay valid.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-mint">
            <span>Run the Attack</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>
      </div>

      {/* Grouped List Style: Architecture & Guarantees */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">System Principles</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-muted text-mint">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-foreground">Holder Privacy First</h4>
              <p className="text-xs text-muted-foreground">Personal data lives only on holders' devices. No central database of personal claims.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-muted text-mint">
              <EyeOff className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-foreground">Selective Disclosure</h4>
              <p className="text-xs text-muted-foreground">Reveal only what is needed: prove a degree or age without revealing name, date of birth or address.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-muted text-mint">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-foreground">On-Chain Timestamping</h4>
              <p className="text-xs text-muted-foreground">Immutable smart contract anchors prevent backdated or fraudulent degrees.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
