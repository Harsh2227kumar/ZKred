// frontend/src/api/types.ts
// Generated from OpenAPI spec or mirrored from CONTRACTS.md.
// Run `pnpm --filter frontend gen:api` to update from backend.

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  chain: 'ok' | 'down';
  ai: 'ok' | 'down';
  version: string;
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface EnumsResponse {
  issuer_kinds: EnumOption[];
  credential_types: EnumOption[];
  key_statuses: EnumOption[];
  batch_statuses: EnumOption[];
  predicate_types: EnumOption[];
  verification_steps: EnumOption[];
  verification_results: EnumOption[];
}

export interface ChainInfoResponse {
  chain_id: number;
  network_name: string;
  issuer_registry: string;
  anchor_registry: string;
  status_registry: string;
  explorer_tx_url_template: string;
  breach_window_seconds: number;
  demo_mode: boolean;
}

export interface CredentialSchemaField {
  name: string;
  label: string;
  kind: 'string' | 'date' | 'int';
  pii: boolean;
  index: number;
  source: 'meta' | 'claim' | 'derived';
}

export interface CredentialSchema {
  type: string;
  version: number;
  fields: CredentialSchemaField[];
}

export interface CredentialSchemasResponse {
  items: CredentialSchema[];
}

export interface IssuerKey {
  key_id: string;
  public_key_base64url: string;
  status: 'active' | 'retired' | 'compromised';
  created_at: string;
  tx_hash?: string;
}

export interface Issuer {
  id: string;
  name: string;
  did: string;
  kind: string;
  accredited: boolean;
  keys: IssuerKey[];
}

export interface IssuersListResponse {
  items: Issuer[];
  next_cursor: string | null;
}
