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
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-destructive/30 bg-destructive/5 text-destructive ${className}`}>
      <div className="p-3 rounded-2xl bg-destructive/15 mb-3 text-destructive">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-foreground mb-1">Unable to Complete Request</h4>
      <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
