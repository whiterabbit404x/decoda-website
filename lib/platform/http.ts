/**
 * Small HTTP helpers shared by platform route handlers. Handlers use the Web
 * Request/Response API so their logic runs unchanged in unit tests.
 */
import { PlatformConfigError, PlatformError, errorBody } from './errors';

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

export async function readJsonBody(request: Request, maxBytes = 32 * 1024): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new PlatformError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request as application/json.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new PlatformError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new PlatformError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new PlatformError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

/**
 * Map any error to a safe JSON response. Unknown errors become a generic 500
 * that carries only the request id; details go to the server log without
 * payloads, tokens or secrets.
 */
export function errorResponse(error: unknown, requestId: string, logger: Pick<Console, 'error'> = console): Response {
  if (error instanceof PlatformConfigError) {
    logger.error('[platform] configuration error', { request_id: requestId, diagnostic: error.diagnostic });
    return json(errorBody(error, requestId), error.status);
  }
  if (error instanceof PlatformError) {
    return json(errorBody(error, requestId), error.status);
  }
  logger.error('[platform] unexpected error', {
    request_id: requestId,
    name: error instanceof Error ? error.name : typeof error,
    code: (error as { code?: unknown } | null)?.code ?? null,
  });
  return json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Quote the request id to support.', request_id: requestId } },
    500,
  );
}

/** Safe log line for a server-rendered platform page that failed closed. */
export function logPlatformPageError(page: string, error: unknown, logger: Pick<Console, 'error'> = console): void {
  logger.error('[platform] page failed closed', {
    page,
    name: error instanceof Error ? error.name : typeof error,
    code: (error as { code?: unknown } | null)?.code ?? null,
    diagnostic: error instanceof PlatformConfigError ? error.diagnostic : undefined,
  });
}

export function requiredString(body: Record<string, unknown>, key: string, max = 200): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new PlatformError(400, 'VALIDATION_FAILED', `${key} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new PlatformError(400, 'VALIDATION_FAILED', `${key} is too long.`);
  return trimmed;
}

export function optionalString(body: Record<string, unknown>, key: string, max = 2000): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new PlatformError(400, 'VALIDATION_FAILED', `${key} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new PlatformError(400, 'VALIDATION_FAILED', `${key} is too long.`);
  return trimmed || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path/body ids that are not UUIDs are simply "not found" — never a 500. */
export function uuidOrNotFound(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new PlatformError(404, 'NOT_FOUND', 'Not found.');
  return value.toLowerCase();
}
