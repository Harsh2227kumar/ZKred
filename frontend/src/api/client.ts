// frontend/src/api/client.ts
// ⚓ Anchor: HTTP client configured with baseUrl from config and standard error mapping.

import createClient from 'openapi-fetch';
import { config } from '@/config';
import type { paths } from './types';
import type { ApiError } from './schemas';

// Typed against the generated OpenAPI paths, so calling an endpoint the backend doesn't serve is a compile error.
export const apiClient = createClient<paths>({
  baseUrl: config.apiBaseUrl,
});

/** openapi-fetch result → data, or throw the standard error body so callers / React Query see it. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) {
    throw error ?? ({ error: { code: 'INTERNAL_ERROR', message: `HTTP ${response.status}` } } satisfies ApiError);
  }
  return data as T;
}

/** `Authorization: Bearer <token>` header for 🔐 admin and 👛 wallet endpoints. */
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const ADMIN_TOKEN_KEY = 'zkred_issuer_admin_token';

/** The issuer admin token lives in sessionStorage only (closed tab = gone). */
export const adminToken = {
  get: (): string => sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '',
  set: (token: string) => sessionStorage.setItem(ADMIN_TOKEN_KEY, token),
};

/**
 * Maps standard API error shapes (md/CONTRACTS.md §2) to friendly user messages.
 */
export function toUserMessage(error: unknown, fallbackMessage?: string): string {
  if (!error) return fallbackMessage || 'An unknown error occurred.';

  const apiErr = (error as ApiError)?.error || (error as any);
  const code = apiErr?.code;
  const message = apiErr?.message;

  switch (code) {
    case 'BAD_REQUEST':
      return message || 'The request was malformed or missing parameters.';
    case 'UNAUTHORIZED':
      return 'Missing or invalid token. Enter the admin token (issuer / attack console) or reopen your wallet.';
    case 'FORBIDDEN':
      return message || 'You do not have permission to access this resource.';
    case 'NOT_FOUND':
      return message || 'The requested resource was not found.';
    case 'CONFLICT':
      return message || 'A resource with this identifier already exists.';
    case 'NONCE_USED':
      return 'This verification nonce has already been consumed. Please request a new verification.';
    case 'REQUEST_EXPIRED':
      return 'This verification request has expired. Please ask the verifier for a new link.';
    case 'VALIDATION_ERROR':
      return message || 'Please check your inputs and try again.';
    case 'POLICY_AMBIGUOUS':
      return 'The requirement is ambiguous. Answer the questions below in your text, or build the policy manually.';
    case 'NOT_IMPLEMENTED':
      return 'This feature is scheduled for a future milestone (501 Not Implemented).';
    case 'AI_UNAVAILABLE':
      return 'AI reasoning service is currently unavailable. You may configure the proof policy manually.';
    case 'AI_BAD_OUTPUT':
      return 'The AI returned an invalid policy structure. Please rephrase your query.';
    case 'CHAIN_UNAVAILABLE':
      return 'Blockchain RPC is unreachable. Verification fails closed for security.';
    case 'CHAIN_TX_FAILED':
      return 'On-chain transaction failed or reverted. Please check the transaction on BaseScan.';
    case 'MISSING_CREDENTIAL':
      return message || 'Your wallet has no credential that satisfies this request.';
    case 'BAD_PASSPHRASE':
      return 'Wrong passphrase.';
    case 'INTERNAL_ERROR':
      return 'An internal server error occurred. Please try again later.';
    default:
      if (error instanceof Error && error.message) return error.message;
      return message || fallbackMessage || 'An unexpected error occurred. Please try again.';
  }
}
