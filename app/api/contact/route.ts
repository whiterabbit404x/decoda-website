/**
 * POST /api/contact — server-side handler for the public contact / demo form.
 *
 * All email delivery happens here, on the server. The provider API key never
 * leaves the server, the destination address is resolved from server
 * configuration (never from the request body), and provider errors are logged
 * server-side but never returned to the browser.
 *
 * The handler uses the Web `Request`/`Response` API (not `next/server`) so the
 * core flow can be exercised directly in unit tests.
 */
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  DEFAULT_CONTACT_TO_EMAIL,
  handleContactSubmission,
} from '@/lib/contact';
import { sendEmailViaResend } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

// Run on the Node.js runtime: the Resend SDK and the in-memory rate limiter
// both expect a standard Node environment.
export const runtime = 'nodejs';

// Per-IP submission ceiling. Best-effort, in-memory (see lib/rate-limit.ts).
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // First entry is the originating client.
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export async function POST(request: Request): Promise<Response> {
  // Rate limit before doing any work.
  const ip = getClientIp(request);
  const limit = rateLimit(`contact:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, error: 'rate_limited' }, 429, {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  // Parse the JSON body defensively.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  // Resolve recipient/sender from server configuration only.
  const toEmail = process.env.CONTACT_TO_EMAIL || DEFAULT_CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || DEFAULT_CONTACT_FROM_EMAIL;
  // Visitor acknowledgment is on by default; set CONTACT_SEND_CONFIRMATION=false
  // to disable it.
  const sendConfirmation = process.env.CONTACT_SEND_CONFIRMATION !== 'false';

  const result = await handleContactSubmission(body, {
    sendEmail: sendEmailViaResend,
    toEmail,
    fromEmail,
    sendConfirmation,
    logger: console,
  });

  if (result.ok) {
    return json({ ok: true }, 200);
  }

  if (result.status === 400) {
    return json({ ok: false, error: 'validation', fieldErrors: result.fieldErrors }, 400);
  }

  // Provider/config failure: controlled, generic response. Details were logged
  // server-side inside handleContactSubmission.
  return json({ ok: false, error: 'send_failed' }, 502);
}
