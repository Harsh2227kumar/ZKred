// frontend/src/features/wallet/components/CredentialList.tsx
// Claimed credentials, newest first; copies replaced by a refresh sink to the bottom.
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CredentialCard } from './CredentialCard';
import { EmptyState } from '@/components/common/EmptyState';
import type { SignedCredential } from '@/lib/wallet-crypto';
import type { Issuer } from '@/api/schemas';
import { credentialKey, newestFirst, type CredentialStatus } from '../hooks/useCredentialStatus';

interface CredentialListProps {
  credentials: SignedCredential[];
  issuers: Issuer[];
  statuses?: Record<string, CredentialStatus>;
  statusUnavailable?: boolean;
  refreshingKey?: string | null;
  onRefresh?: (credential: SignedCredential) => void;
  onRemove?: (credential: SignedCredential) => void;
}

export const CredentialList: React.FC<CredentialListProps> = ({ credentials, issuers, statuses, statusUnavailable, refreshingKey, onRefresh, onRemove }) => {
  if (credentials.length === 0) {
    return (
      <EmptyState
        title="No credentials claimed yet"
        description="Your claimed student cards, degrees, and medical certificates will appear here once accepted from your offers inbox."
        icon={<ShieldCheck className="w-8 h-8 text-[#79bab6]" />}
      />
    );
  }

  const replacedLast = (c: SignedCredential) => Number(statuses?.[credentialKey(c)]?.kind === 'replaced');
  const ordered = [...credentials].sort((a, b) => replacedLast(a) - replacedLast(b) || newestFirst(a, b));

  return (
    <div className="space-y-4">
      {ordered.map((cred) => {
        const key = credentialKey(cred);
        return (
          <CredentialCard
            key={key}
            credential={cred}
            issuer={issuers.find((i) => i.did === cred.issuer_did)}
            status={statuses?.[key]}
            statusUnavailable={statusUnavailable}
            refreshing={refreshingKey === key}
            onRefresh={onRefresh ? () => onRefresh(cred) : undefined}
            onRemove={onRemove ? () => onRemove(cred) : undefined}
          />
        );
      })}
    </div>
  );
};
