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

/**
 * For screens built ahead of their backend task: rejects with the standard 501 shape (CONTRACTS §2)
 * so the page shows a real error state instead of calling an endpoint that doesn't exist yet.
 */
export function pendingEndpoint<T>(task: string): Promise<T> {
  const error: ApiError = { error: { code: 'NOT_IMPLEMENTED', message: `Arrives with ${task}` } };
  return Promise.reject(error);
}

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
      return 'Session expired or invalid credentials. Please log in again.';
    case 'FORBIDDEN':
      return 'You do not have permission to access this resource.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'CONFLICT':
      return message || 'A resource with this identifier already exists.';
    case 'NONCE_USED':
      return 'This verification nonce has already been consumed. Please request a new verification.';
    case 'REQUEST_EXPIRED':
      return 'This verification request has expired. Please ask the verifier for a new link.';
    case 'VALIDATION_ERROR':
      return message || 'Please check your inputs and try again.';
    case 'POLICY_AMBIGUOUS':
      return 'The requirements were ambiguous. Please review the clarification questions.';
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
    case 'INTERNAL_ERROR':
      return 'An internal server error occurred. Please try again later.';
    default:
      return message || fallbackMessage || 'An unexpected error occurred. Please try again.';
  }
}
