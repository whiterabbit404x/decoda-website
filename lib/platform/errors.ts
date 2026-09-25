/**
 * Typed platform errors. Every error that can reach a response carries a
 * stable code, an HTTP status and a message that is safe to show — never a
 * stack trace, SQL, a provider payload, a token or a secret.
 */

export class PlatformError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PlatformError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Required configuration is missing or unsafe. The response is a generic 503
 * and nothing is granted; `diagnostic` names only the VARIABLES involved, so it
 * is safe to log.
 */
export class PlatformConfigError extends PlatformError {
  readonly variables: string[];
  readonly diagnostic: string;

  constructor(variables: string[], reason = 'missing') {
    super(503, 'PLATFORM_NOT_CONFIGURED', 'This Decoda service is not available right now.');
    this.name = 'PlatformConfigError';
    this.variables = variables;
    this.diagnostic = `Decoda platform configuration ${reason}: ${variables.join(', ')}`;
  }
}

export const notFound = (message = 'Not found.') => new PlatformError(404, 'NOT_FOUND', message);
export const forbidden = (code = 'FORBIDDEN', message = 'You are not allowed to do that.') =>
  new PlatformError(403, code, message);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new PlatformError(409, code, message, details);
export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new PlatformError(400, code, message, details);

/** The JSON envelope every platform route answers errors with. */
export function errorBody(error: PlatformError, requestId: string | null) {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      request_id: requestId,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
