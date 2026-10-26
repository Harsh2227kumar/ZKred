// Error codes and HTTP statuses from md/CONTRACTS.md §2. Every non-2xx response is built from an AppError.

export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  NONCE_USED: 409,
  REQUEST_EXPIRED: 410,
  VALIDATION_ERROR: 422,
  POLICY_AMBIGUOUS: 422,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
  AI_UNAVAILABLE: 502,
  AI_BAD_OUTPUT: 502,
  CHAIN_UNAVAILABLE: 502,
  CHAIN_TX_FAILED: 502,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export const notImplemented = (what: string): AppError =>
  new AppError("NOT_IMPLEMENTED", `${what} is not implemented yet`);
