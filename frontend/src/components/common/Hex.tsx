import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HexProps {
  value: string;
  prefixLen?: number;
  suffixLen?: number;
  className?: string;
}

export const Hex: React.FC<HexProps> = ({
  value,
  prefixLen = 6,
  suffixLen = 4,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const isShort = value.length <= prefixLen + suffixLen + 3;
  const displayVal = isShort ? value : `${value.slice(0, prefixLen)}...${value.slice(-suffixLen)}`;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-all border border-border/50 group cursor-pointer ${className}`}
      title={`Click to copy: ${value}`}
    >
      <span>{displayVal}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500 animate-in fade-in zoom-in" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
};
