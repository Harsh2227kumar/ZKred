import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, GraduationCap, Wallet, CheckCircle2, KeyRound, ArrowRight, Lock, EyeOff, Layers } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 py-6 max-w-6xl mx-auto">
      {/* Minimal Hero */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#130e24] border border-[#231a3d] text-xs font-medium text-[#8ea5a8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#79bab6]" />
          <span>Decentralized Campus Identity & Credentials</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#f0f7f7] leading-tight">
          Verifiable Credentials.<br />
          Zero Data Exposure.
        </h1>
        <p className="text-base text-[#8ea5a8] leading-relaxed">
          A secure, self-sovereign credential network built for colleges, universities, and students.
          Issue digital diplomas, verify student status, and prove qualifications using zero-knowledge cryptography on <ChainName />.
        </p>
      </section>

      {/* 4 Inset Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NavLink
          to="/issuer"
          className="group p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#06838d]/50 hover:bg-[#1a1430] transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">Institution</span>
              <h3 className="text-lg font-semibold text-[#f0f7f7] mt-0.5">Registrar Console</h3>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Issue tamper-proof student IDs, degrees, and academic transcripts with cryptographically anchored BBS+ signatures.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#79bab6]">
            <span>Manage Issuance</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/wallet"
          className="group p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#014f85]/60 hover:bg-[#1a1430] transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#014f85]/25 text-[#79bab6] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">Student</span>
              <h3 className="text-lg font-semibold text-[#f0f7f7] mt-0.5">Student Wallet</h3>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Store your credentials encrypted on your own device. Prove enrolled status or age verification without sharing private data.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#79bab6]">
            <span>Open Wallet</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/verifier"
          className="group p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#2e036b]/60 hover:bg-[#1a1430] transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#2e036b]/40 text-[#79bab6] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">Campus & Employers</span>
              <h3 className="text-lg font-semibold text-[#f0f7f7] mt-0.5">Verification Portal</h3>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Verify qualifications and degrees instantly with mathematical zero-knowledge certainty, without storing student records.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#79bab6]">
            <span>Verify Proofs</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>

        <NavLink
          to="/attack"
          className="group p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#06838d]/50 hover:bg-[#1a1430] transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#8ea5a8] uppercase tracking-wider">Integrity</span>
              <h3 className="text-lg font-semibold text-[#f0f7f7] mt-0.5">Security & Key Audit</h3>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Verify key lifecycle protection, key rotation, and demonstrate zero-impact recovery against stolen or compromised credentials.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#79bab6]">
            <span>Audit Key Security</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>
      </div>

      {/* Grouped List Style: Architecture & Guarantees */}
      <div className="rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 space-y-4">
        <div className="border-b border-[#231a3d] pb-3">
          <h2 className="text-sm font-semibold text-[#f0f7f7] uppercase tracking-wider">System Principles</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#1a1430] text-[#79bab6]">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-[#f0f7f7]">Student Privacy First</h4>
              <p className="text-xs text-[#8ea5a8]">Personal data lives only on student devices. No centralized database of personal IDs.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#1a1430] text-[#79bab6]">
              <EyeOff className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-[#f0f7f7]">Selective Disclosure</h4>
              <p className="text-xs text-[#8ea5a8]">Reveal only what is needed: prove enrollment without revealing student ID or address.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#1a1430] text-[#79bab6]">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium text-[#f0f7f7]">On-Chain Timestamping</h4>
              <p className="text-xs text-[#8ea5a8]">Immutable smart contract anchors prevent backdated or fraudulent degrees.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
