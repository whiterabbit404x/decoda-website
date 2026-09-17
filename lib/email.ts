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
import {
  EmailDeliveryError,
  extractSenderDomain,
  readEnvValue,
  redactSecrets,
  type EmailMessage,
} from './contact';

let cachedClient: { apiKey: string; client: Resend } | null = null;

function getClient(): Resend {
  // readEnvValue also strips a surrounding pair of quotes: a key pasted into a
  // hosting dashboard as "re_..." would otherwise be sent verbatim and rejected
  // as an invalid credential.
  const apiKey = readEnvValue(process.env.RESEND_API_KEY);
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

/**
 * Secret-free configuration report for the contact pipeline.
 *
 * Every field is a status name or a public value (the sending DOMAIN, which
 * appears in the From header of every email this site sends). The API key is
 * never included, never echoed, and never returned in any form — only whether
 * one is present and whether the provider accepted it.
 */
export interface ProviderDiagnostics {
  /** Is a key configured for THIS environment, and does the provider accept it? */
  apiKey: 'missing' | 'accepted' | 'rejected' | 'unknown';
  /** Domain parsed out of CONTACT_FROM_EMAIL, or null when it is malformed. */
  senderDomain: string | null;
  /** Verification state of that domain in the Resend account. */
  senderDomainStatus:
    | 'verified'
    | 'partially_verified'
    | 'pending'
    | 'failed'
    | 'not_started'
    | 'partially_failed'
    | 'not_in_account'
    | 'unknown';
  /** Plain-language next action for an operator. */
  summary: string;
}

/**
 * Ask the provider whether the current credentials and sending domain would
 * actually permit a send — without sending anything. This is what turns an
 * opaque 502 into a named, fixable cause.
 */
export async function checkProviderConfiguration(fromEmail: string): Promise<ProviderDiagnostics> {
  const senderDomain = extractSenderDomain(fromEmail);

  if (!readEnvValue(process.env.RESEND_API_KEY)) {
    return {
      apiKey: 'missing',
      senderDomain,
      senderDomainStatus: 'unknown',
      summary:
        'RESEND_API_KEY is not configured in this environment. Add it in the hosting ' +
        'provider settings for the Production scope, then redeploy.',
    };
  }

  if (!senderDomain) {
    return {
      apiKey: 'unknown',
      senderDomain: null,
      senderDomainStatus: 'unknown',
      summary:
        'CONTACT_FROM_EMAIL is not a usable address. Expected `Name <user@domain.tld>` ' +
        'or `user@domain.tld`, with NO surrounding quotes.',
    };
  }

  let response: Awaited<ReturnType<Resend['domains']['list']>>;
  try {
    response = await getClient().domains.list();
  } catch (cause) {
    return {
      apiKey: 'unknown',
      senderDomain,
      senderDomainStatus: 'unknown',
      summary:
        'Could not reach the email provider to verify configuration: ' +
        redactSecrets(cause instanceof Error ? cause.message : String(cause)),
    };
  }

  if (response.error) {
    const providerMessage = redactSecrets(response.error.message ?? '');
    const statusCode = response.error.statusCode ?? undefined;
    const rejected = statusCode === 401 || statusCode === 403;
    return {
      apiKey: rejected ? 'rejected' : 'unknown',
      senderDomain,
      senderDomainStatus: 'unknown',
      summary: rejected
        ? `The provider rejected the configured API key (HTTP ${statusCode}). Replace ` +
          'RESEND_API_KEY with a valid key for the Production scope and redeploy. ' +
          'A key pasted with surrounding quotes is the usual cause.'
        : `The provider returned an error while listing domains: ${providerMessage}`,
    };
  }

  const domains = response.data?.data ?? [];
  const match = domains.find((domain) => domain.name.toLowerCase() === senderDomain);

  if (!match) {
    return {
      apiKey: 'accepted',
      senderDomain,
      senderDomainStatus: 'not_in_account',
      summary:
        `The API key is valid, but "${senderDomain}" is not a domain in this Resend ` +
        'account. Either add and verify it at https://resend.com/domains, or set ' +
        'CONTACT_FROM_EMAIL to an address on a domain that is already verified.',
    };
  }

  const verified = match.status === 'verified' || match.status === 'partially_verified';
  return {
    apiKey: 'accepted',
    senderDomain,
    senderDomainStatus: match.status,
    summary: verified
      ? `Configuration looks correct: the API key is valid and "${senderDomain}" is ` +
        `${match.status}. Sending should succeed.`
      : `The API key is valid, but "${senderDomain}" is "${match.status}", not verified. ` +
        'Complete DNS verification at https://resend.com/domains — every send is ' +
        'rejected until it is verified.',
  };
}
