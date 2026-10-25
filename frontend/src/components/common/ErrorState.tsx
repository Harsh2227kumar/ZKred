import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { toUserMessage } from '@/api/client';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, className = '' }) => {
  const message = toUserMessage(error);

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-destructive/30 bg-destructive/5 text-destructive ${className}`}>
      <div className="p-3 rounded-full bg-destructive/10 mb-3 text-destructive">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h4 className="text-base font-semibold text-foreground mb-1">Action Failed</h4>
      <p className="text-sm text-muted-foreground max-w-md mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
