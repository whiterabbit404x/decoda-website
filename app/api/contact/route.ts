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
  CONTACT_INVALID_REQUEST,
  CONTACT_RATE_LIMITED,
  CONTACT_SEND_FAILED,
  CONTACT_VALIDATION_FAILED,
  DEFAULT_CONTACT_FROM_EMAIL,
  DEFAULT_CONTACT_TO_EMAIL,
  handleContactSubmission,
  readEnvValue,
} from '@/lib/contact';
import { checkProviderConfiguration, sendEmailViaResend } from '@/lib/email';
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
    headers: {
      'content-type': 'application/json',
      // Never let a proxy or CDN serve a stale submission outcome.
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

/**
 * Resolve contact configuration from the environment.
 *
 * `readEnvValue` trims and strips one surrounding pair of quotes. Hosting
 * dashboards (unlike a dotenv parser) store pasted quotes literally, so a value
 * copied straight out of `.env.example` would otherwise become part of the
 * address and make every send fail. Missing values still fall back to the
 * committed defaults; a missing API KEY is never defaulted — it fails safely.
 */
function readContactConfig() {
  return {
    toEmail: readEnvValue(process.env.CONTACT_TO_EMAIL) || DEFAULT_CONTACT_TO_EMAIL,
    fromEmail: readEnvValue(process.env.CONTACT_FROM_EMAIL) || DEFAULT_CONTACT_FROM_EMAIL,
    // Visitor acknowledgment is on by default; set CONTACT_SEND_CONFIRMATION=false
    // to disable it.
    sendConfirmation: readEnvValue(process.env.CONTACT_SEND_CONFIRMATION) !== 'false',
  };
}

/**
 * GET /api/contact — operational diagnostics for this deployment.
 *
 * Answers the one question a 502 cannot: WHICH part of the configuration is
 * wrong. It reports status names and the public sending domain only — never the
 * API key, never any credential, and never a visitor's data. `?check=provider`
 * additionally asks the provider to confirm the key and domain verification
 * state (one upstream call, covered by the same per-IP rate limit).
 */
export async function GET(request: Request): Promise<Response> {
  const limit = rateLimit(`contact-diag:${getClientIp(request)}`, RATE_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, error: CONTACT_RATE_LIMITED }, 429, {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  const { toEmail, fromEmail, sendConfirmation } = readContactConfig();

  const env = {
    RESEND_API_KEY: readEnvValue(process.env.RESEND_API_KEY) ? 'set' : 'MISSING',
    CONTACT_TO_EMAIL: readEnvValue(process.env.CONTACT_TO_EMAIL) ? 'set' : 'using default',
    CONTACT_FROM_EMAIL: readEnvValue(process.env.CONTACT_FROM_EMAIL) ? 'set' : 'using default',
    CONTACT_SEND_CONFIRMATION: sendConfirmation ? 'enabled' : 'disabled',
  };

  // Recipient and sender are not secrets — both appear in the headers of every
  // message this site sends — and seeing them is how a misconfigured value
  // (stray quotes, wrong address) gets spotted.
  const resolved = { to: toEmail, from: fromEmail };

  const url = new URL(request.url);
  if (url.searchParams.get('check') !== 'provider') {
    return json(
      { ok: true, env, resolved, hint: 'Add ?check=provider to test the key and sending domain.' },
      200,
    );
  }

  const provider = await checkProviderConfiguration(fromEmail);
  return json({ ok: true, env, resolved, provider }, 200);
}

export async function POST(request: Request): Promise<Response> {
  // Rate limit before doing any work.
  const ip = getClientIp(request);
  const limit = rateLimit(`contact:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, error: CONTACT_RATE_LIMITED }, 429, {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  // Parse the JSON body defensively.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: CONTACT_INVALID_REQUEST }, 400);
  }

  // Resolve recipient/sender from server configuration only.
  const { toEmail, fromEmail, sendConfirmation } = readContactConfig();

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
    return json(
      { ok: false, error: CONTACT_VALIDATION_FAILED, fieldErrors: result.fieldErrors },
      400,
    );
  }

  // Provider/config failure: controlled, generic response. The actionable
  // diagnostic (missing key vs. unverified domain vs. outage) was logged
  // server-side inside handleContactSubmission and is deliberately not exposed.
  return json({ ok: false, error: CONTACT_SEND_FAILED }, 502);
}
