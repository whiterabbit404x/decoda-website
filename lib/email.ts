/**
 * Resend email provider wrapper.
 *
 * This is the ONLY module that talks to the email provider. It implements the
 * `EmailSender` contract from `./contact` and is injected into the orchestration
 * logic, so the rest of the app stays provider-agnostic and testable.
 *
 * The API key is read from the environment at send time and is never logged or
 * returned to the client.
 */
import { Resend } from 'resend';
import type { EmailMessage } from './contact';

let cachedClient: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Thrown (not returned) so orchestration maps it to a controlled failure.
    // The message intentionally contains no secret material.
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

/**
 * Send a single email through Resend. Rejects on any provider error so the
 * caller can translate it into a controlled, non-leaking failure response.
 */
export async function sendEmailViaResend(message: EmailMessage): Promise<{ id?: string }> {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });

  if (error) {
    // Surface only a coarse identifier. Full diagnostics are logged by the
    // route handler; the API key is never included.
    throw new Error(`Resend send failed: ${error.name ?? 'unknown_error'}`);
  }

  return { id: data?.id };
}
