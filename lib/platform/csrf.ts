/**
 * CSRF and origin controls for platform mutations.
 *
 * Authenticated mutations (admin console, account actions) require BOTH:
 *   * a same-origin request (Origin header matches the request host), and
 *   * a synchronizer token bound to the WorkOS session id:
 *     base64url(HMAC-SHA256(DECODA_PLATFORM_SECRET, "csrf:v1:<sid>")).
 * The token is rendered into the page by the server and echoed as
 * `X-CSRF-Token`; another origin can neither read it nor compute it, and it
 * changes with every sign-in because the session id does.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function issueCsrfToken(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(`csrf:v1:${sessionId}`).digest('base64url');
}

export function verifyCsrfToken(token: string | null | undefined, sessionId: string, secret: string): boolean {
  if (!token || !sessionId) return false;
  const expected = Buffer.from(issueCsrfToken(sessionId, secret));
  const provided = Buffer.from(token);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * True when the request's Origin names the host it was sent to. Requests
 * without an Origin header (non-browser clients, some navigations) are not
 * same-origin for the purpose of a state change.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(',')[0]!.trim();
  } catch {
    return false;
  }
}
