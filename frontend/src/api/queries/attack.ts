// frontend/src/api/queries/attack.ts (DEMO_MODE only; admin token)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminToken, apiClient, bearer, unwrap } from '@/api/client';
import type { AttackRunOut, AttackState, ForgeOut, StolenKey } from '@/api/schemas';

const auth = () => ({ headers: bearer(adminToken.get()) });

export function useAttackState(enabled: boolean) {
  return useQuery<AttackState>({
    queryKey: ['attack'],
    queryFn: () => unwrap(apiClient.GET('/attack/state', auth())),
    enabled,
    retry: false,
  });
}

function useAttackMutation<TIn, TOut>(fn: (input: TIn) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation<TOut, unknown, TIn>({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attack'] });
      void qc.invalidateQueries({ queryKey: ['issuers'] });
    },
  });
}

export const useStealKey = () =>
  useAttackMutation<string, StolenKey>((issuerId) => unwrap(apiClient.POST('/attack/steal-key', { body: { issuer_id: issuerId }, ...auth() })));

export const useForge = () =>
  useAttackMutation<{ issuerId: string; count: number; claims: Record<string, string | number> }, ForgeOut>(({ issuerId, count, claims }) =>
    unwrap(apiClient.POST('/attack/forge', { body: { issuer_id: issuerId, count, claims }, ...auth() })),
  );

export const useVerifyForged = () =>
  useAttackMutation<'naive' | 'full', AttackRunOut>((mode) => unwrap(apiClient.POST('/attack/verify-forged', { body: { mode }, ...auth() })));

export const useResetAttack = () => useAttackMutation<void, { ok: true }>(() => unwrap(apiClient.POST('/attack/reset', auth())));
