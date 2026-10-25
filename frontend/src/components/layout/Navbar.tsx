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
    { to: '/attack', label: 'Attack Console', icon: Flame },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-3 font-semibold text-lg tracking-tight text-foreground hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs shadow-primary/25">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-foreground">ZKred</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/30 text-mint border border-primary/30 font-medium">Zero-Knowledge</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Portable credentials: degrees, licenses, IDs</span>
            </div>
          </NavLink>

          {/* Segmented Navigation Capsule */}
          <nav className="flex items-center p-1 rounded-2xl bg-card border border-border ml-2 sm:ml-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-border text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5 opacity-80" />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Health Status Pill */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground cursor-default"
            title={getStatusText()}
          >
            <div className="relative flex items-center justify-center">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            </div>
            <span className="text-xs hidden sm:inline-block font-medium text-foreground">
              {isLoading ? 'Connecting...' : isError || !health ? 'Offline' : health.status === 'ok' ? 'Online' : 'Degraded'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
