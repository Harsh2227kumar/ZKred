import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from 'sonner';
import { ChainName } from '@/components/common/ChainName';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ZKred · CASCADE '26 · Problem 3: The Identity Monopoly</span>
          <span className="font-mono text-[11px] opacity-75"><ChainName /> · BBS+ Signatures · Circom Groth16 · AWS Bedrock</span>
        </div>
      </footer>
      <Toaster position="bottom-right" richColors />
    </div>
  );
};
