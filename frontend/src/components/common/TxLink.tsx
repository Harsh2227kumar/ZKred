import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useChainInfo } from '@/api/queries/meta';

interface TxLinkProps {
  hash: string;
  label?: string;
  className?: string;
}

export const TxLink: React.FC<TxLinkProps> = ({ hash, label, className = '' }) => {
  const { data: chainInfo } = useChainInfo();

  if (!hash) return null;

  const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  const displayLabel = label || shortHash;

  const urlTemplate = chainInfo?.explorer_tx_url_template;
  const href = urlTemplate ? urlTemplate.replace('{tx}', hash) : null;

  if (!href) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs text-muted-foreground ${className}`} title={hash}>
        <span>{displayLabel}</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline hover:text-primary/80 transition-colors ${className}`}
      title={hash}
    >
      <span>{displayLabel}</span>
      <ExternalLink className="w-3 h-3 opacity-70" />
    </a>
  );
};
