import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Building2, Wallet, CheckCircle2, Flame, ArrowRight, Lock, KeyRound, Cpu } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 py-4">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
          <ShieldCheck className="w-4 h-4" />
          <span>CASCADE '26 · Decentralized Portable Proofs</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          Prove Everything.{' '}
          <span className="bg-gradient-to-r from-primary via-violet-500 to-indigo-500 bg-clip-text text-transparent">
            Reveal Nothing.
          </span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          Zero-Knowledge portable credentials backed by BBS+ signatures on <ChainName />.
          Survive a stolen university signing key without hurting a single honest graduate.
        </p>
      </section>

      {/* 4 Feature Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <NavLink
          to="/issuer"
          className="group p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">1. Issuer Console</h3>
            <p className="text-sm text-muted-foreground">
              Register educational & medical institutions, issue BBS+ signed credentials, and anchor batch Merkle roots on-chain.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-primary">
            <span>Explore Issuers</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/wallet"
          className="group p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">2. Holder Wallet</h3>
            <p className="text-sm text-muted-foreground">
              Your credentials live encrypted in your browser (IndexedDB). Decrypt offers, selectively reveal fields, and prove age ≥ 21 in ZK.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-primary">
            <span>Open Wallet</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/verifier"
          className="group p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">3. Verifier Portal</h3>
            <p className="text-sm text-muted-foreground">
              Type requests in plain English. Claude Bedrock generates proof policies. Inspect the full 4-stage evaluation chain.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-primary">
            <span>Verify Proofs</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/attack"
          className="group p-6 rounded-2xl border border-border/60 bg-card hover:border-rose-500/50 transition-all hover:shadow-lg hover:shadow-rose-500/5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground group-hover:text-rose-500 transition-colors">4. Attack Console</h3>
            <p className="text-sm text-muted-foreground">
              Red-team simulation: steal a signing key, forge 200 degrees, report compromise, and watch them get isolated on-chain.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-rose-500">
            <span>Red-Team Test</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>
      </div>

      {/* Highlights Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border/40">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Zero Server PII</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Holder identity claims never sit in server databases or log streams.</p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-500">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">BBS+ & Circom Groth16</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Real selective disclosure and ZK range proofs evaluated client-side.</p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Chain Time &gt; Claimed Time</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Immutable block timestamps on <ChainName /> guarantee anti-backdating.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
