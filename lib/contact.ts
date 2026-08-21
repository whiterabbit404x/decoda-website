/**
 * Framework-agnostic core for the public /contact form.
 *
 * This module holds all of the security-sensitive logic — validation,
 * sanitization, email construction, and send orchestration — with NO Next.js
 * or email-provider imports. Keeping it isolated means:
 *   - it can be unit-tested in plain Node without a running server, and
 *   - the notification recipient is resolved here from server configuration and
 *     can never be influenced by client input.
 *
 * The actual provider (Resend) is injected as `sendEmail`, so tests exercise
 * the real orchestration without touching the network.
 */

/** Allowed values for the "Interest area" select. Server-side allowlist. */
export const INTEREST_AREAS = [
  'RWA Security demo',
  'Platform roadmap discussion',
  'Partnership inquiry',
  'Media or investor request',
] as const;

export type InterestArea = (typeof INTEREST_AREAS)[number];

/** Maximum accepted length per field (characters, after trimming). */
export const FIELD_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  interestArea: 100,
  message: 4000,
} as const;

/** Human-readable origin recorded in the notification email. */
export const CONTACT_PAGE_URL = 'decodasecurity.com/contact';

/**
 * Default recipient and sender. The route handler may override these from
 * environment variables, but the destination is ALWAYS server-controlled and
 * is never read from the request body.
 */
export const DEFAULT_CONTACT_TO_EMAIL = 'hello@decodasecurity.com';
export const DEFAULT_CONTACT_FROM_EMAIL = 'Decoda Website <noreply@decodasecurity.com>';

/** Name of the hidden honeypot field the form renders but humans never fill. */
export const HONEYPOT_FIELD = 'company_website';

export type ContactField = 'name' | 'email' | 'company' | 'interestArea' | 'message';

export interface ContactSubmission {
  name: string;
  email: string;
  company: string;
  interestArea: string;
  message: string;
}

export type ContactFieldErrors = Partial<Record<ContactField, string>>;

/**
 * Pragmatic email check: requires a local part, an "@", and a dotted domain,
 * and — because the character classes forbid whitespace — it structurally
 * rejects the CR/LF that would enable email header injection via the reply-to
 * address.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Coerce arbitrary JSON input to a string without throwing. */
function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Remove C0 (including CR/LF/TAB) and C1 control characters from single-line
 * fields, replacing them with a space. Defense-in-depth against header
 * injection and stray control bytes.
 */
function sanitizeSingleLine(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
}

/**
 * Sanitize the multi-line message: normalize newlines to LF and keep TAB/LF
 * while dropping other control characters. The message is only ever placed in
 * the email body (never a header), so preserving newlines is safe.
 */
function sanitizeMultiLine(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
}

/** Escape a string for safe interpolation into HTML email markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ValidationResult =
  | { success: true; data: ContactSubmission }
  | { success: false; fieldErrors: ContactFieldErrors };

/**
 * Validate and normalize a raw submission. Trims input, enforces length caps,
 * checks the email format, and constrains the interest area to the allowlist.
 * Required: name, email, interestArea, message. Company is optional.
 */
