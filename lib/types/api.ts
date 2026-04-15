// lib/types/api.ts
// Consistent API response envelope used by all route handlers.
//
// Every Next.js route that returns JSON must use one of these two shapes:
//   NextResponse.json(ok(data),      { status: HTTP.OK })
//   NextResponse.json(err("reason"), { status: HTTP.BAD_REQUEST })
//
// Uniform shapes mean:
//   • The client only needs to check `res.ok` once.
//   • Error messages are always in `res.error` — no hunting for the field name.
//   • Internal details (stack traces, DB errors) never leak to the client.

// ── Result types ──────────────────────────────────────────────────────────────

/** Successful response. `data` is present only when there is a payload. */
export interface ApiOk<T = undefined> {
  readonly ok:    true;
  readonly data?: T;
}

/**
 * Failure response.
 * `error`  — human-readable message, safe to display in the UI.
 * `code`   — optional machine-readable key for client-side switch statements.
 */
export interface ApiError {
  readonly ok:     false;
  readonly error:  string;
  readonly code?:  string;
}

/** Discriminated union — narrow on `.ok` to get the typed shape. */
export type ApiResult<T = undefined> = ApiOk<T> | ApiError;

// ── Constructor helpers ───────────────────────────────────────────────────────

/** Build a success envelope without a payload. */
export function ok(): ApiOk<undefined>;
/** Build a success envelope with a typed payload. */
export function ok<T>(data: T): ApiOk<T>;
export function ok<T>(data?: T): ApiOk<T> {
  return (data !== undefined ? { ok: true, data } : { ok: true }) as ApiOk<T>;
}

/** Build an error envelope. `message` is shown to the user. */
export function err(message: string, code?: string): ApiError {
  return { ok: false, error: message, ...(code !== undefined && { code }) };
}

// ── HTTP status constants ─────────────────────────────────────────────────────
// Named constants eliminate magic numbers in route handlers.

export const HTTP = {
  OK:            200,
  CREATED:       201,
  NO_CONTENT:    204,
  BAD_REQUEST:   400,
  UNAUTHORIZED:  401,
  FORBIDDEN:     403,
  NOT_FOUND:     404,
  CONFLICT:      409,
  UNPROCESSABLE: 422,
  TOO_MANY:      429,
  SERVER_ERROR:  500,
} as const;

export type HttpStatus = (typeof HTTP)[keyof typeof HTTP];
