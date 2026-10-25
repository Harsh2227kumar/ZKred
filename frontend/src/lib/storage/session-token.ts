// frontend/src/lib/storage/session-token.ts
// Secure accessor for ISSUER_ADMIN_TOKEN in sessionStorage only.
// Never written to localStorage or transmitted outside Authorization header.

const TOKEN_KEY = 'zkred_issuer_admin_token';

export function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) {
    sessionStorage.setItem(TOKEN_KEY, trimmed);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return Boolean(getAdminToken());
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