export function validateContactSubmission(raw: unknown): ValidationResult {
  const source: Record<string, unknown> =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const errors: ContactFieldErrors = {};

  const name = sanitizeSingleLine(readString(source.name)).trim();
  const email = sanitizeSingleLine(readString(source.email)).trim();
  const company = sanitizeSingleLine(readString(source.company)).trim();
  const interestArea = sanitizeSingleLine(readString(source.interestArea)).trim();
  const message = sanitizeMultiLine(readString(source.message)).trim();

  if (!name) {
    errors.name = 'Please enter your name.';
  } else if (name.length > FIELD_LIMITS.name) {
    errors.name = `Name must be ${FIELD_LIMITS.name} characters or fewer.`;
  }

  if (!email) {
    errors.email = 'Please enter your work email.';
  } else if (email.length > FIELD_LIMITS.email) {
    errors.email = `Email must be ${FIELD_LIMITS.email} characters or fewer.`;
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (company.length > FIELD_LIMITS.company) {
    errors.company = `Company must be ${FIELD_LIMITS.company} characters or fewer.`;
  }

  if (!interestArea) {
    errors.interestArea = 'Please select an interest area.';
  } else if (
    interestArea.length > FIELD_LIMITS.interestArea ||
    !INTEREST_AREAS.includes(interestArea as InterestArea)
  ) {
    errors.interestArea = 'Please select a valid interest area.';
  }

  if (!message) {
    errors.message = 'Please tell us what you are evaluating.';
  } else if (message.length > FIELD_LIMITS.message) {
    errors.message = `Message must be ${FIELD_LIMITS.message} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, fieldErrors: errors };
  }

  return { success: true, data: { name, email, company, interestArea, message } };
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Build the internal notification delivered to the Decoda inbox. Sent as both
 * plain text and (HTML-escaped) HTML so no raw user input is ever rendered as
 * markup.
 */
export function buildNotificationEmail(
  data: ContactSubmission,
  submittedAt: Date,
): BuiltEmail {
  const timestamp = submittedAt.toISOString();
  const company = data.company || '—';

  const text = [
    'New Decoda Website Inquiry',
    '',
    `Name: ${data.name}`,
    `Work email: ${data.email}`,
    `Company: ${company}`,
    `Interest area: ${data.interestArea}`,
    'Message:',
    data.message,
    '',
    'Submitted from:',
    CONTACT_PAGE_URL,
    '',
    'Submitted at:',
    timestamp,
  ].join('\n');

  const row = (label: string, value: string) =>
    '<tr>' +
    `<td style="padding:4px 12px 4px 0;color:#8fa1bd;vertical-align:top;white-space:nowrap;">${escapeHtml(
      label,
    )}</td>` +
    `<td style="padding:4px 0;color:#0b1220;">${escapeHtml(value)}</td>` +
    '</tr>';

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0b1220;">',
    '<h2 style="margin:0 0 16px;font-size:18px;">New Decoda Website Inquiry</h2>',
    '<table style="border-collapse:collapse;margin:0 0 16px;">',
    row('Name', data.name),
    row('Work email', data.email),
    row('Company', company),
    row('Interest area', data.interestArea),
    '</table>',
    '<p style="margin:0 0 4px;color:#8fa1bd;">Message:</p>',
    `<p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(data.message).replace(
      /\n/g,
      '<br />',
    )}</p>`,
    `<p style="margin:0 0 4px;color:#8fa1bd;">Submitted from:</p><p style="margin:0 0 16px;">${escapeHtml(
      CONTACT_PAGE_URL,
    )}</p>`,
    `<p style="margin:0 0 4px;color:#8fa1bd;">Submitted at:</p><p style="margin:0;">${escapeHtml(
      timestamp,
    )}</p>`,
    '</div>',
  ].join('');

  return { subject: 'New Decoda Website Inquiry', text, html };
}

/** Build the optional acknowledgment sent back to the visitor. */
export function buildConfirmationEmail(data: ContactSubmission): BuiltEmail {
  const text = [
    `Hi ${data.name},`,
    '',
    'Thanks for contacting Decoda Security.',
    '',
    "We've received your inquiry and the team will review it.",
    '',
    'Regards,',
    'Decoda Security',
    'hello@decodasecurity.com',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0b1220;">',
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(data.name)},</p>`,
    '<p style="margin:0 0 16px;">Thanks for contacting Decoda Security.</p>',
    "<p style=\"margin:0 0 16px;\">We've received your inquiry and the team will review it.</p>",
    '<p style="margin:0;">Regards,<br />Decoda Security<br />' +
      '<a href="mailto:hello@decodasecurity.com">hello@decodasecurity.com</a></p>',
    '</div>',
  ].join('');

  return { subject: "We've received your Decoda Security inquiry", text, html };
}

export interface EmailMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Provider-agnostic send function. Implementations MUST reject (throw) on
 * failure so orchestration can map it to a controlled response.
 */
export type EmailSender = (message: EmailMessage) => Promise<{ id?: string } | void>;

export interface HandleContactOptions {
  /** Injected provider send function (real Resend in production, mock in tests). */
  sendEmail: EmailSender;
  /** Server-controlled destination. NEVER sourced from client input. */
  toEmail: string;
  /** Verified sender address, e.g. "Decoda Website <noreply@decodasecurity.com>". */
  fromEmail: string;
  /** Clock injection for deterministic timestamps in tests. */
  now?: () => Date;
  /** When true, also send the optional visitor acknowledgment (best-effort). */
  sendConfirmation?: boolean;
  /** Logger for server-side diagnostics; defaults to console. */
  logger?: Pick<Console, 'error'>;
}

export type ContactResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 400; fieldErrors: ContactFieldErrors }
  | { ok: false; status: 502; error: 'send_failed' };

/**
 * Orchestrate a contact submission end-to-end:
 *   1. Honeypot check (silently succeed for bots).
 *   2. Server-side validation.
 *   3. Primary notification to the Decoda inbox — this is the delivery that
 *      determines success.
 *   4. Optional visitor confirmation (best-effort; its failure never fails the
 *      primary result).
 *
 * The recipient is always `options.toEmail`; the visitor's email is only ever
 * used as `replyTo`.
 */
export async function handleContactSubmission(
  raw: unknown,
  options: HandleContactOptions,
): Promise<ContactResult> {
  const logger = options.logger ?? console;

  // Honeypot: a filled hidden field means an automated submission. Return
  // success WITHOUT sending so bots cannot distinguish acceptance from
  // rejection.
  const honeypot =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)[HONEYPOT_FIELD]
      : undefined;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: true, status: 200 };
  }

  const validation = validateContactSubmission(raw);
  if (!validation.success) {
    return { ok: false, status: 400, fieldErrors: validation.fieldErrors };
  }

  const data = validation.data;
  const submittedAt = options.now ? options.now() : new Date();
  const notification = buildNotificationEmail(data, submittedAt);

  try {
    await options.sendEmail({
      to: options.toEmail, // server-controlled — client input can never change this
      from: options.fromEmail,
      replyTo: data.email,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    });
  } catch (error) {
    logger.error('[contact] primary notification send failed', error);
    return { ok: false, status: 502, error: 'send_failed' };
  }

  if (options.sendConfirmation) {
    try {
      const confirmation = buildConfirmationEmail(data);
      await options.sendEmail({
        to: data.email,
        from: options.fromEmail,
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html,
      });
    } catch (error) {
      // Non-fatal: the primary notification already succeeded.
      logger.error('[contact] visitor confirmation send failed (non-fatal)', error);
    }
  }

  return { ok: true, status: 200 };
}
