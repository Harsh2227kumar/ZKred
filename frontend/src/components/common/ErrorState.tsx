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
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-[#ff453a]/30 bg-[#ff453a]/5 text-[#ff453a] ${className}`}>
      <div className="p-3 rounded-2xl bg-[#ff453a]/15 mb-3 text-[#ff453a]">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-[#f0f7f7] mb-1">Unable to Complete Request</h4>
      <p className="text-xs text-[#8ea5a8] max-w-md mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-[#06838d] text-white hover:bg-[#0897a3] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
