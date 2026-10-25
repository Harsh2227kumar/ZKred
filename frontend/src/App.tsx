import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/features/home/pages/HomePage';
import { IssuerListPage } from '@/features/issuer/pages/IssuerListPage';
import { IssuerDetailPage } from '@/features/issuer/pages/IssuerDetailPage';
import { WalletPage } from '@/features/wallet/pages/WalletPage';
import { WalletRespondPage } from '@/features/wallet/pages/WalletRespondPage';
import { VerifierPage } from '@/features/verifier/pages/VerifierPage';
import { RequestDetailPage } from '@/features/verifier/pages/RequestDetailPage';
import { AttackConsolePage } from '@/features/attack/pages/AttackConsolePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="issuer" element={<IssuerListPage />} />
            <Route path="issuer/:issuerId" element={<IssuerDetailPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="wallet/respond" element={<WalletRespondPage />} />
            <Route path="verifier" element={<VerifierPage />} />
            <Route path="verifier/requests/:requestId" element={<RequestDetailPage />} />
            <Route path="attack" element={<AttackConsolePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
