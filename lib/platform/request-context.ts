/**
 * Per-request facts every platform route needs: a correlation id, the client
 * address (for rate limiting only) and its keyed hash (for storage).
 */
import { createHmac, randomBytes } from 'node:crypto';

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

export function newRequestId(): string {
  return `req_${randomBytes(12).toString('hex')}`;
}

/** Honour a well-formed inbound X-Request-Id, otherwise mint one. */
export function requestIdFor(request: Request): string {
  const inbound = request.headers.get('x-request-id') ?? '';
  return REQUEST_ID_RE.test(inbound) ? inbound : newRequestId();
}

/**
 * The originating client address. On Vercel the platform sets
 * x-forwarded-for; the first entry is the client. Used for rate limiting and
 * hashed before it is stored — never persisted raw.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Keyed hash of the client address (HMAC-SHA256, hex). */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(`ip:v1:${ip}`).digest('hex');
}

export function userAgent(request: Request): string | null {
  const value = request.headers.get('user-agent');
  return value ? value.slice(0, 300) : null;
}
