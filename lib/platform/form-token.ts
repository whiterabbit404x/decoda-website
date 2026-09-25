/**
 * Signed form tokens for the public Request Pilot form (bot / replay trap).
 *
 * The page embeds `issuedAt.nonce.hmac` when it renders. On submit the server
 * requires a valid signature, a minimum age (a person cannot fill the form in
 * under a few seconds; a script posting directly can) and a maximum age. The
 * token proves the submission came through a page Decoda served recently; it
 * is not a session and grants nothing.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const FORM_TOKEN_MIN_AGE_MS = 3_000;
export const FORM_TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function sign(secret: string, issuedAt: number, nonce: string): string {
  return createHmac('sha256', secret).update(`pilot-form:v1:${issuedAt}:${nonce}`).digest('base64url');
}

export function issueFormToken(secret: string, now: number = Date.now()): string {
  const nonce = randomBytes(12).toString('base64url');
  return `${now}.${nonce}.${sign(secret, now, nonce)}`;
}

export type FormTokenCheck = 'ok' | 'missing' | 'invalid' | 'too_fast' | 'expired';

export function checkFormToken(token: unknown, secret: string, now: number = Date.now()): FormTokenCheck {
  if (typeof token !== 'string' || !token) return 'missing';
  const parts = token.split('.');
  if (parts.length !== 3) return 'invalid';
  const [issuedRaw, nonce, signature] = parts as [string, string, string];
  const issuedAt = Number(issuedRaw);
  if (!Number.isSafeInteger(issuedAt) || !/^[A-Za-z0-9_-]{8,32}$/.test(nonce)) return 'invalid';
  const expected = Buffer.from(sign(secret, issuedAt, nonce));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return 'invalid';
  const age = now - issuedAt;
  if (age < 0) return 'invalid';
  if (age < FORM_TOKEN_MIN_AGE_MS) return 'too_fast';
  if (age > FORM_TOKEN_MAX_AGE_MS) return 'expired';
  return 'ok';
}
