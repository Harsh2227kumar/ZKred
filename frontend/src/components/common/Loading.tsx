import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  label?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ label = 'Loading...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-muted-foreground gap-3 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm font-medium tracking-wide animate-pulse">{label}</span>
    </div>
  );
};
