// frontend/src/features/wallet/components/CredentialList.tsx
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CredentialCard } from './CredentialCard';
import { EmptyState } from '@/components/common/EmptyState';
import type { SignedCredential } from '@/lib/wallet-crypto';
import type { Issuer } from '@/api/schemas';

interface CredentialListProps {
  credentials: SignedCredential[];
  issuers: Issuer[];
}

export const CredentialList: React.FC<CredentialListProps> = ({ credentials, issuers }) => {
  if (credentials.length === 0) {
    return (
      <EmptyState
        title="No credentials claimed yet"
        description="Your claimed student cards, degrees, and medical certificates will appear here once accepted from your offers inbox."
        icon={<ShieldCheck className="w-8 h-8 text-[#79bab6]" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {credentials.map((cred, idx) => {
        const issuer = issuers.find((i) => i.did === cred.issuer_did);
        const uniqueKey = cred.values?.commitment || `${cred.type}-${cred.signature}-${idx}`;

        return (
          <CredentialCard
            key={uniqueKey}
            credential={cred}
            issuer={issuer}
          />
        );
      })}
    </div>
  );
};
