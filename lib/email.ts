/**
 * Resend email provider wrapper.
 *
 * This is the ONLY module that talks to the email provider. It implements the
 * `EmailSender` contract from `./contact` and is injected into the orchestration
 * logic, so the rest of the app stays provider-agnostic and testable.
 *
 * The API key is read from the environment at send time and is never logged or
 * returned to the client. Failures are thrown as `EmailDeliveryError` so the
 * caller can log an ACTIONABLE server-side diagnostic (missing key vs.
 * unverified sending domain vs. transient provider outage) while still
 * returning a single generic error to the browser.
 */
import { Resend } from 'resend';
import { EmailDeliveryError, redactSecrets, type EmailMessage } from './contact';

let cachedClient: { apiKey: string; client: Resend } | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // Thrown (not returned) so orchestration maps it to a controlled failure.
    // The message intentionally contains no secret material.
    throw new EmailDeliveryError('RESEND_API_KEY is not set in this environment', {
      reason: 'config',
      code: 'MISSING_API_KEY',
    });
  }
  // Key the cache on the key itself so a rotated value is never served from a
  // stale client.
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new Resend(apiKey) };
  }
  return cachedClient.client;
}

/**
 * Resend rejects a send with `name: 'validation_error'` for several distinct
 * misconfigurations (unverified domain, malformed From, sandbox-mode recipient
 * restriction). The provider's `message` is what actually names the problem, so
 * it is preserved for server logs — after redaction, and never sent to the
 * browser.
 */
function classify(statusCode: number | null | undefined, message: string): 'config' | 'provider' {
  if (statusCode === 401 || statusCode === 403 || statusCode === 422) {
    return 'config';
  }
  if (statusCode === 400 && /domain|from|verif/i.test(message)) {
    return 'config';
  }
  return 'provider';
}

/** Shape of the envelope the Resend SDK resolves with. */
export interface ResendEnvelope {
  data: { id: string } | null;
  error: { name?: string; message?: string; statusCode?: number | null } | null;
}

/**
 * Translate a Resend response envelope into either a delivery id or a thrown
 * `EmailDeliveryError`. Exported (and pure) so the failure classification can be
 * unit-tested without touching the network.
 */
export function readResendEnvelope(envelope: ResendEnvelope): { id?: string } {
  const { data, error } = envelope;

  if (error) {
    const providerMessage = redactSecrets(error.message ?? '');
    throw new EmailDeliveryError('Resend rejected the send', {
      reason: classify(error.statusCode, providerMessage),
      code: error.name ?? 'unknown_error',
      statusCode: error.statusCode ?? undefined,
      providerMessage,
    });
  }

  if (!data?.id) {
    // No id means the provider never confirmed acceptance. Treat it as a
    // failure rather than reporting a success we cannot evidence.
    throw new EmailDeliveryError('Resend returned no delivery id', {
      reason: 'provider',
      code: 'NO_DELIVERY_ID',
    });
  }

  return { id: data.id };
}

/**
 * Send a single email through Resend. Rejects on any provider error so the
 * caller can translate it into a controlled, non-leaking failure response.
 */
export async function sendEmailViaResend(message: EmailMessage): Promise<{ id?: string }> {
  const resend = getClient();

  let envelope: ResendEnvelope;
  try {
    envelope = await resend.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
  } catch (cause) {
    // Transport-level failure (DNS, TLS, socket) — the SDK rejects rather than
    // returning an error envelope.
    throw new EmailDeliveryError('Resend request did not complete', {
      reason: 'provider',
      code: 'TRANSPORT_ERROR',
      providerMessage: redactSecrets(cause instanceof Error ? cause.message : String(cause)),
      cause,
    });
  }

  return readResendEnvelope(envelope);
}
