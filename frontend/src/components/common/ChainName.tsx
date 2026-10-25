import React from 'react';
import { useChainInfo } from '@/api/queries/meta';

/** Network name from GET /meta/chain, so the UI never hardcodes which chain it runs on. */
export const ChainName: React.FC = () => {
  const { data } = useChainInfo();
  return <>{data?.network_name ?? 'the configured chain'}</>;
};
