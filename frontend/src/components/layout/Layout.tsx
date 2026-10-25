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
      <footer className="border-t border-[#231a3d] py-6 text-center text-xs text-[#8ea5a8]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ZKred · Privacy-Preserving Student Credentials</span>
          <span className="text-[11px] text-[#8ea5a8]"><ChainName /> · BBS+ Signatures · Circom Groth16</span>
        </div>
      </footer>
      <Toaster position="bottom-right" richColors />
    </div>
  );
};
