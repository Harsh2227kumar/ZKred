import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Building2, Wallet, CheckCircle2, Flame } from 'lucide-react';
import { useHealth } from '@/api/queries/meta';

export const Navbar: React.FC = () => {
  const { data: health, isError, isLoading } = useHealth();

  const getStatusColor = () => {
    if (isLoading) return 'bg-amber-400';
    if (isError || !health) return 'bg-rose-500';
    if (health.status === 'ok') return 'bg-emerald-500';
    return 'bg-amber-400';
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking health...';
    if (isError || !health) return 'Backend offline';
    if (health.status === 'ok') return 'All systems operational (DB, Chain, AI)';
    return `Degraded: DB ${health.db}, Chain ${health.chain}, AI ${health.ai}`;
  };

  const navItems = [
    { to: '/issuer', label: 'Issuer Console', icon: Building2 },
    { to: '/wallet', label: 'Holder Wallet', icon: Wallet },
    { to: '/verifier', label: 'Verifier Portal', icon: CheckCircle2 },
    { to: '/attack', label: 'Attack Console', icon: Flame, badge: 'Red Team' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-foreground hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/25">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">ZKred</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">Zero-Knowledge</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal tracking-wide">Portable Decentralized Proofs</span>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Health Status Indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/60 text-xs font-mono text-muted-foreground shadow-2xs hover:bg-card transition-colors cursor-help"
            title={getStatusText()}
          >
            <div className="relative flex items-center justify-center">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className={`absolute w-3.5 h-3.5 rounded-full ${getStatusColor()} opacity-40 animate-ping`} />
            </div>
            <span className="text-xs hidden sm:inline-block font-sans font-medium text-foreground/80">
              {isLoading ? 'Checking...' : isError || !health ? 'Offline' : 'Online'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
